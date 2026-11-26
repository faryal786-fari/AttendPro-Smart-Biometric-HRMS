# AttendPro Smart Biometric HRMS

AttendPro is a FastAPI-backed biometric attendance, trainee and staff management system with a static public website and secure portal frontend.

## Project layout

```text
AttendPro-Smart-Biometric-HRMS/
├── frontend/                 # Vercel static website and portal UI
│   ├── index.html             # Public landing, portal login and dashboard SPA shell
│   ├── assets/                # PTC crest, campus photos and other public assets
│   ├── src/
│   │   ├── styles/main.css    # Extracted frontend styles
│   │   ├── js/
│   │   │   ├── attendpro-app.js
│   │   │   └── public-landing.js
│   │   └── pages/             # Page ownership and structure notes
│   ├── legacy/                # Unused historical prototype, not loaded in production
│   └── vercel.json            # /api/* rewrite to Render
├── backend/                   # FastAPI application and server-side logic
│   ├── app.py                 # Main API, auth, database and route orchestration
│   ├── main.py                # ASGI entry point (backend.main:app)
│   ├── cloud_service.py       # Supabase Auth/REST adapter
│   ├── cloud_projection.py    # Supabase projection and source reconciliation
│   ├── redis_cache.py         # Optional Redis cache
│   ├── tools/                 # MDB, spreadsheet and report helpers
│   ├── templates/             # Excel import/export templates
│   ├── scripts/               # Admin setup and migration commands
│   └── supabase/migrations/   # Database migrations
├── tests/                     # Backend and frontend regression tests
├── docs/                      # User guides, deployment notes and archives
├── app.py                     # Compatibility ASGI entry point for existing Render settings
├── cloud_service.py           # Legacy import shim
├── cloud_projection.py        # Legacy import shim
├── redis_cache.py             # Legacy import shim
├── tools/                     # Legacy package shim for old tools.* imports
├── requirements.txt           # Root dependency manifest for existing Render build settings
├── start.sh                   # Local development launcher
└── .env.example               # Environment variable reference
```

## Important deployment settings

### Vercel (frontend)

Set the Vercel project's **Root Directory** to `frontend`.

- Framework Preset: **Other**
- Build Command: leave empty
- Output Directory: `.`
- Install Command: leave empty
- `frontend/vercel.json` rewrites `/api/*` requests to the Render backend.

After changing the Root Directory, push commits to the connected GitHub branch or run `npx vercel --prod` from inside `frontend/`.

### Render (backend)

Keep the Render service **Root Directory** at the repository root so existing build settings continue to work.

- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app:app --host 0.0.0.0 --port $PORT`

The root `app.py` is a compatibility shim that imports `backend.app:app`. Existing Render settings therefore do not need to change.

## Local development

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8000
```

Or run `bash start.sh`.

Open `http://127.0.0.1:8000`. FastAPI serves the frontend HTML, CSS, JavaScript and public assets locally, while `/api/*` routes continue to use the same backend.

## Authentication and browser popup

The portal uses the existing AttendPro login flow (Supabase Auth in cloud mode or the configured local user store). Protected API responses return `401` without a `WWW-Authenticate: Basic` challenge, so browsers do not open their native username/password dialog. Vercel Deployment Protection is a separate setting; keep Vercel Authentication disabled for a publicly accessible landing page.

## Preserve existing data and functionality

- No database schema or data migration is required for this layout refactor.
- The original MDB remains read-only.
- Local attendance data belongs in the ignored `data/` folder and must not be committed.
- Keep `.env` private; copy it from the previous working directory when migrating.
- The existing API routes, Supabase integration, Redis cache, scheduler, user roles, reports, templates, and frontend screen IDs are retained.
- Root compatibility shims keep existing imports and the Render `uvicorn app:app` command working.

## Tests

Install the dependencies in `requirements.txt`, plus the test dependencies if they are not already present (`pytest`, `beautifulsoup4`). Then run:

```bash
python -m pytest -q
```

See `docs/deployment/VERCEL_RENDER_DEPLOYMENT.md` for deployment details and `docs/architecture/PROJECT_STRUCTURE.md` for the file map.
