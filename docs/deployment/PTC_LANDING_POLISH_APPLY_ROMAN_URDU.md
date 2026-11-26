# PTC Lahore Landing Page Polish — Apply Instructions (23 November 2026)

## Is patch mein kya update hai?
- Public PTC Lahore landing page ka hero layout, heading size, spacing aur buttons polish kiye gaye hain.
- Aap ki upload ki hui original 1366 x 512 entrance photo use ki gayi hai. Purani low-resolution screenshot crops hero/gallery se hata di gayi hain.
- Photo ka full sign visible rahega; image crop nahi hogi. WebP + JPG fallback included hai.
- Gallery mein blurry second photo ki jagah clean campus-information card hai.
- Existing AttendPro dashboard, Supabase login, reports, attendance, roles, Redis, scheduler aur Vercel API rewrite ko replace nahi kiya gaya.
- Backend origin allowlist mein current exact preview host add hai. Koi wildcard `*.vercel.app` allow nahi kiya.

## Recommended method — Ubuntu terminal (existing repo par patch)

1. Pehle apne repo ka status check karein:

```bash
cd ~/Downloads/AttendPro-Smart-Biometric-HRMS
git status --short
```

Agar local uncommitted changes hain, unko safe rakhne ke liye:

```bash
git stash push -u -m "backup before PTC landing polish"
```

2. Latest production code se new branch banayein:

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feature/ptc-landing-clean-photo
```

Agar local `main` branch nahi hai to pehle yeh chalayein:

```bash
git switch -c main --track origin/main
```

Phir `git pull --ff-only origin main` aur `git switch -c feature/ptc-landing-clean-photo` chalayein.

3. Patch ZIP ko extract karein. ZIP mein files `app.py`, `static/`, `tests/` aur `.env.example` ke relative paths mein hain:

```bash
cd ~/Downloads
unzip -o AttendPro-PTC-Landing-Polish-Patch.zip -d AttendPro-PTC-Landing-Polish-Patch
```

4. Patch ko existing repository mein copy karein. `.env`, `.git`, `.venv`, `data/`, MDB aur SQLite files ko touch nahi kiya jayega:

```bash
cd ~/Downloads/AttendPro-Smart-Biometric-HRMS
rsync -av \
  --exclude='.git/' --exclude='.env' --exclude='.venv/' \
  --exclude='data/' --exclude='*.mdb' --exclude='*.sqlite' \
  --exclude='*.sqlite3' --exclude='__pycache__/' \
  ~/Downloads/AttendPro-PTC-Landing-Polish-Patch/ ./
```

5. Tests aur diff check karein:

```bash
python -m py_compile app.py cloud_projection.py
python -m pytest -q
node --check frontend.js
git diff --check
git status --short
git diff --stat
```

6. Sirf patch ki relevant files commit karein:

```bash
git add app.py frontend/index.html frontend/assets/ptc-manawan-entrance.jpg frontend/assets/ptc-manawan-entrance.webp tests/test_hosted_integration_fix.py .env.example PTC_LANDING_POLISH_APPLY_ROMAN_URDU.md
git commit -m "Polish PTC Lahore landing page and campus photo"
git push -u origin feature/ptc-landing-clean-photo
```

7. GitHub par Pull Request banayein: `feature/ptc-landing-clean-photo` → `main`. Review ke baad merge karein. Vercel `main` branch ki production deployment khud build karega. Vercel Root Directory `static` hi rehni chahiye.

## Vercel environment variable note

Current `frontend/index.html` frontend API calls same-origin `/api/...` paths, and `static/vercel.json` rewrites those paths to the existing Render service. `VITE_API_URL` is not read by this static frontend code. If you already added it in Vercel, leave it unchanged for now; it is not the cause of the Vercel access-request page. Do not replace the Render URL in `static/vercel.json`.

## Render backend — CORS preview fix

Render Dashboard → `attendpro-smart-biometric-hrms` → Environment mein yeh values add/update karein:

```env
ATTENDPRO_PUBLIC_ORIGIN=https://attendpro-smart-biometric-hrms-stat.vercel.app
ATTENDPRO_ALLOWED_ORIGINS=https://attendpro-smart-biometric-hrms-static-nfn88kyvm-faryal3.vercel.app
```

Agar `ATTENDPRO_ALLOWED_ORIGINS` mein pehle se doosre approved domains hain to unko delete na karein; comma ke saath add karein. Existing Supabase, Redis aur database secrets ko bilkul change/delete na karein. Save ke baad Render par latest backend commit deploy karein.

## Vercel Deployment Protection — setting ka matlab

Aap ke screenshot mein `Standard Protection` enabled hai. **Isko waise hi rehne dein.** Yeh recommended setting hai:
- Production project domain public rehta hai.
- Preview / generated deployment URLs protected rehte hain; un par Vercel sign-in ya access request aa sakti hai.
- Public users ko yeh stable production URL dein:
  `https://attendpro-smart-biometric-hrms-stat.vercel.app/`
- Long generated preview URL (for example `...nfn88kyvm-faryal3.vercel.app`) public users ko na dein.

Agar sirf ek preview URL ko kisi external reviewer ke liye public karna ho to Deployment Protection Exceptions use karein; tamam protection disable karne ki zaroorat nahi.

Options:
- **Standard Protection — recommended:** preview private, production domain public.
- **All Deployments:** production aur previews dono protected; public website ke liye isko select na karein.
- **None:** sab deployments public, previews bhi; isko sirf tab choose karein jab aap jaan-boojh kar har preview public karna chahte hain.

## Final browser test

1. Incognito/private window kholein.
2. `https://attendpro-smart-biometric-hrms-stat.vercel.app/` open karein. Landing page bina Vercel request ke aani chahiye.
3. `Portal Login` click karein. Ab AttendPro ka apna secure login khulega.
4. Login ke liye active Supabase Auth account aur `attendpro_app_users` mein active profile zaroori hai. Website ko public karne ka matlab dashboard ko public karna nahi hai.
5. Preview domain ko incognito mein test karne par Vercel sign-in aa sakta hai — Standard Protection ke saath yeh expected hai.

## Rollback

Agar deployment mein issue aaye to Vercel Deployments mein previous known-good production deployment ko Promote/Rollback karein. Git mein patch ko revert karne ke liye:

```bash
git revert <new-commit-hash>
git push
```

`.env`, live MDB, SQLite/data, Supabase records aur Redis data ko kabhi patch ZIP se overwrite na karein.
