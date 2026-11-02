# NEW: Supabase Auth + Cloud Corrections version

**READ FIRST:** `SUPABASE_SETUP_ROMAN_URDU.md` and `README_CLOUD_FIRST.md`.
Original AttendPro design is retained. Original att2000.mdb is NEVER written.

---

# AttendPro — Merged ZKTeco Attendance Dashboard

This package preserves the supplied AttendPro HTML layout and connects it to a FastAPI + SQLite read-model with a read-only Microsoft Access MDB bridge.

## Included features
- Existing dashboard layout, responsive styling, and dark/light mode.
- Multiple named MDB device configurations, sidebar switching, device status cards, info buttons, test/sync controls, and per-device automatic sync settings.
- Employee Directory sorted by employee name.
- Attendance Records with the supplied report fields, filters, expandable employee history, and review/update actions.
- Three user roles: View Only User, Supervisor, Super Admin. The backend enforces role restrictions.
- Report preview with local-copy cell editing, CSV export, print, and editable Excel export based on the supplied Police Training College workbook template.
- In Supabase mode, approved supervisor/admin attendance corrections are stored in Supabase correction and audit tables. Exported Excel files remain separate until explicitly re-imported. The original `att2000.mdb` is never written by this app.

## Run on Ubuntu
```bash
sudo apt update
sudo apt install -y python3-venv python3-pip mdbtools libreoffice
cd /path/to/AttendPro_Merged_Project
bash start.sh
```
Open `http://127.0.0.1:8000`.

## First login
- Username: `admin`
- Password: `admin123`

Change this default password after first login. User accounts are managed from **System Users**.

## Multiple devices
Add devices from **Device Status → Add Device**. Each device has a name, model, serial number, MDB path, status, and sync interval. Switching devices changes which device's configuration Test MDB and Sync Now operate on. The local attendance read-model combines imported attendance data; if all terminals share one central `att2000.mdb`, use the central live file rather than making stale copies.

## Access MDB behavior
The source MDB is read-only. `tools/access_live.py` reads it with Ubuntu `mdbtools` and writes normalized source records to the separate `data/attendance.sqlite3` read-model. In Supabase mode, original source rows are confirmed in Supabase before Redis is refreshed. If the source MDB is on Windows, use a secured read-only network share mounted on Ubuntu. A copied or old MDB will not show new punches. When the hourly scheduler is enabled, automatic MDB scans run every 3600 seconds minimum; manual Sync Now remains available.

## Report template
`templates/attendance_report_template.xlsx` is converted from the supplied `26.10.2026(1).xls` template; `templates/attendance_report_original.xls` is included for reference. Excel export creates an editable `.xlsx` file using the same two-sheet layout. Editing an exported workbook does not write changes back to the main attendance database or the source MDB.

## Historical data
The bundled SQLite database includes the supplied historical attendance workbook for 26 October 2026. Historical sample totals are not proof of a live device connection; use Test MDB and Sync Now on the client's actual source.


## Layout Update — Blue Sidebar + White Workspace (same A-Z project)

Yeh updated build **AttendPro_AZ_Employee_Profiles_Live_Dashboard.zip** ka hi existing frontend aur backend hai; sirf layout controls add kiye gaye hain.

1. Top bar mein **☰** click karein: blue left menu compact ya expanded ho jayega.
2. Blue aur white section ke darmiyan thin border ko **mouse se drag** karein: blue sidebar ki width change hogi aur right white workspace automatically stretch/shrink hoga.
3. Divider ko **double-click** karein: default 240px width restore ho jayegi.
4. Top bar mein **⛶** dabayein: blue menu hide aur white workspace full window width ho jayegi. Dobara dabayein to menu restore hoga.
5. Size settings browser mein save rahengi. Mobile par menu compact dikhega.

**Baqi sab same:** employee directory default A–Z, employee in-row profiles/history, bigger donut, flat attendance records, dark mode, reports, roles, multi-device support, aur existing FastAPI/SQLite/MDB sync.

