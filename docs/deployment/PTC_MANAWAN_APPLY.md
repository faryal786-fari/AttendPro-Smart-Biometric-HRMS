# PTC Lahore — Manawan Training Portal Patch

Build: `2026-11-24-ptc-lahore-manawan-training-portal-v1`

This patch extends the existing **AttendPro / Police Training College Lahore** project. Farooqabad is used only as a visual and workflow reference. No Farooqabad records, users, passwords, database or backend are copied.

## Included

- Manawan-focused public landing page and login branding.
- Uses the existing `frontend/assets/ptc-college-crest.webp` crest already present in the current local project; this patch deliberately does not overwrite it.
- Uses the Manawan entrance photographs supplied for the project.
- Dashboard switch: **Trainee / Staff**.
- Trainee dashboard cards: Total Enrolled, Present, Absent, Leave, Long Weekend, OSD, Medical Rest and Repatriate.
- Course-wise attendance summary with Morning / Evening and date selection.
- Trainee roster: add, edit, search and Excel/CSV import.
- Trainee attendance: mark Present, Absent, Late, Early Arrival, Leave, OSD, Medical Rest or Long Weekend; single-row and bulk save.
- Trainee Leave and OSD / Permission pages.
- PTS Staff Leave, Staff OSD / Permission and Duty Rest pages.
- Uses the supplied Leave and OSD Excel templates. Normal/Casual leave imports as Approved; Emergency Leave imports as Pending; OSD imports as Approved. Overlapping active OSD imports are rejected.
- New Supabase migration: `backend/supabase/migrations/005_pts_training_management.sql`.
- Existing staff records, authentication, roles and the current biometric attendance backend are preserved.

## Important data behavior

- The dashboard does **not** copy Farooqabad's displayed numbers. Manawan cards start at zero until actual Manawan roster, attendance and leave/OSD records are entered or imported.
- The Staff dashboard continues to use the existing PTC Lahore staff data. The existing directory maps its Department field to Branch / Posting Place and Designation to Rank; a separate Father Name / Staff Category staff-profile extension is not included in this first patch.
- Trainee attendance can be marked in the new Trainee Attendance page. Automatic biometric-device matching for trainees still requires confirmation that the device's user ID matches the trainee Employee ID / Cap No.; do not assume it is enabled by this patch.
- Leave and OSD records are stored and displayed. The existing staff biometric calculation has not yet been changed to suppress absence automatically for every imported OSD interval; verify that rule separately before relying on it for payroll or official attendance decisions.

## Backend / GitHub architecture

No separate GitHub repository or Render backend is required for this phase. Continue using the current PTC Lahore:

- GitHub repository: existing AttendPro-Smart-Biometric-HRMS repository.
- Frontend: existing Vercel project.
- API: existing Render service.
- Database and authentication: existing **PTC Lahore Supabase project**.

Do not connect this deployment to Farooqabad's database or credentials. The new PTS tables are separate tables inside the PTC Lahore Supabase project, and the existing Supabase Auth / `attendpro_app_users` roles remain in use.

## Apply on Ubuntu

1. Keep a backup and create a feature branch:

```bash
cd ~/Downloads/AttendPro-Smart-Biometric-HRMS
git status --short
git switch -c feature/ptc-lahore-manawan-training-portal
```

2. Extract this patch ZIP into a temporary folder, then overlay only the included files. Example (adjust the ZIP name if needed):

```bash
mkdir -p ~/Downloads/PTC-Manawan-Portal-Patch
unzip -o ~/Downloads/PTC-LAHORE-MANAWAN-TRAINING-PORTAL-PATCH.zip -d ~/Downloads/PTC-Manawan-Portal-Patch
rsync -av ~/Downloads/PTC-Manawan-Portal-Patch/ ./ \
  --exclude='.env' --exclude='.venv/' --exclude='.git/' --exclude='data/'
```

3. In the **PTC Lahore Supabase project only**, open SQL Editor and run the complete file:

`backend/supabase/migrations/005_pts_training_management.sql`

Do this before testing the new dashboard endpoints. Do not run it in Farooqabad's Supabase project.

4. Keep the existing Render environment variables unchanged. The current Supabase URL and service-role key must continue to point to the PTC Lahore project. Never put the service-role key in frontend code or in Git.

5. Test locally:

```bash
source .venv/bin/activate
python -m py_compile app.py cloud_projection.py
python -m pytest -q
node --check frontend.js
git diff --check
```

6. Review the changed files, then commit and push:

```bash
git status --short
git diff --stat
git add app.py frontend/index.html frontend/assets/ptc-manawan-entrance.jpg frontend/assets/ptc-manawan-entrance.webp backend/supabase/migrations/005_pts_training_management.sql backend/templates/PTS_Manawan_Trainee_Roster_Template.xlsx backend/templates/PTS_Leave_Import_Template.xlsx backend/templates/PTS_OSD_Import_Template.xlsx tests/test_pts_training.py tests/test_frontend_contract.py tests/test_hosted_integration_fix.py PTC_MANAWAN_APPLY.md
git commit -m "Build PTC Lahore Manawan trainee and staff portal"
git push -u origin feature/ptc-lahore-manawan-training-portal
```

7. Open a Pull Request, review it, then merge to `main`. Let the existing Vercel and Render deployments complete.

## First login and data setup

1. Sign in using an existing **PTC Lahore Super Admin** account. Do not use Farooqabad's Training Directorate account.
2. Use **System Users** in the existing portal to create separate PTC Lahore accounts and assign roles.
3. Open **All Trainees → Download Template**. Fill the actual Manawan roster and import the XLSX/CSV. A trainee may appear in more than one course; course dates and platoon identify the enrollment.
4. Open **Trainee Attendance**, choose date and shift, mark attendance, and save. The dashboard cards and course-wise table will then update.
5. Use the supplied **Leave** and **OSD** templates from their respective pages. For trainee imports, the matching course must have valid start and end dates. If an ID maps to multiple active courses, provide Course and/or Platoon. For staff imports, the Employee ID must resolve to one active PTC staff record; add Staff Category and/or Staff Branch if needed.
6. Emergency leave stays Pending until a Supervisor or Super Admin approves it in the relevant Leave page.

## Patch validation performed

- `python3 -m py_compile app.py cloud_projection.py` — passed.
- `python3 -m pytest -q` — **76 passed**.
- Inline JavaScript extracted from `frontend/index.html` and checked with `node --check` — passed.
- Local API smoke tests covered login, trainee create/edit path, trainee roster import, attendance save, leave/OSD import, overlap rejection and status approval.
