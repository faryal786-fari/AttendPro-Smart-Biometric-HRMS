# PTC Manawan UI Refresh v4 — Apply and Deploy

## What changed

This update refreshes only the PTC Manawan presentation layer and the supplied campus image assets:

- Uses the exact PTC Lahore logo image supplied for this update in the existing crest paths, so the sidebar, top bar, landing-page header/footer, favicon and login branding all resolve to the same asset.
- Refreshes the Manawan flags photograph used by the public landing hero and secure login.
- Adds the supplied campus building reference rendering beside the Manawan location information. The phone bars and controls have been cropped out.
- Makes the login a dedicated full-screen view inspired by the PTS Farooqabad reference. The dashboard and public landing page are hidden while the login overlay is open.
- Groups the existing sidebar links into collapsible, icon-led sections: Main, Trainee Management, Staff Management, Leave & Permissions, Attendance & Records, Reports and System.
- Keeps the existing `data-screen` names, inline `showScreen(...)` handlers, permission attributes and dynamic device list.
- Adds active, hover, pressed, focus and mobile drawer states.

## Existing functionality intentionally preserved

This patch does not change:

- `app.py`, `cloud_projection.py`, `cloud_service.py`, `frontend.js` or API endpoint behavior.
- Supabase authentication, user roles, permission checks, database schema or migrations.
- Attendance, trainee, staff, leave, OSD, reports, discrepancy, device, Redis or scheduler business logic.
- `static/vercel.json` and its existing `/api/:path*` rewrite to the Render backend.
- Any `.env`, Supabase credentials, Redis credentials, MDB, SQLite or live attendance data.

Vercel Root Directory should remain `static`. Keep Deployment Protection on Standard Protection; use the stable production domain for public visitors, not a generated preview URL.

## Safe apply steps on Ubuntu

Open a terminal and run:

```bash
cd ~/Downloads/AttendPro-Smart-Biometric-HRMS

# Check your current work before applying anything
git status --short

# Make a dated backup of the two areas this patch updates
cp -a static/index.html "static/index.html.backup-ui-v4-$(date +%F-%H%M%S)"
cp -a static/assets "static/assets.backup-ui-v4-$(date +%F-%H%M%S)"

# Extract the patch ZIP into a temporary folder
mkdir -p ~/Downloads/AttendPro-PTC-Manawan-UI-Refresh
unzip -o ~/Downloads/AttendPro-PTC-Manawan-UI-Refresh-Patch-v4.zip \
  -d ~/Downloads/AttendPro-PTC-Manawan-UI-Refresh

# Copy only the patch files into the existing repository.
# These exclusions protect local secrets, databases and Git history.
rsync -av \
  --exclude='.git/' \
  --exclude='.env' \
  --exclude='.venv/' \
  --exclude='data/' \
  --exclude='*.mdb' \
  --exclude='*.sqlite' \
  --exclude='*.sqlite3' \
  ~/Downloads/AttendPro-PTC-Manawan-UI-Refresh/ ./
```

## Validate before pushing

```bash
python -m py_compile app.py cloud_projection.py
python -m pytest -q
node --check frontend.js
git diff --check
git status --short
git diff --stat
```

The HTML contains the grouped sidebar initialization inline. The regression tests check the screen routes, logo assets, location photo, login isolation and Vercel API rewrite.

## Commit and deploy through GitHub

```bash
git add \
  static/index.html \
  static/assets/ptc-college-crest.png \
  static/assets/ptc-college-crest.webp \
  static/assets/ptc-lahore-logo.png \
  static/assets/ptc-lahore-logo.webp \
  static/assets/ptc-manawan-flags-campus.jpg \
  static/assets/ptc-manawan-flags-campus.webp \
  static/assets/ptc-manawan-location-building.jpg \
  static/assets/ptc-manawan-location-building.webp \
  tests/test_ptc_manawan_login_redesign.py \
  tests/test_frontend_contract.py \
  tests/test_ptc_manawan_ui_refresh.py \
  PTC_MANAWAN_UI_REFRESH_APPLY_ROMAN_URDU.md

git commit -m "Refresh PTC Manawan login sidebar and campus branding"
git push origin main
```

If Vercel is connected to the GitHub `main` branch, the push starts the production deployment automatically. Wait until the Vercel deployment status is **Ready**.

## Final browser checks

Open the stable production URL in an Incognito window:

1. Public landing page loads and the PTC crest is visible.
2. The hero card shows the Manawan building with flags.
3. Scroll to Campus Locations and confirm the building reference photo appears beside the location information.
4. Click Portal Login. The login page should fill the screen; no dashboard or login modal should be visible behind it.
5. Sign in with an existing authorized account.
6. Confirm all sidebar categories expand/collapse and the active screen remains selected.
7. Check Trainee Leave, Staff Leave and Leave & Holidays separately; their existing screens remain available.
8. Confirm staff, trainee, attendance, reports and device pages still load.

Do not disable Vercel Deployment Protection to solve a preview URL access screen. Test the production domain for the public site and use an authorized account for the portal.
