# AttendPro — Tech Stack aur Workflow (Roman Urdu)

## Technology Stack
- Frontend: user supplied AttendPro HTML, CSS, vanilla JavaScript; pure SVG attendance donut chart; custom responsive design; dark/light mode. React ya Node.js runtime required nahi.
- Backend: Python 3 + FastAPI + Uvicorn (HTTP/JSON REST API).
- Live attendance source: client ka existing ZKTeco Att.exe / old software `att2000.mdb` (Microsoft Access). `mdbtools` utility se read-only `USERINFO`, `CHECKINOUT`, `DEPARTMENTS` tables.
- Permanent cloud data/auth: Supabase PostgreSQL + Supabase Auth. Original source rows, raw punches, manual corrections, discrepancy decisions aur audit yahan separate store hote hain.
- Local read projection: SQLite `data/attendance.sqlite3`; Redis rebuildable snapshots aur one-hour API response cache. Redis permanent attendance database nahi.
- Scheduler: FastAPI background hourly loop + Redis distributed lock. Automatic Sync enabled MDB devices ko minimum 3600 seconds ke interval par read-only scan karta hai.
- Excel output: openpyxl se XLSX, CSV report. User ka original XLS historical import ke liye use hota hai.
- Auth: role-based accounts, local session cookie, View Only / Supervisor / Super Admin; initial password replace karein.

## Live Data Flow
Biometric Machine -> Existing ZKTeco Software -> Client ki LIVE att2000.mdb -> Python MDB reader (read-only, hourly scheduler) -> Supabase source tables -> local SQLite read projection -> Redis snapshot/API cache -> REST API -> existing browser dashboard / employees / reports.

- Scheduler ka interval 3600 seconds minimum hai. Device par Automatic Sync enable hona chahiye. Manual Sync Now existing tarah available hai. 'Online' ka matlab successful MDB read/sync hai, machine ki network reachability ka proof nahi.
- Human corrections aur automatic discrepancy decisions Supabase correction/audit layer mein jate hain; original MDB, raw punches aur source daily rows unchanged rehte hain.
- New punches SQLite mein duplicate se protected hain. Date/employee filters API queries se refresh hote hain.
- Present/Absent/Late sirf existing data aur configured attendance rules se derive hote hain; missing punches hamesha confirmed absent nahi hote.
- Excel preview mein edit karna report copy ko affect karta hai; exported workbook edit karne se automatic database update nahi hoti. AttendPro ke Save Changes action se approved manual correction Supabase mein audit ke saath save hoti hai. Original MDB mein write-back nahi hota.

## Employee UI
People > Employees -> real `/api/employees` -> Name A–Z default -> click Name/View -> GET `/api/employee/{id}` -> 9 identity fields and latest 15 history rows expand **Employees screen mein**. Attendance Records se dropdown removed, action remains.

## Important limitation
Att.exe Access DB ko har punch par turant update karta hai ya sirf manual 'Download logs' par — yeh client site par verify karna zaroori hai. Jab tak Access file update nahi hoti tab tak dashboard par new punches nahi aa sakte. Backend `mdbtools` Linux par install karna hota hai. Original MDB read-only, backups zaroor rakhein.

## Redis scheduler / discrepancy rule

- Selected authenticated GET APIs one-hour Redis response cache use karti hain. Successful writes aur hourly source refresh cache invalidate karte hain.
- Hourly worker pehle original MDB ko read-only scan karta hai; Supabase source upload confirm hone ke baad Redis snapshots refresh hoti hain.
- Employee biometric status `not_configured` sirf tab auto On Leave rule trigger karta hai jab current work date par original MDB check-in punch bhi exist kare. `unknown` status kabhi auto leave trigger nahi karta.
- Existing manual correction ko automatic rule overwrite nahi karta. Original source attendance aur raw punch evidence alag rehta hai.
- Full steps aur SQL migration 002: `REDIS_PHASE2_PHASE3_SETUP_ROMAN_URDU.md`.
