# AttendPro architecture and file map

## Frontend / backend boundary

The browser-facing application is in `frontend/` and is deployed by Vercel. It contains only public HTML, CSS, JavaScript and images. Supabase service credentials, database logic and server-side integrations remain in `backend/` and are never shipped to Vercel as frontend assets.

The FastAPI service is in `backend/` and is deployed by Render. `frontend/vercel.json` forwards `/api/*` to the Render service. During local development, FastAPI also serves `frontend/index.html`, `/src/*` and `/assets/*`.

## Page regions

`frontend/index.html` contains the existing SPA shell:
- `#apPublicLanding`: public institutional website.
- `#loginOverlay`: AttendPro portal login.
- `.app` / `#appShell`: authenticated dashboard.

The landing and login are deliberately not converted into separate applications. They share the existing hash-based navigation and session state, so keeping them in the same shell preserves current login and dashboard behavior.

## Backend modules

- `backend/app.py`: application lifecycle, FastAPI routes, auth, database, permissions, scheduler and application services.
- `backend/cloud_service.py`: Supabase Auth/REST operations.
- `backend/cloud_projection.py`: cloud source synchronization and correction projection.
- `backend/redis_cache.py`: optional Redis cache.
- `backend/tools/`: spreadsheet parsing, read-only MDB bridge and report generation.
- `backend/templates/`: workbook templates.
- `backend/supabase/migrations/`: ordered schema migrations.
- `backend/scripts/`: administrative and data migration commands.

## Compatibility layer

The root `app.py`, `cloud_service.py`, `cloud_projection.py`, `redis_cache.py` and `tools/` package are intentionally thin compatibility shims. They preserve old imports, test setup and the existing Render command (`uvicorn app:app`) while the implementation is organized under `backend/`.

## Safety rules

- Keep `.env` at the repository root and never commit it.
- Keep private MDB, SQLite and employee data in `data/`; it is ignored by Git.
- Do not move or write into the original ZKTeco MDB.
- Do not rename existing API endpoints, cookies, DOM IDs, form names or `data-screen` route values as part of a layout-only refactor.
