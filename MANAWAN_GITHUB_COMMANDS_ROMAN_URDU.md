# GitHub Update Commands — Police College Lahore, Campus II Manawan

> Pehle current repo ka backup/commit bana lein. `.env`, `.git`, `.venv`, MDB/SQLite files aur local data ko overwrite/commit na karein.

## 1) Existing repository mein jaayein
```bash
cd ~/AttendPro-Smart-Biometric-HRMS
git status
```
Agar repo kisi aur folder mein hai to path adjust karein.

## 2) Feature branch banayein
```bash
git switch -c feature/police-college-manawan-landing
```
Agar ye branch pehle se maujood hai:
```bash
git switch feature/police-college-manawan-landing
```

## 3) Updated ZIP extract karein
```bash
cd ~/Downloads
unzip AttendPro-Police-College-Manawan-Updated.zip -d AttendPro-Manawan-Updated
```

## 4) Project files repo mein copy karein
Pehle confirm karein ke extracted folder mein `static/`, `app.py`, `requirements.txt` maujood hain.
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
  ~/Downloads/AttendPro-Manawan-Updated/ ./
```

## 5) Tests run karein
```bash
source .venv/bin/activate 2>/dev/null || true
python -m pytest -q
node --check frontend.js
```
Expected automated test result: `63 passed`.

## 6) Sirf landing page aur guide commit karein
```bash
git status
git diff -- static/index.html | less
git add static/index.html MANAWAN_LANDING_PAGE_UPDATE_ROMAN_URDU.md MANAWAN_GITHUB_COMMANDS_ROMAN_URDU.md
git commit -m "Update public landing page for Police College Lahore Manawan Campus"
git push -u origin feature/police-college-manawan-landing
```

## 7) GitHub PR
GitHub par `main` ke against Pull Request create karein. Changes review karke merge karein.

## 8) Vercel
- Vercel mein latest production deployment `main` branch se trigger honi chahiye.
- Existing Root Directory, `static/vercel.json`, build settings aur API rewrites ko bina wajah change na karein.
- Deployment `Ready` hone ke baad website ko hard refresh (`Ctrl + Shift + R`) karein.

## Important
Is update mein koi nayi Supabase migration, Redis setting, scheduler setting ya secret environment variable required nahi. Live deployment ke baad portal login aur `/#portal=reports` ko verify karein.
