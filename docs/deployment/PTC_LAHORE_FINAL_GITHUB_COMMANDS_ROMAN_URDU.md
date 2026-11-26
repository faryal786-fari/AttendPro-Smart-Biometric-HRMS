# GitHub Commands — Police Training College Lahore Landing Page

## 1. Repository folder open karein
```bash
cd ~/Downloads/AttendPro-Smart-Biometric-HRMS
git status
git branch --show-current
```

## 2. ZIP extract karein
```bash
cd ~/Downloads
unzip -o AttendPro-PTC-Lahore-Final.zip -d AttendPro-PTC-Lahore-Final
```

## 3. Updated files apni existing repository mein copy karein
```bash
cd ~/Downloads/AttendPro-Smart-Biometric-HRMS

rsync -av \
  --exclude='.git/' \
  --exclude='.env' \
  --exclude='.venv/' \
  --exclude='data/' \
  --exclude='*.mdb' \
  --exclude='*.sqlite' \
  --exclude='*.sqlite3' \
  --exclude='__pycache__/' \
  ~/Downloads/AttendPro-PTC-Lahore-Final/ ./
```

## 4. Confirm karein ke photos copy ho gayi hain
```bash
ls -lh frontend/index.html
ls -lh frontend/assets/ptc-lahore-building-reference.jpg
ls -lh frontend/assets/ptc-chung-grounds-reference.jpg
```

## 5. Branch select karein
Agar purani feature branch ka Pull Request abhi open hai:
```bash
git switch feature/police-college-manawan-landing
```

Agar purana PR merge ho chuka hai:
```bash
git switch main
git pull --ff-only origin main
git switch -c feature/ptc-lahore-two-campus-landing
```

## 6. Commit aur push
```bash
git add frontend/index.html frontend/assets/ptc-lahore-building-reference.jpg frontend/assets/ptc-chung-grounds-reference.jpg PTC_LAHORE_FINAL_UPDATE_ROMAN_URDU.md PTC_LAHORE_FINAL_GITHUB_COMMANDS_ROMAN_URDU.md

git commit -m "Update Police Training College Lahore two-campus landing page"

git push -u origin HEAD
```

## 7. Live website update karein
- Agar pehle wala PR open hai to usi PR mein new commit aa jayega.
- Agar PR merge ho chuka hai to naya Pull Request banayein.
- Changes `main` branch mein merge karein.
- Vercel Production deployment ka status `Ready` confirm karein.
- Vercel Root Directory `static` aur Production Branch `main` hi rakhein.
- Deployment ke baad website par `Ctrl + Shift + R` press karein.

**Important:** Sirf feature branch push karne se live website update nahi hoti. PR ko `main` mein merge karna aur Vercel Production deploy complete hona zaroori hai.
