# AttendPro Project Organization — Apply Guide (Roman Urdu)

## 1. ZIP extract karein

Updated ZIP ko ek **new folder** mein extract karein. Purana project folder abhi delete na karein.

## 2. Git history, .env aur local data preserve karein

PowerShell mein old aur new folders ke paths set karein:

```powershell
$old = "C:\YOUR-PATH\AttendPro-Smart-Biometric-HRMS5"
$new = "C:\YOUR-PATH\AttendPro-Smart-Biometric-HRMS"

Copy-Item -Recurse -Force "$old\.git" "$new\.git"

if (Test-Path "$old\.env") {
    Copy-Item -Force "$old\.env" "$new\.env"
}

if (Test-Path "$old\data") {
    Copy-Item -Recurse -Force "$old\data" "$new\data"
}
```

`.git` copy karne se GitHub remote aur commit history preserve rahegi. `.env` aur `data` local machine par hi rahenge; inhein GitHub par push nahi karna.

## 3. GitHub par update push karein

New folder mein VS Code terminal open karein:

```bash
git status
git remote -v
git add -A
git commit -m "Organize AttendPro frontend and backend structure"
git push origin HEAD
```

Agar `nothing to commit` aaye to pehle check karein ke `.git` old folder se new folder mein copy hua hai aur aap new folder ke andar terminal chala rahe hain.

## 4. Vercel setting — sirf ek dafa

Vercel → AttendPro project → Settings → Build and Deployment:

- Root Directory: `frontend`
- Framework Preset: `Other`
- Build Command: blank
- Output Directory: `.`

Save karein. Ab GitHub push ke baad Vercel `frontend/` se public landing page, portal login aur dashboard frontend deploy karega.

## 5. Render setting

Render ka Root Directory repository root hi rehne dein.

- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app:app --host 0.0.0.0 --port $PORT`

Root `app.py` compatibility shim hai; actual code `backend/app.py` mein hai. Is liye existing Render command kaam karta rahega.

## 6. Kya change hua?

- `static/` frontend code ab `frontend/` mein hai.
- Inline CSS `frontend/src/styles/main.css` mein split ki.
- Dashboard JavaScript `frontend/src/js/attendpro-app.js` mein.
- Public landing navigation `frontend/src/js/public-landing.js` mein.
- PTC images `frontend/assets/` mein.
- FastAPI app, Supabase, Redis, tools, scripts, templates aur SQL migrations `backend/` mein.
- Tests `tests/` mein; guides `docs/` mein.
- Root compatibility shims purane imports aur Render command ko support karte hain.
- Browser ka Basic Authentication popup trigger karne wala `WWW-Authenticate` challenge remove kiya gaya; AttendPro/Supabase login flow preserve hai.

## 7. Verification

Project par 96 regression tests pass hue. Python compile check aur dono frontend JavaScript syntax checks bhi pass hue.

Is refactor ke liye koi Supabase SQL migration ya database reset required nahi.
