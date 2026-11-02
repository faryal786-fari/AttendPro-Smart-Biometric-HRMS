# AttendPro — Supabase Auth + PostgreSQL

This extends the existing AttendPro prototype. The existing HTML/CSS/JS frontend and FastAPI APIs remain intact.

## What is included
- Supabase Auth email/password login and server-side role authorization
- Backend-only `sb_secret` use; no privileged credentials in the frontend
- Cloud PostgreSQL tables for employees, original daily attendance and immutable raw punches
- Separate cloud corrections with a transactional immutable audit trail
- Discrepancy resolution and biometric-enrollment audit RPCs
- Original source/effective record comparison in the attendance Review/Update UI
- Explicit **Save Changes to Supabase** action in report previews
- Idempotent historical migration and incremental source-upload retry ledger
- Cached SQLite projection for compatibility with the original dashboard

## Files
- `supabase/001_attendpro_schema.sql`: schema, RLS, server-only RPCs and audit protection
- `cloud_service.py`: HTTPS Supabase Auth and PostgREST client
- `cloud_projection.py`: cloud/source projection and retry-safe ingestion
- `scripts/setup_admin.py`: one-time secure Super Admin Auth bootstrap
- `scripts/migrate_local_data.py`: historical SQLite → Supabase upload
- `.env.example`: safe configuration template **without real credentials**
- `SUPABASE_SETUP_ROMAN_URDU.md`: full steps in Roman Urdu

## Modes
- `SUPABASE_ENABLED=1`: cloud Auth, cloud original/adjustments, cloud role management.
- No `.env`: legacy local demo mode (NOT appropriate for deployment).

## Current boundaries
- **att2000.mdb is never written**. Device MDB paths and the local import scheduler remain on the machine with access to MDB.
- Cloud UI reads a periodically refreshed local SQLite projection; this is not WebSocket push streaming.
- Redis is optional for local reads; Phase 2 adds a one-hour scheduler and one-hour read-through API cache.
- The offline test suite does not prove compatibility with your production Supabase project or live Microsoft Access MDB.


## Redis Phase 1 + Phase 2 + Phase 3

Redis stores separate snapshot chunks for employees, original source attendance, effective attendance,
raw punches, discrepancy reviews, correction overlays, audit events, and devices. Selected authenticated
GET APIs also use a one-hour read-through response cache. Successful writes and scheduled refreshes
invalidate that response cache.

The hourly on-prem scheduler reads configured/Automatic Sync-enabled MDB devices no more frequently
than once per hour, uses a Redis distributed lock, uploads original source data to Supabase, applies the
explicit biometric exception rule, pulls current cloud corrections, and refreshes Redis. See
`REDIS_PHASE2_PHASE3_SETUP_ROMAN_URDU.md` for the required Supabase migration 002 and `.env` settings.
The original MDB remains read-only.