**Important:** Browser se `attendance-proto-original.html` open na karein. Always `bash start.sh` chala kar `http://127.0.0.1:8000` open karein.

## Employee names only + half-screen resizable layout (2026-10-29)

- The **Employees** table shows **names only** (no visible ID/department/status columns).
- Names are alphabetically sorted by a cleaned **display-only** name. Common rank/service prefixes and trailing service numbers are removed from the **visible list only**. Original stored employee names and IDs are preserved without modification; the original source label is available in the expanded profile.
- Click any name or chevron to expand **nine profile fields** and that employee's saved attendance history immediately below the name. **Attendance Records** stays a flat table.
- Search from either the top bar or the Employees search box. Top-bar name searching resets old department/status filters. **Clear Filters** restores the full list.
- The blue sidebar can be drag-resized up to **50% of the current window width**, with an automatically resizing white workspace. Existing collapse, full-workspace and dark mode controls are retained.
- **+ Add Employee** lets Super Admin create an employee in the separate AttendPro local SQLite database. New manually added employees are **not** enrolled on the biometric machine and are not written to the original MDB.

This project is a read-only bridge from existing `att2000.mdb` to a local application database. The live Access database still must be reachable and updated by the client's existing ZKTeco software; no real network connection was verified in this build.


## Latest targeted update — Discrepancies + Employees View popup

- People → Employees is back to the original multi-column table, with names sorted alphabetically by their cleaned display name; click **View** to open a modal, not an in-row dropdown. Employee IDs remain in their own column.
- People → Discrepancies is a new case list for check-in without check-out, check-out without check-in, confirmed biometric enrollment issues, and leave records that overlap attendance punches.
- Supervisor and Super Admin can resolve discrepancies with an audit note. View Only users can review without editing. Original ZKTeco MDB is always read-only.
- Biometric enrollment is **unknown** by default; ZKTeco CHECKINOUT does not prove enrollment state. The automatic On Leave exception runs only after a Supervisor/Super Admin explicitly confirms `Not Configured` and an original MDB check-in exists for the current work date. Unknown status never triggers leave.
- Supabase Auth/PostgreSQL integration remains the permanent cloud data/auth layer. Redis stores rebuildable snapshots and one-hour read-through API responses.
- Phase 2 hourly scheduler reads configured Automatic Sync-enabled MDB devices no more frequently than once per hour, uses a Redis distributed lock, and refreshes cache only after Supabase confirms source data.
- Phase 3 discrepancy/correction rules keep original source punches and human corrections separate. Existing human corrections are never overwritten by the automatic exception.
- Run `supabase/002_hourly_cache_and_biometric_discrepancy.sql` after migration 001. Full steps: `REDIS_PHASE2_PHASE3_SETUP_ROMAN_URDU.md`.
- Further employee/discrepancy explanation: `DISCREPANCIES_AND_EMPLOYEES_ROMAN_URDU.md`.

## Redis & Scheduler Monitor (latest update — 2026-11-02)

A separate **System → Redis & Scheduler** page shows Redis connection health, cache key count, API TTL, snapshot dataset counts/chunks, scheduler status and timing, Supabase source-sync status, MDB device sync state, and the latest operational activity logs. Status refreshes automatically every 30 seconds while this page is open.

- **Refresh Status** is read-only and available to all roles.
- **Refresh Redis Cache**, **Run Scheduler Now**, and cached-record sample preview are Super Admin only.
- Activity history is a bounded local operational log (latest 100 events) in AttendPro's application SQLite settings table; it is not written to the original biometric MDB.
- See `REDIS_MONITOR_GUIDE_ROMAN_URDU.md` for the simple user guide and API list.


## Redis Monitor Loading Hotfix 2 (2026-11-02)
This build fixes the reported `cloudEnabled is not defined` monitor rendering error, isolates monitor API failures so other panels still load, and disables browser caching for the homepage. After extracting this ZIP, stop the old server, run the app from the new folder, then hard-refresh the browser (`Ctrl+Shift+R`). Confirm page source contains build marker `2026-11-02-redis-monitor-hotfix-2`.
