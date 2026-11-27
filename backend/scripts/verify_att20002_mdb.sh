#!/usr/bin/env bash
set -euo pipefail
MDB_FILE="${1:-data/source/att20002.mdb}"

if [[ ! -f "$MDB_FILE" ]]; then
  echo "MDB file not found: $MDB_FILE" >&2
  exit 2
fi
if ! command -v mdb-tables >/dev/null 2>&1 || ! command -v mdb-export >/dev/null 2>&1; then
  echo "mdbtools is missing. Install it with:"
  echo "  sudo apt update && sudo apt install -y mdbtools"
  exit 3
fi

tables="$(mdb-tables -1 "$MDB_FILE")"
echo "MDB file: $MDB_FILE"
echo "Checking required ZKTeco tables (names only; no personal rows are printed)..."
for required in USERINFO CHECKINOUT DEPARTMENTS; do
  if ! printf '%s\n' "$tables" | grep -Fxqi "$required"; then
    echo "MISSING required table: $required" >&2
    echo "Tables found:" >&2
    printf '%s\n' "$tables" >&2
    exit 4
  fi
  count="$(mdb-export "$MDB_FILE" "$required" | awk 'NR>1 {n++} END {print n+0}')"
  printf '  %-14s %s rows\n' "$required" "$count"
done
echo "MDB table check passed. This script only reads the MDB; it does not modify it."
