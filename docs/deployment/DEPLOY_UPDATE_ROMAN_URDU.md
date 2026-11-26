# AttendPro — Hosted UI + Authentication Fix (2026-11-03)

This ZIP is **source code only**. It intentionally excludes real attendance data, Microsoft Access MDB files, local SQLite records, `.env` files, and API secrets.

## Changes
- Vercel-to-Render POST authentication: exact-origin allowlist; unknown origins still rejected.
- Protected APIs still return HTTP 401 to requests without a valid authenticated session. This is intentional.
- Supabase Auth remains the exclusive cloud login and user creation mechanism. Only Super Admin creates user accounts (no public self-registration).
- All native browser alert/confirm/prompt calls removed from the served `frontend/index.html`; messages use app-owned toast/dialog UI.
- Login errors appear in the login form; notifications panel appears at top-right; generic notices appear at bottom-right.
- Dashboard Department Summary now has its own vertical scroll.
- View Records filters attendance to the selected employee (last 90 days by default). Clear Filters returns to all records.
- Edit Details now opens an authenticated profile editing form. In cloud mode Super Admin edits are saved to a separate Supabase table so future biometric source imports do not overwrite those profile edits.
- Original biometric MDB is never written. Attendance manual corrections continue to use the existing correction + audit workflow.

## 1) Supabase migration (required for cloud employee profile editing)
1. Open your Supabase project → SQL Editor → New Query.
2. Paste **only** the contents of `backend/supabase/migrations/003_employee_profile_overrides.sql`.
3. Run it once. This creates the separate HR profile overlay table, with row-level security and no anonymous access.
4. Do not rerun migration 001/002 unless necessary. Keep original source tables and source MDB unchanged.

## 2) Render Backend → Environment
Verify these (do not post real values publicly):
```
SUPABASE_ENABLED=1
SUPABASE_URL=<your-project-url>
SUPABASE_PUBLISHABLE_KEY=<your-key>
SUPABASE_SECRET_KEY=<server-secret-only>
REDIS_CACHE_ENABLED=1
REDIS_URL=<Render-Redis-Internal-URL>
ATTENDPRO_HTTPS=1
ATTENDPRO_PUBLIC_ORIGIN=https://attendpro-smart-biometric-hrms-stat.vercel.app
ATTENDPRO_ALLOWED_ORIGINS=https://attendpro-smart-biometric-hrms-stat.vercel.app,https://attendpro-smart-biometric-hrms.onrender.com
```
Do **not** create duplicate keys and do **not** put secrets in the frontend or GitHub.

Render → Web Service → Manual Deploy → Deploy latest commit, or allow GitHub auto-deploy.

## 3) Vercel frontend
Vercel Root Directory must remain `static`, Framework Preset `Other`.
`static/vercel.json` forwards relative `/api/*` requests to the Render backend.
The frontend does not need the Redis URL or Supabase secret key.

GitHub push steps from your local working folder (after copying the changed source files into it):
```
git status --short
git add app.py cloud_projection.py frontend/index.html static/vercel.json backend/supabase/migrations/003_employee_profile_overrides.sql tests
git commit -m "Fix hosted login, in-app notifications and employee profile editing"
git push origin main
```
Ensure `.gitignore` excludes `.env`, `.env_error_backup`, `data/`, MDB, SQLite and other backups. Never commit secrets.

## 4) Authenticated cloud verification
1. Visit: https://attendpro-smart-biometric-hrms-stat.vercel.app/
2. Login with a real, active **Supabase Auth user email** and password. The user must also have an active entry in `attendpro_app_users`.
3. Browser DevTools (F12) → Network → Fetch/XHR: `POST /api/auth/login` must be 200.
4. Authenticated `GET /api/auth/status` must report `authenticated:true, mode:supabase`.
5. Open Redis & Scheduler Monitor. Verify **Connected**, snapshot count, last successful sync, scheduler status and no cloud pull errors.
6. Open Employee Profile > Edit Details as **Super Admin**. Save a test value; verify a row in the Supabase `attendpro_employee_profile_overrides` table.
7. Open a profile > View Records; only the selected employee should appear. Use Clear Filters to restore all.
8. Notification bell opens the top-right in-app panel. Save operations show bottom-right toasts. No browser native alerts.

`GET /api/health`, `/api/cache/status`, `/api/scheduler/status` can return HTTP 401 if checked without logging in. This is correct secure behavior. If login still returns HTTP 403 after deploying the new code, inspect the Render logs. If the error says the user is not enabled, verify both Supabase Auth user and `attendpro_app_users` profile are active.

## 5) Limits and source data
- Render Free Web Service can sleep on inactivity; an in-process hourly scheduler is **not** a reliable 24/7 scheduler on Free.
- Render free local filesystem is ephemeral. Local SQLite is a read projection; Supabase is the durable cloud store for existing cloud-synced data and manual corrections.
- The original office `.mdb` is not reachable from Render by default. Source updates require an office-side read-only MDB sync agent or another authorized source synchronization path.
- This package has not been authenticated against your private Supabase instance or live Render/Redis services. Local tests check source behavior, not production connection health.

## Preservation of existing data
This ZIP has no `data/attendance.sqlite3` deliberately. On a local install, copy only the source-code changes into your existing working folder; do not replace, delete, overwrite or upload the local `data/` folder. Back it up before updates. On Render, use Supabase for permanent data rather than expecting `data/` to persist.
