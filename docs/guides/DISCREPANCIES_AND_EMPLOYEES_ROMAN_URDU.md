# AttendPro — Do targeted updates (29 October 2026)

Only two functional UI changes from the previous version:

1. Employees: original 8-column table with Employee ID, Name, Department, Designation, Shift, Status and View action. Names appear sorted by cleaned display name A–Z. Click View to open the original modal; no in-row dropdown. Search, department and status filters remain. Source database names and IDs are unchanged.

2. Discrepancies: new sidebar entry and review queue for incomplete punches (IN without OUT or OUT without IN), and verified biometric configuration mismatches. Historical date range, name search, issue/status filters, details and audit logged Supervisor/Super Admin resolutions: Reviewed, Present, On Leave. Original att2000.mdb and raw punches are read-only.

Important: Device enrollment/fingerprint/face configuration cannot reliably be inferred from CHECKINOUT, so its state defaults to Unknown. A Supervisor/Admin can manually mark Confirmed Configured or Confirmed Not Configured after checking with the client. This only flags discrepancies: it NEVER automatically marks leave without review.

Current local data: 2026-10-26 Excel reports. New imports/syncs update SQLite, and discrepancy cases are calculated on demand from those records.

Supabase / Redis are NOT installed yet. Suggested next migration: Supabase Postgres tables (employees, attendance, punches, discrepancy_reviews, biometric_status_changes, users, audit logs) and Supabase Auth with RLS; Redis + worker for background MDB polling/retries. Keep the original MDB read-only. Do not store user passwords in the frontend. Plan schema/key mapping before migration.

To run on Ubuntu:
  sudo apt install -y python3-venv python3-pip mdbtools
  bash start.sh
Browser: http://127.0.0.1:8000

Do not open frontend_source/attendance-proto-original.html directly: it has demo sample data.
