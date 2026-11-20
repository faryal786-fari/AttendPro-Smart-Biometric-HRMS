# GitHub par AttendPro fixes apply karne ke commands (Ubuntu)

## 1) Fixed ZIP extract karein

```bash
cd ~/Downloads
unzip AttendPro-Smart-Biometric-HRMS-FIXED.zip -d AttendPro-Fixed
```

ZIP extract hone ke baad `AttendPro-Fixed` ke andar project files honi chahiye.

## 2) GitHub repository clone karein (agar pehle se clone nahi ki)

```bash
cd ~/Downloads
git clone https://github.com/faryal786-fari/AttendPro-Smart-Biometric-HRMS.git
cd AttendPro-Smart-Biometric-HRMS
```

Agar repository pehle se local hai to sirf us folder mein ja kar:

```bash
cd ~/Downloads/AttendPro-Smart-Biometric-HRMS
git pull origin main
```

## 3) Pehle safe feature branch banayein

```bash
git switch -c fix/attendpro-dashboard-cache-settings
```

## 4) Fixed project files copy karein

Agar ZIP `~/Downloads/AttendPro-Fixed/` mein extract hui hai:

```bash
rsync -av \
  --exclude='.git/' \
  --exclude='.env' \
  --exclude='.venv/' \
  --exclude='data/' \
  --exclude='*.mdb' \
  --exclude='*.sqlite' \
  --exclude='*.sqlite3' \
  --exclude='__pycache__/' \
  --exclude='.pytest_cache/' \
  ~/Downloads/AttendPro-Fixed/ ./
```

**Important:** `.env`, `data/attendance.sqlite3`, aur original `att2000.mdb` ko overwrite ya GitHub par upload na karein. Apni private files ko current trusted server/local machine par hi rakhein.

## 5) Tests local run karein

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m py_compile app.py cloud_projection.py
python -m pytest -q
```

Expected test result: `63 passed`.

## 6) Changes GitHub par push karein

```bash
git status
git add app.py cloud_projection.py static/index.html \
  supabase/004_persistent_app_settings.sql \
  tests README.md README_CLOUD_FIRST.md \
  SUPABASE_SETUP_ROMAN_URDU.md FIXES_APPLIED_ROMAN_URDU.md \
  GITHUB_COMMANDS_ROMAN_URDU.md
git commit -m "Fix AttendPro dashboard metrics cache and shared settings"
git push -u origin fix/attendpro-dashboard-cache-settings
```

Phir GitHub par Pull Request banayein aur tests dekh kar merge karein.

## 7) Supabase par migration

GitHub par merge karne ke baad Supabase Dashboard → SQL Editor mein pehle se missing migrations ko order mein run karein:

```text
001_attendpro_schema.sql
002_hourly_cache_and_biometric_discrepancy.sql
003_employee_profile_overrides.sql
004_persistent_app_settings.sql
```

Agar 001–003 pehle se successfully run hain to unhein dobara chalane ki zaroorat nahi; sirf 004 run karein.

## 8) Backend environment

Render/backend service ke Environment section mein verify karein:

```text
SUPABASE_ENABLED=1
ATTENDPRO_HTTPS=1
APP_TIMEZONE=Asia/Karachi
REDIS_CACHE_ENABLED=1
REDIS_URL=<your private Redis URL>
SUPABASE_URL=<your Supabase project URL>
SUPABASE_PUBLISHABLE_KEY=<publishable key>
SUPABASE_SECRET_KEY=<server-only secret key>
```

Secrets ko GitHub files, source code, screenshots ya chat mein paste na karein.

## 9) Deploy ke baad verify karein

1. AttendPro mein Super Admin se login karein.
2. Settings → Organization mein value change karke Save karein.
3. Browser refresh karein aur doosre authorized account/browser se verify karein ke same setting show ho.
4. Redis & Scheduler mein Last Completed aur Next Scheduled Run verify karein.
5. Dashboard mein On Leave aur Department Summary numbers verify karein.
6. Device Status par actual MDB path set karke Test MDB aur Sync Now karein.

**Biometric note:** Vercel/Render server ko aapke office ke private ZKTeco device/MDB tak direct access automatically nahi milta. Real MDB sync ke liye AttendPro worker us local/on-prem machine ya secured read-only network mount par chalna chahiye jahan actual `att2000.mdb` available ho.
