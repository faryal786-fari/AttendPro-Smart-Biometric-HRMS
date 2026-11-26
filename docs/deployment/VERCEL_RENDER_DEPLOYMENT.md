# Vercel + Render deployment after project organization

## 1. Vercel frontend

In Vercel → Project → Settings → Build and Deployment:

1. Set **Root Directory** to `frontend`.
2. Select Framework Preset **Other**.
3. Leave Build Command empty.
4. Set Output Directory to `.` (or leave the default if Vercel detects the static site).
5. Save the settings.

`frontend/vercel.json` already contains the `/api/:path*` rewrite to the existing Render backend.

For manual deployment from the repository root:

```bash
cd frontend
npx vercel --prod
```

## 2. Render backend

Keep Render Root Directory at the repository root. This preserves existing environment variables and the root dependency manifest.

- Build: `pip install -r requirements.txt`
- Start: `uvicorn app:app --host 0.0.0.0 --port $PORT`

The root `app.py` is a compatibility shim to `backend.app`. If you prefer the explicit package path, use `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`.

After pushing to the connected branch, wait for the Render deployment to finish before testing the portal.

## 3. Local deployment / tests

```bash
pip install -r requirements.txt
pip install pytest beautifulsoup4
python -m pytest -q
bash start.sh
```

Open `http://127.0.0.1:8000`.

## 4. Preserve existing settings

- Do not disable or change Supabase authentication.
- Keep Vercel Deployment Protection disabled if the public website must be reachable without a Vercel team login.
- Do not commit `.env`, `data/`, MDB files or SQLite databases.
- No database migration is required for the directory refactor.
