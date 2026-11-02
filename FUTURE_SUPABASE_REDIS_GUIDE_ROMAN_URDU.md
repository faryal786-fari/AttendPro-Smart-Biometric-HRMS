# Supabase + Redis — Phase 1, 2 and 3 implemented

Is version mein existing AttendPro frontend, FastAPI backend aur reports ka layout preserve hai. Supabase PostgreSQL permanent cloud source of truth hai. Redis rebuildable cache hai; original ZKTeco `att2000.mdb` read-only source hai.

## Implemented architecture

```text
ZKTeco -> Existing ZKTeco Software -> att2000.mdb (READ ONLY)
      -> Local Python / mdbtools worker -> Supabase source records
      -> Effective correction overlay -> Redis snapshots/API cache
      -> Existing AttendPro frontend
```

### Phase 1 — Redis snapshot
- Separate original source, raw punch, effective attendance, correction, audit, discrepancy and device snapshots.
- Cache status and Super Admin refresh/inspection APIs.

### Phase 2 — One-hour scheduler + API cache
- Scheduler runs every 3600 seconds minimum.
- Redis distributed lock prevents duplicate scheduled runs across app workers.
- Automatic Sync-enabled MDB files are read-only scanned.
- New source records are persisted to Supabase before Redis refresh.
- Selected authenticated read APIs use a one-hour Redis response cache. Manual writes and scheduled refreshes invalidate cached API responses.
- Scheduler status is available at `/api/scheduler/status`; Super Admin manual test at `POST /api/scheduler/run`.

### Phase 3 — Discrepancy rules and source protection
- Missing check-in/check-out, biometric-not-configured and leave-with-punch conditions are tracked.
- Only an employee explicitly confirmed as `not_configured`, with an original MDB check-in for the current local work date, is automatically marked On Leave in the effective correction layer. Unknown enrollment is never treated as Not Configured.
- Existing human corrections are never overwritten by the automatic rule.
- Automatic actions are labelled `AttendPro Scheduler` in Supabase audit/review rows.
- Source daily attendance, raw punches and the original MDB are never changed by corrections.

## Required setup

1. Run `supabase/002_hourly_cache_and_biometric_discrepancy.sql` after migration 001.
2. Add the Redis and scheduler variables from `.env.example` to your private `.env`.
3. Start Redis locally (`sudo systemctl enable --now redis-server`).
4. Enable Automatic Sync for each device in Device Status.
5. Follow `REDIS_PHASE2_PHASE3_SETUP_ROMAN_URDU.md` for full verification steps.

## Deployment boundary

The scheduler must run on the machine/network that can read the client's MDB. A Render/cloud web host cannot access a local client path such as `/mnt/.../att2000.mdb` directly. For production deployment, the on-prem MDB worker and public web service will be separate processes connected through Supabase and private Redis.
