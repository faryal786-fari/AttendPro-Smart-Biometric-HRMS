# AttendPro Dashboard / Backend Patch — Roman Urdu Guide

## Is patch mein kya update hua hai

1. Staff dashboard par Attendance Date aur Shift filters add kiye gaye hain. Morning, General aur Evening filters selected date ke KPIs, department analysis, recent activity aur attendance graph par apply hote hain.
2. Trainee dashboard par course-wise analysis, attendance distribution aur recent trainee activity add ki gayi hai. Trainee dashboard par biometric device card add nahi kiya gaya.
3. Live Attendance screen mein Staff aur Trainee tabs hain. Dono lists status aur earliest check-in ke mutabiq sort hoti hain.
4. Approved staff OSD ko Present count kiya jata hai. Temporary OSD aur OSD Permanent ki alag lists hain. OSD Permanent sirf staff ke liye hai.
5. Approved Medical Leave ko On Leave count kiya jata hai; isay Absent nahi gina jata.
6. Missing Check-in aur Missing Check-out dashboard cards relevant discrepancy list kholte hain. Supervisor/Admin wahan se Add / Edit Missing Punch kar sakte hain.
7. Employee add/edit aur report filters mein Department, Shift aur Staff directory dropdowns add kiye gaye hain.
8. Employee add ke baad page refresh/login par redirect karne ke bajaye current session mein hi list refresh hoti hai.
9. Leave Management mein New Leave Request, New Leave Announcement aur Public Holiday add karne ke options hain. Leave requests Pending/Approved tabs mein manage hoti hain.
10. Trainee leave types mein Medical Leave aur Outdoor Leave add kiye gaye hain.
11. Reports mein separate Trainee Attendance Report aur CSV export add hua hai.
12. View Only role ko previous calendar day tak limit kiya gaya hai. Is role ko sirf Total Staff, OSD, OSD Permanent, Medical Leave, previous-day attendance aur published leave announcements dikhte hain. Live Attendance aur admin APIs blocked hain.

## Save Marked Rows aur Mark All Present ka matlab

- **Save Marked Rows:** Sirf woh trainee rows save hoti hain jin ka status select kiya gaya ho. Blank / Not Marked rows skip hoti hain.
- **Mark All Present:** Selected date aur shift ke tamam active trainees ko Present mark karta hai. Is se pehle selected Absent, Leave, Outdoor Leave, Medical Rest ya OSD status replace ho sakta hai. Is liye button par confirmation bhi add hai.

## Deployment se pehle zaroori migration

Agar AttendPro Supabase mode mein chal raha hai to Supabase SQL Editor mein ye nayi migration apply karein:

`backend/supabase/migrations/006_dashboard_leave_osd_enhancements.sql`

Migration:
- `pts_osd_records.osd_type` add karti hai.
- `pts_leave_announcements` table banati hai.
- `pts_holidays` table banati hai.
- Existing records ko delete ya overwrite nahi karti.

Local SQLite mode mein startup par app `osd_type` aur announcement/holiday tables ko additive tareeqe se create karti hai.

## Demo data

Production database mein fake rows insert nahi ki gayi hain. Testing ke liye alag demo database banane ke liye:

```bash
python3 backend/scripts/seed_demo_pts.py
```

Default database yahan banegi:

`data/demo/attendance.sqlite3`

Dobara demo data seed karna ho to:

```bash
python3 backend/scripts/seed_demo_pts.py --reset
```

Yeh script production/default database path ko seed karne se mana karti hai. Demo data ko production ya police ke real attendance records ke saath mix na karein.

## Nayi att20002.mdb file

Aapki bheji hui `att20002.mdb` file ko alag private data package mein rakha gaya hai; isay GitHub source patch mein include nahi kiya gaya. File ke internal table-name strings mein `USERINFO`, `CHECKINOUT` aur `DEPARTMENTS` nazar aate hain, jo AttendPro ke existing ZKTeco MDB importer ke expected table names hain. Lekin is environment mein `mdbtools` installed na hone ki wajah se row counts aur actual column-level schema ka final import test nahi hua.

Ubuntu / Ubuntu VM par:

```bash
sudo apt update
sudo apt install -y mdbtools
```

Private data package extract karne ke baad MDB ko project ke `data/source/att20002.mdb` path par rakhein. Phir:

```bash
bash backend/scripts/verify_att20002_mdb.sh data/source/att20002.mdb
```

Iske baad AttendPro ke System / Database / MDB Source Path mein is file ka **absolute path** set karein, pehle Test MDB chalayein, phir backup lene ke baad Sync Now karein. Automatic Sync ko tab tak enable na karein jab tak pehla test aur manual sync successful na ho.

MDB file mein staff data ho sakta hai. Isay GitHub, public ZIP, ya public cloud storage mein upload na karein.

## Git / Original Demo ki safety

Patch apply script:
- `main` branch ko directly overwrite nahi karti.
- Pehle alag feature branch banati hai.
- Changed files ka timestamped backup banati hai.
- Dirty working tree dekh kar ruk jati hai; user ke uncommitted changes ko overwrite nahi karti.
- Backend compile, frontend JavaScript syntax aur pytest checks chalati hai.
- Tests pass hon to feature branch commit aur GitHub par push karti hai.
- `main` par merge automatic nahi karti.

## Test commands

```bash
python3 -m py_compile backend/app.py backend/scripts/seed_demo_pts.py
node --check frontend/src/js/attendpro-app.js
python3 -m pytest -q
```

Supabase migration 006 apply kiye baghair cloud mode mein naye announcement/holiday aur OSD Permanent features production par enable na karein.
