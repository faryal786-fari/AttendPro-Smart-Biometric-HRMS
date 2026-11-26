"""AttendPro Redis cache layer.

Redis stores a rebuildable snapshot of the existing AttendPro read projection.
Supabase/PostgreSQL remains the permanent cloud source of truth; the original
ZKTeco MDB is only read by the local Python bridge and is never written here.
"""
from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from typing import Any


class RedisCache:
    """Optional Redis cache. All operations fail open so Redis outages do not
    stop the existing AttendPro application or modify the source MDB.
    """

    SNAPSHOT_TABLES = {
        "employees": "SELECT * FROM employees ORDER BY id",
        "source_daily": "SELECT * FROM raw_daily ORDER BY work_date, employee_id",
        "effective_daily": "SELECT * FROM daily ORDER BY work_date, employee_id",
        "raw_punches": "SELECT * FROM punches ORDER BY happened_at, id",
        "discrepancy_reviews": "SELECT * FROM discrepancy_reviews ORDER BY work_date, employee_id",
        "correction_overrides": "SELECT * FROM cloud_adjustment_cache ORDER BY work_date, employee_id",
        "attendance_audit": "SELECT * FROM attendance_changes ORDER BY id",
        "devices": "SELECT * FROM devices ORDER BY id",
    }

    def __init__(self, url: str = "", enabled: bool = False, prefix: str = "attendpro:v1",
                 api_ttl_seconds: int = 3600, client: Any = None):
        self.url = (url or "").strip()
        self.enabled = bool(enabled and self.url) or client is not None
        self.prefix = (prefix or "attendpro:v1").rstrip(":")
        self.api_ttl_seconds = max(60, int(api_ttl_seconds or 3600))
        self._client = client
        self._lock = threading.RLock()
        self.last_error = ""
        self.last_snapshot_at = ""
        self.last_counts: dict[str, int] = {}

    @classmethod
    def from_env(cls) -> "RedisCache":
        url = os.getenv("REDIS_URL", "").strip()
        flag = os.getenv("REDIS_CACHE_ENABLED", "1" if url else "0").lower() in ("1", "true", "yes", "on")
        try:
            ttl = int(os.getenv("REDIS_API_CACHE_TTL_SECONDS", "3600"))
        except ValueError:
            ttl = 3600
        return cls(
            url=url,
            enabled=flag,
            prefix=os.getenv("REDIS_KEY_PREFIX", "attendpro:v1"),
            api_ttl_seconds=ttl,
        )

    def _client_or_none(self):
        if not self.enabled:
            return None
        if self._client is not None:
            return self._client
        if not self.url:
            return None
        try:
            import redis  # Imported only when Redis is configured.
            self._client = redis.Redis.from_url(
                self.url,
                decode_responses=True,
                socket_connect_timeout=3,
                socket_timeout=3,
                health_check_interval=30,
            )
            self._client.ping()
            self.last_error = ""
            return self._client
        except Exception as exc:
            self.last_error = f"{type(exc).__name__}: {exc}"[:300]
            self._client = None
            return None

    def key(self, suffix: str) -> str:
        return f"{self.prefix}:{suffix.lstrip(':')}"

    def ping(self) -> bool:
        client = self._client_or_none()
        if client is None:
            return False
        try:
            ok = bool(client.ping())
            self.last_error = ""
            return ok
        except Exception as exc:
            self.last_error = f"{type(exc).__name__}: {exc}"[:300]
            return False

    def get_json(self, suffix: str):
        client = self._client_or_none()
        if client is None:
            return None
        try:
            raw = client.get(self.key(suffix))
            return json.loads(raw) if raw else None
        except Exception as exc:
            self.last_error = f"{type(exc).__name__}: {exc}"[:300]
            return None

    def set_json(self, suffix: str, value: Any, ttl: int | None = None) -> bool:
        client = self._client_or_none()
        if client is None:
            return False
        try:
            payload = json.dumps(value, ensure_ascii=False, separators=(",", ":"), default=str)
            if ttl and ttl > 0:
                client.set(self.key(suffix), payload, ex=int(ttl))
            else:
                client.set(self.key(suffix), payload)
            self.last_error = ""
            return True
        except Exception as exc:
            self.last_error = f"{type(exc).__name__}: {exc}"[:300]
            return False

    def delete_pattern(self, suffix_pattern: str) -> int:
        client = self._client_or_none()
        if client is None:
            return 0
        try:
            pattern = self.key(suffix_pattern)
            keys = list(client.scan_iter(match=pattern, count=500))
            if keys:
                return int(client.delete(*keys))
            return 0
        except Exception as exc:
            self.last_error = f"{type(exc).__name__}: {exc}"[:300]
            return 0

    def invalidate_api_cache(self) -> int:
        """Drop cached API responses after a source refresh or a manual edit."""
        return self.delete_pattern("api:*")

    def acquire_lock(self, suffix: str, token: str, ttl_seconds: int = 4200):
        """Acquire a distributed scheduler lock.

        Returns True when acquired, False when another worker owns it, and None
        when Redis is unavailable (the caller may fall back to an in-process lock).
        """
        client = self._client_or_none()
        if client is None:
            return None
        try:
            return bool(client.set(self.key(suffix), token, nx=True, ex=max(30, int(ttl_seconds))))
        except Exception as exc:
            self.last_error = f"{type(exc).__name__}: {exc}"[:300]
            return None

    def release_lock(self, suffix: str, token: str) -> bool:
        """Release a lock only when its token still matches this worker."""
        client = self._client_or_none()
        if client is None:
            return False
        script = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end"
        try:
            return bool(client.eval(script, 1, self.key(suffix), token))
        except Exception as exc:
            self.last_error = f"{type(exc).__name__}: {exc}"[:300]
            return False

    def refresh_snapshot(self, db) -> dict[str, Any]:
        """Copy current local read projection into Redis in small table chunks.

        Snapshot keys are rebuildable cache records, not the permanent database.
        Source and effective attendance are stored separately so corrections never
        overwrite the original imported biometric evidence.
        """
        client = self._client_or_none()
        if client is None:
            return {"success": False, "reason": "Redis is not connected"}

        counts: dict[str, int] = {}
        chunk_size = 500
        try:
            existing_tables = {
                row[0] for row in db.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()
            }
            pipe = client.pipeline(transaction=False) if hasattr(client, "pipeline") else None

            for logical_name, query in self.SNAPSHOT_TABLES.items():
                table = query.split(" FROM ", 1)[1].split(" ", 1)[0]
                base_suffix = f"snapshot:{logical_name}"
                self.delete_pattern(f"{base_suffix}:*")
                if table not in existing_tables:
                    counts[logical_name] = 0
                    continue

                cursor = db.execute(query)
                total = 0
                chunk_index = 0
                while True:
                    rows = cursor.fetchmany(chunk_size)
                    if not rows:
                        break
                    values = [dict(row) for row in rows]
                    suffix = f"{base_suffix}:{chunk_index:06d}"
                    payload = json.dumps(values, ensure_ascii=False, separators=(",", ":"), default=str)
                    if pipe is not None:
                        pipe.set(self.key(suffix), payload)
                    else:
                        client.set(self.key(suffix), payload)
                    total += len(values)
                    chunk_index += 1
                if pipe is not None:
                    pipe.execute()
                self.set_json(f"snapshot:{logical_name}:manifest", {
                    "chunks": chunk_index,
                    "records": total,
                })
                counts[logical_name] = total

            generated_at = datetime.now(timezone.utc).isoformat()
            meta = {
                "generated_at": generated_at,
                "counts": counts,
                "source": "AttendPro local read projection",
                "permanent_database": "Supabase PostgreSQL",
                "original_mdb_write_enabled": False,
                "source_daily_and_effective_daily_separate": True,
            }
            self.set_json("snapshot:meta", meta)
            self.last_snapshot_at = generated_at
            self.last_counts = counts
            self.last_error = ""
            return {"success": True, **meta}
        except Exception as exc:
            self.last_error = f"{type(exc).__name__}: {exc}"[:300]
            return {"success": False, "reason": self.last_error}

    def status(self) -> dict[str, Any]:
        configured = bool(self.enabled and self.url) or self._client is not None
        connected = self.ping() if configured else False
        meta = self.get_json("snapshot:meta") if connected else None
        datasets: dict[str, dict[str, int]] = {}
        if connected:
            for dataset in self.SNAPSHOT_TABLES:
                manifest = self.get_json(f"snapshot:{dataset}:manifest")
                if isinstance(manifest, dict):
                    datasets[dataset] = {
                        "records": int(manifest.get("records", 0) or 0),
                        "chunks": int(manifest.get("chunks", 0) or 0),
                    }
        client = self._client_or_none() if connected else None
        key_count = None
        if client is not None:
            try:
                key_count = sum(1 for _ in client.scan_iter(match=self.key("*"), count=1000))
            except Exception:
                key_count = None
        return {
            "enabled": self.enabled,
            "configured": configured,
            "connected": connected,
            "prefix": self.prefix,
            "api_cache_ttl_seconds": self.api_ttl_seconds,
            "scheduler_lock_supported": bool(connected),
            "snapshot": meta or None,
            "datasets": datasets,
            "redis_key_count": key_count,
            "last_error": self.last_error,
            "note": "Redis is a rebuildable cache; Supabase is the permanent cloud database. Original MDB is read-only.",
        }


redis_cache = RedisCache.from_env()
