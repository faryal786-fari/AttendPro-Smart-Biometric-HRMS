# AttendPro — Supabase Cloud Integration (Roman Urdu)

**Yeh project asli AttendPro HTML/CSS/JS design aur FastAPI backend ko preserve karta hai.**
Cloud mode ON hone par Supabase Auth login aur PostgreSQL records use hote hain.
Client ki asli `att2000.mdb` **read-only** hai; na ZKTeco machine, na Att.exe, na MDB ko code modify karta hai.

## 0) Aapko kya chahiye?

- Supabase account aur ek **naya project** (`attendpro-hrms`)
- Aapke project ki publishable + secret API keys, project URL (keys **chat mein share mat karein**)
- Ubuntu/Windows network par ZKTeco ki current live MDB ka **read-only access**
- Python 3.10+, internet access, Ubuntu par `mdbtools` if reading MDB
- Client ki approval to host attendance/employee records in cloud

**IMPORTANT:** Is ZIP ke andar real Supabase credentials nahi hain; client ke Supabase project par live testing aapko karni hogi. Default offline `admin/admin123` Supabase cloud mode mein **bilkul accept nahi hoga**.

## 1) Supabase project banayein

1. https://supabase.com/dashboard kholein → **New Project**.
2. Project Name: `attendpro-hrms`; strong DB password aur suitable region select karein.
3. **Authentication → Providers / Sign In → Email** enable karein.
4. Public self-signup disable karein. Sirf Super Admin backend se accounts create karega.
5. **Authentication → URL Configuration**: development Site URL `http://127.0.0.1:8000`.
   Production mein real HTTPS domain use hoga.
6. **Settings → API Keys** se `sb_publishable_...` aur `sb_secret_...` keys copy karein.
   Secret key **sirf Python server** par honi chahiye, frontend/GitHub par nahi.

## 2) SQL schema banayein (YEH PEHLE KARNA HAI)

1. Supabase Dashboard → **SQL Editor → New query**.
2. `supabase/001_attendpro_schema.sql` ka **poora text** copy-paste karke **Run** karein.
3. Table Editor mein check karein:
   - `attendpro_employees`, `attendpro_source_daily`, `attendpro_raw_punches`
   - `attendpro_corrections`, `attendpro_correction_audit`
   - `attendpro_app_users`, `attendpro_discrepancy_reviews`
   - `attendpro_devices`, `attendpro_biometric_audit`
4. SQL RLS ENABLE karta hai aur `anon`/`authenticated` ka direct table access **deny** rakhta hai.
   FastAPI server roles verify karke secure secret key se data access karega.

**Kabhi** public/anon ko unrestricted attendance tables ki access na dein.

## 3) Ubuntu mein project extract aur credentials

```bash
cd ~/Downloads
mkdir -p AttendPro_Supabase
unzip AttendPro_Supabase_Auth_Original_Protected.zip -d AttendPro_Supabase
cd AttendPro_Supabase
sudo apt update
sudo apt install -y python3-venv python3-pip mdbtools
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
chmod 600 .env
nano .env
```

`.env` mein REAL values fill karein:

```env
SUPABASE_ENABLED=1
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
APP_TIMEZONE=Asia/Karachi
ATTENDPRO_HTTPS=0
```

`.env` upload, git commit, WhatsApp, ya screenshot mein share **mat** karein.

## 4) Super Admin Supabase Auth mein banayein

```bash
python scripts/setup_admin.py --email admin@YOUR-COMPANY.com --name "Admin Rehman"
```

Terminal strong password do baar securely maangega. Password **print** nahi hota.
Script Supabase **Auth user + attendpro_app_users Super Admin role** create karega.
Uske baad **System Users** page se Supervisor aur View Only accounts create karein;
Cloud mode mein "Username" field mein **email address** dena hota hai.

### Role table

| Kaam | View Only | Supervisor | Super Admin |
|---|---|---|---|
| View Dashboard / Employees / Reports | Yes | Yes | Yes |
| CSV / Excel Export / Print | Yes | Yes | Yes |
| Correct attendance, check in/out | No | Yes | Yes |
| Resolve discrepancy | No | Yes | Yes |
| Employee creation, devices, users | No | No | Yes |

Permissions server par enforce hote hain, sirf button hide karna security nahi.

## 5) Historical 731 employees / old Excel data Supabase mein migrate karein

Project mein pehle se `data/attendance.sqlite3` mein imported historical attendance hai.
**Dry run** (cloud ko data write nahi karega):

```bash
python scripts/migrate_local_data.py
```

Jo counts show hon, unhein verify karein. Phir:

```bash
python scripts/migrate_local_data.py --upload
```

Supabase **Table Editor** mein source counts match karein. Upload idempotent hai.
`att2000.mdb` is command mein **open bhi nahi hoti**.

Agar previous local manual edits `source=local_edit` detected hain, script safety ke liye ruk jayegi.
Pehle un edits ko separately reconcile/migrate karein, warna original-versus-correction history kharab ho sakti hai.

## 6) Dashboard start aur login

```bash
bash start.sh
```

Browser → http://127.0.0.1:8000

Login mein **Supabase admin email + Supabase password** enter karein.
Topbar mein "Supabase Mode" nazar aayega. Sirf yeh text cloud upload complete hone ka proof nahi hai.
Authenticated browser mein yeh endpoint kholein:

`http://127.0.0.1:8000/api/cloud/status`

`pending_source_upload = false`, `cloud_pull_error = ""` check karein.

## 7) Live MDB ka connection

ZKTeco old software → `att2000.mdb` (original safe / unchanged)

**AttendPro → Device Status** mein wahi real `.mdb` path set karein jise client software update kar raha hai.
`Test MDB`, phir `Sync Now`, phir `Automatic database sync` enable karein.

