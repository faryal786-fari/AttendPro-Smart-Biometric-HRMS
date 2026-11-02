import json
import sqlite3
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from redis_cache import RedisCache


class FakePipeline:
    def __init__(self, client):
        self.client = client
        self.pending = []

    def set(self, key, value):
        self.pending.append((key, value))
        return self

    def execute(self):
        for key, value in self.pending:
            self.client.values[key] = value
        self.pending.clear()
        return True


class FakeRedis:
    def __init__(self):
        self.values = {}

    def ping(self):
        return True

    def set(self, key, value, ex=None, nx=False):
        if nx and key in self.values:
            return False
        self.values[key] = value
        return True

    def eval(self, script, numkeys, key, token):
        if self.values.get(key) == token:
            del self.values[key]
            return 1
        return 0

    def get(self, key):
        return self.values.get(key)

    def delete(self, *keys):
        count = 0
        for key in keys:
            if key in self.values:
                del self.values[key]
                count += 1
        return count

    def scan_iter(self, match, count=500):
        import fnmatch
        for key in list(self.values):
            if fnmatch.fnmatch(key, match):
                yield key

    def pipeline(self, transaction=False):
        return FakePipeline(self)


class RedisCacheTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.row_factory = sqlite3.Row
        self.db.executescript("""
            CREATE TABLE employees(id INTEGER PRIMARY KEY, name TEXT);
            CREATE TABLE raw_daily(employee_id INTEGER, work_date TEXT, status TEXT);
            CREATE TABLE daily(employee_id INTEGER, work_date TEXT, status TEXT);
            CREATE TABLE punches(id INTEGER PRIMARY KEY, happened_at TEXT);
            CREATE TABLE discrepancy_reviews(employee_id INTEGER, work_date TEXT, resolution TEXT);
            CREATE TABLE cloud_adjustment_cache(employee_id INTEGER, work_date TEXT, version INTEGER, after_json TEXT);
            CREATE TABLE attendance_changes(id INTEGER PRIMARY KEY, action TEXT);
            CREATE TABLE devices(id INTEGER PRIMARY KEY, name TEXT);
            INSERT INTO employees VALUES(1, 'Ahmed');
            INSERT INTO raw_daily VALUES(1, '2026-11-02', 'late');
            INSERT INTO daily VALUES(1, '2026-11-02', 'present');
            INSERT INTO punches VALUES(1, '2026-11-02 08:30:00');
            INSERT INTO discrepancy_reviews VALUES(1, '2026-11-02', 'reviewed');
            INSERT INTO cloud_adjustment_cache VALUES(1, '2026-11-02', 1, '{"status":"present"}');
            INSERT INTO attendance_changes VALUES(1, 'update');
            INSERT INTO devices VALUES(1, 'ZKTeco');
        """)
        self.fake = FakeRedis()
        self.cache = RedisCache(url="redis://fake", enabled=True, client=self.fake)

    def tearDown(self):
        self.db.close()

    def test_snapshot_keeps_original_and_effective_data_separate(self):
        result = self.cache.refresh_snapshot(self.db)
        self.assertTrue(result["success"])
        self.assertEqual(result["counts"]["employees"], 1)
        self.assertEqual(result["counts"]["source_daily"], 1)
        self.assertEqual(result["counts"]["effective_daily"], 1)
        raw = json.loads(self.fake.get("attendpro:v1:snapshot:source_daily:000000"))
        effective = json.loads(self.fake.get("attendpro:v1:snapshot:effective_daily:000000"))
        self.assertEqual(raw[0]["status"], "late")
        self.assertEqual(effective[0]["status"], "present")
        meta = json.loads(self.fake.get("attendpro:v1:snapshot:meta"))
        self.assertFalse(meta["original_mdb_write_enabled"])
        self.assertTrue(meta["source_daily_and_effective_daily_separate"])

    def test_refresh_replaces_old_chunks(self):
        self.cache.refresh_snapshot(self.db)
        self.db.execute("INSERT INTO employees VALUES(2, 'Sana')")
        self.cache.refresh_snapshot(self.db)
        manifest = json.loads(self.fake.get("attendpro:v1:snapshot:employees:manifest"))
        self.assertEqual(manifest["records"], 2)


    def test_api_cache_invalidation_and_distributed_lock(self):
        self.cache.set_json('api:dashboard:abc', {'present': 7}, ttl=3600)
        self.cache.set_json('api:employees:def', {'total': 4}, ttl=3600)
        assert self.cache.invalidate_api_cache() == 2
        assert self.cache.get_json('api:dashboard:abc') is None
        assert self.cache.acquire_lock('scheduler:test', 'token-one', 4200) is True
        assert self.cache.acquire_lock('scheduler:test', 'token-two', 4200) is False
        assert self.cache.release_lock('scheduler:test', 'token-two') is False
        assert self.cache.release_lock('scheduler:test', 'token-one') is True

    def test_status_reports_connected_and_snapshot(self):
        self.cache.refresh_snapshot(self.db)
        status = self.cache.status()
        self.assertTrue(status["connected"])
        self.assertEqual(status["snapshot"]["counts"]["raw_punches"], 1)
        self.assertEqual(status["datasets"]["raw_punches"]["records"], 1)
        self.assertEqual(status["datasets"]["raw_punches"]["chunks"], 1)


if __name__ == "__main__":
    unittest.main()
