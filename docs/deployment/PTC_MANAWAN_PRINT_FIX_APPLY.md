# PTC Lahore Manawan — Master Report Print Fix

This patch restores the master attendance report print workflow without changing the PTC Manawan trainee backend, Supabase schema, authentication, or existing attendance data.

## Why the errors happened

1. The Manawan landing-page update replaced `frontend/index.html` with a version that did not carry forward the earlier master-template print implementation. The existing `tests/test_master_template_print.py` still checked for that feature, so five print-related tests failed.
2. SQL such as `SELECT ... FROM information_schema.tables` was pasted into the Ubuntu Bash terminal. SQL must be run in the PTC Lahore Supabase Dashboard → SQL Editor. Bash interprets `SELECT` as a shell command and returns `SELECT: command not found`.

## What this patch fixes

- Adds a dedicated `#printTemplateRoot` and a print-only CSS rule. The dashboard is hidden during printing; only the generated report is visible.
- Recreates the two supplied workbook views in the print layout:
  - Summary sheet: Police Training Collage, Biometric Absent, Biometric Late Arrivals, Early Departure, missing check-in / check-out sections.
  - Attendance sheet: AC-No., Name, Date, Timetable, Clock In, Clock Out, Absent, Department.
- Routes report print buttons through `printMasterAttendanceReport()` instead of printing the entire dashboard.
- Preserves the filtered detail rows separately from summary rows, so print and the supplied Excel template export use the same filtered source data.
- Updates the regression test's expected build ID to the current Manawan print-fix build.

## Apply on Ubuntu

Run these commands from the existing project folder. Do not create a new branch if you are already on `feature/ptc-lahore-manawan-training-portal`.

```bash
cd ~/Downloads/AttendPro-Smart-Biometric-HRMS

# Keep a copy of the current page before applying the patch.
cp frontend/index.html "$HOME/Downloads/index.html.before-ptc-print-fix"

mkdir -p "$HOME/Downloads/PTC-Manawan-Print-Fix"
unzip -o "$HOME/Downloads/PTC-LAHORE-MANAWAN-PRINT-FIX.zip" \
  -d "$HOME/Downloads/PTC-Manawan-Print-Fix"

rsync -av "$HOME/Downloads/PTC-Manawan-Print-Fix/" ./ \
  --exclude='.git/' --exclude='.env' --exclude='.venv/' \
  --exclude='data/' --exclude='*.sqlite' --exclude='*.sqlite3' \
  --exclude='*.mdb' --exclude='__pycache__/'
```

## Validate

```bash
source .venv/bin/activate
python -m pytest -q tests/test_master_template_print.py
python -m pytest -q tests/test_pts_training.py tests/test_frontend_contract.py tests/test_hosted_integration_fix.py
python -m py_compile app.py cloud_projection.py
node --check frontend.js
git diff --check
git status --short
git diff --stat
```

For the inline JavaScript in `frontend/index.html`, validate it separately:

```bash
python - <<'PY'
import re
from pathlib import Path
html = Path('frontend/index.html').read_text()
scripts = re.findall(r'<script(?:\\s[^>]*)?>(.*?)</script>', html, re.I | re.S)
Path('/tmp/ptc-inline-check.js').write_text('\n'.join(scripts))
PY
node --check /tmp/ptc-inline-check.js
```

## Commit and push

Review `git diff` first. Then:

```bash
git add frontend/index.html tests/test_master_template_print.py tests/test_frontend_contract.py PTC_MANAWAN_PRINT_FIX_APPLY.md
git commit -m "Restore PTC Manawan master attendance report printing"
git push
```

This pushes the fix to the current feature branch. Merge its Pull Request into `main` after review so Vercel deploys the updated static page.

## Supabase SQL reminder

Do not type SQL statements into Bash. If the five `pts_*` tables are already visible in the PTC Lahore Supabase project, the migration is already present and does not need to be run again. To inspect them, open Supabase Dashboard → SQL Editor, paste the `SELECT` query there, and click **Run**. Do not run migration `005` in Farooqabad's database.
