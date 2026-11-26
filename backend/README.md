# Backend

The production FastAPI implementation lives here.

- `app.py`: existing FastAPI routes, auth dependencies, DB initialization, scheduler lifecycle and application orchestration.
- `cloud_service.py`: Supabase Auth and REST adapter.
- `cloud_projection.py`: synchronization/projection logic.
- `redis_cache.py`: optional Redis snapshots and API cache.
- `tools/`: Access MDB reader, spreadsheet parsers and Excel report builder.
- `templates/`: import/export workbook templates.
- `scripts/`: operational scripts.
- `supabase/migrations/`: ordered SQL migrations.

`ROOT` in `backend/app.py` intentionally points to the repository root so local data and `.env` remain in their existing locations. The root `app.py` shim preserves the existing Render start command. You can also run `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`.