Ubuntu par MDB reader install: `sudo apt install mdbtools`.

Agar MDB Windows PC par hai aur AttendPro Ubuntu par chal raha hai, to **read-only SMB/CIFS mount** ya Windows-side local sync agent zaroori hoga. Sirf copied MDB file se live updates nahi aayengi.

Data flow:

```text
ZKTeco device → old ZKTeco software → EXISTING att2000.mdb (read-only)
                                        ↓
                     MDBTools/Python (read-only import)
                                        ↓
                 SQLite read projection + retry state
                                        ↓
                   Supabase employees + source_daily
                   Supabase IMMUTABLE raw_punches
                                        ↓
                 Supabase corrections (separate records)
                                        ↓
                         AttendPro reports/dashboard
```

**Agar internet disconnect ho:** incoming MDB sync local read model mein record save kar sakta hai aur
`cloud_replication_state.pending` = 1 se retry karega. Cloud source confirm hone se pehle
stale cloud snapshot local pending attendance par overwrite nahi kiya jayega.
**Supervisor/Admin manual edits** internet/cloud unavailable hone par 503 fail hongi; false success show nahi hogi.

## 8) Supervisor attendance correction ka actual workflow

1. Supervisor **Attendance Records → Review/Update** open kare.
2. Clock In/Out, Status ya Timetable correction kare.
3. **Reason** zaroor enter kare; **Save Update**.
4. FastAPI Supabase identity/role verify karta hai.
5. Supabase `attendpro_save_correction` RPC **one transaction** mein:
   - `attendpro_corrections` effective adjustment upsert,
   - `attendpro_correction_audit` immutable history INSERT.
6. Success ke baad local UI cache change hota hai; report refresh par corrected value show hoti hai.
7. **Original / Audit** button se original data, effective data, raw punches aur cloud audit alag dekhein.

**Original `.mdb` / raw_punches unchanged.** Agar Supabase save fail ho to edit reject hoti hai.

## 9) Report preview aur Excel file difference

- **Report Preview:** Supervisor/Admin Clock In, Clock Out, Timetable, Status fields ko edit kare →
  **Save Changes to Supabase** → reason enter kare → confirmation → per-record audited cloud updates.
- **Export CSV / Excel:** local exported file edit karne se **automatic cloud update NAHI hoti**.
- Future Excel re-import/approval flow alag phase mein implement karna hoga.
- Batch save per-row transaction hai; agar 10 mein se 2 fail ho to baqi 8 saved rahenge;
  frontend explicitly failure count dikhata hai. Bulk all-or-nothing transaction abhi implemented nahi.

## 10) Cloud mode vs local mode

- `.env` mein `SUPABASE_ENABLED=1` = Supabase Auth + Supabase manual corrections + cloud source sync.
- Cloud key absent/misconfigured = start.sh cloud mode mein error; **local admin fallback nahi**.
- `.env` nahi hai = legacy LOCAL demo mode (old login and SQLite). Public network mein default local demo deploy MAT karein.
- Existing frontend HTML/CSS, sidebar, employee View popup, device cards aur reports same hain.

## 11) Redis + one-hour scheduler + discrepancy protection

Phase 1/2/3 ab project mein included hain. `supabase/002_hourly_cache_and_biometric_discrepancy.sql` ko migration 001 ke baad Supabase SQL Editor mein run karein.

Ubuntu par Redis start karein:

```bash
sudo systemctl enable --now redis-server
redis-cli ping
```

`.env` mein `REDIS_CACHE_ENABLED=1`, `REDIS_URL=redis://127.0.0.1:6379/0`, `ATTENDPRO_HOURLY_SCHEDULER_ENABLED=1`, `ATTENDPRO_MDB_SCHEDULER_INTERVAL_SECONDS=3600` aur `ATTENDPRO_AUTO_LEAVE_UNCONFIGURED_BIOMETRIC=1` set karein.

Device Status mein MDB path set karke Test MDB karein aur Automatic database sync enable karein. Scheduler kam az kam har 3600 seconds baad MDB ko read-only scan karta hai. Redis distributed lock duplicate jobs ko rokta hai. Source data Supabase confirm hone ke baad Redis snapshot/API cache refresh hota hai.

Authenticated browser mein scheduler status:

`http://127.0.0.1:8000/api/scheduler/status`

Full setup aur discrepancy conditions ke liye `REDIS_PHASE2_PHASE3_SETUP_ROMAN_URDU.md` dekhein.

Automatic On Leave exception sirf tab apply hoti hai jab employee ko explicitly Not Configured mark kiya gaya ho aur usi current work date par original MDB check-in punch maujood ho. Unknown enrollment par leave auto-create nahi hoti. Existing human correction overwrite nahi hoti. Original MDB/source punches unchanged rehte hain.

## 12) Deployment security


- Production mein HTTPS/TLS domain + `ATTENDPRO_HTTPS=1` + `ATTENDPRO_PUBLIC_ORIGIN=https://domain.com`.
- `.env` private permissions: `chmod 600 .env`.
- Supabase secret key kabhi browser/JavaScript/HTML ko mat dein.
- RLS schema direct table access deny rakhta hai; test roles and denial in Supabase environment.
- Add automatic DB backups, staging tests, access logging, rate limiting and real browser tests before client production deployment.
- ZKTeco software live MDB readable rahe; **write permission sirf original ZKTeco software** ko ho.
- Supabase outage par imports pending hon to `/api/cloud/status` check karein.

**Reality check:** Is package ke offline automated tests pass hain, lekin aapke Supabase project ke URL/keys aur real live MDB bina cloud authentication/DB connection ko end-to-end verify nahi kiya ja sakta.
