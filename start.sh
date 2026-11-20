#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi
if [[ ! -d .venv ]]; then python3 -m venv .venv; fi
source .venv/bin/activate
if ! python -c 'import fastapi,uvicorn,openpyxl,httpx' 2>/dev/null; then
  python -m pip install -r requirements.txt
fi
if [[ ${SUPABASE_ENABLED:-0} == 1 ]]; then
  printf '\nAttendPro: SUPABASE CLOUD MODE (source MDB remains read-only)\n'
  if [[ -z ${SUPABASE_SECRET_KEY:-} || -z ${SUPABASE_PUBLISHABLE_KEY:-} ]]; then
     echo 'Missing Supabase .env keys; check SUPABASE_SETUP_ROMAN_URDU.md'; exit 1
  fi
else
  printf '\nAttendPro: LEGACY LOCAL MODE — Supabase is NOT enabled.\n'
fi
if ! command -v mdb-export >/dev/null 2>&1; then
  echo 'For MDB sync on Ubuntu: sudo apt install mdbtools'
fi
printf 'Open http://127.0.0.1:8000\n'
python -m uvicorn app:app --host 127.0.0.1 --port 8000
