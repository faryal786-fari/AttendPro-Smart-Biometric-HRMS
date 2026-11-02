# Redis & Scheduler Monitor — Loading Hotfix 2 (2026-11-02)

## Reported issue
The top KPI cards loaded, but the lower Cached Data, Supabase Sync, Connected MDB Devices, and Recent Activity Logs sections remained on Loading. The browser displayed `cloudEnabled is not defined`.

## Fixes in this build
- Renamed the renderer flag to `cloudIsEnabled` and normalized the four API responses before rendering.
- Changed monitor loading from `Promise.all` to `Promise.allSettled`; one failed endpoint no longer prevents the other monitor sections from rendering.
- Each failed monitor API now shows its own error in the relevant panel instead of leaving the panel on Loading.
- The homepage now sends `Cache-Control: no-store` and related headers so the browser does not keep an old inline JavaScript copy.
- Added a build marker: `2026-11-02-redis-monitor-hotfix-2`.

## Preserved
- Original biometric MDB remains read-only and is not modified.
- Supabase authentication, authorization, schema, and existing cloud data logic are unchanged.
- Redis cache structure, hourly scheduler interval, and scheduler run logic are unchanged.
- Existing Employees, Attendance Records, Discrepancies, Reports, Device Status, Settings, System Users, roles, and visual layout are unchanged.

## Apply this version
1. Stop the currently running AttendPro server with `Ctrl+C`.
2. Extract this ZIP into a new folder (do not merge with the older extracted folder).
3. Copy the existing `.env` file into the new folder if you have one; do not share it.
4. Start the app from the new folder using the included `start.sh` or the same command used previously.
5. Open `http://127.0.0.1:8000` and press `Ctrl+Shift+R`.
6. View page source and confirm the build marker is `2026-11-02-redis-monitor-hotfix-2`.

## Verification
The test suite and inline JavaScript syntax check must pass before distribution.
