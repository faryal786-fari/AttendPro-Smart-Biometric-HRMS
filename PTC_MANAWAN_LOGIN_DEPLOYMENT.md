# PTC Manawan Login + Domain Deployment Guide

## Included in this patch

- Replaces the small translucent login popup with a full-screen PTC Manawan sign-in page inspired by the supplied PTS Farooqabad reference.
- Hides the dashboard completely until the user has a valid session.
- Uses the supplied Police Training College Lahore crest throughout the public page, portal shell and login screen.
- Uses the supplied Manawan flags/campus photograph in the public hero, gallery and login page.
- Adds a second Manawan entrance photo card and improves the public-page card styling.
- Adds the exact current Vercel preview origin from the supplied screenshot and the requested `ptclahore.co` production origins to the backend's strict origin allowlist.
- Makes plain-text API errors visible, so future 403 responses show their actual reason.
- Keeps Supabase authentication and role checks enabled. No credentials are included.

## 1. Apply the source patch on Ubuntu

Run these commands from the existing AttendPro project folder. This patch contains only changed/new files; it does not include `.env`, `.venv`, `.git`, SQLite/MDB data or user records.

```bash
cd ~/Downloads/AttendPro-Smart-Biometric-HRMS

unzip -o ~/Downloads/PTC-MANAWAN-LOGIN-REDESIGN-PATCH.zip -d .

source .venv/bin/activate

python -m pytest -q
python -m py_compile app.py cloud_projection.py
node --check frontend.js
git diff --check
```

Expected: the existing tests plus the new PTC login tests pass.

## 2. Commit and push

```bash
git status --short

git add app.py \
  static/index.html \
  static/assets/ptc-college-crest.webp \
  static/assets/ptc-manawan-flags-campus.webp \
  tests/test_hosted_integration_fix.py \
  tests/test_master_template_print.py \
  tests/test_frontend_contract.py \
  tests/test_ptc_manawan_login_redesign.py \
  PTC_MANAWAN_LOGIN_DEPLOYMENT.md

git commit -m "Refresh PTC Manawan secure login and campus branding"

git push origin feature/ptc-lahore-manawan-training-portal
```

Then open a Pull Request from `feature/ptc-lahore-manawan-training-portal` into `main`, review it and merge it. If your hosting services intentionally deploy from the feature branch, use that configured branch instead; do not change the production branch accidentally.

## 3. Render environment variables

Open Render → `attendpro-smart-biometric-hrms` → Environment.

Update the existing values (do not create duplicate keys):

```env
ATTENDPRO_PUBLIC_ORIGIN=https://ptclahore.co
ATTENDPRO_ALLOWED_ORIGINS=https://ptclahore.co,https://www.ptclahore.co,https://attendpro-smart-biometric-hrms-stat.vercel.app,https://attendpro-smart-biometric-hrms-static-op69zq26j-faryal3.vercel.app,https://attendpro-smart-biometric-hrms-static-ngnfhaoe7-faryal3.vercel.app,https://attendpro-smart-biometric-hrms-static-nfn88kyvm-faryal3.vercel.app,https://attendpro-smart-biometric-hrms.onrender.com
```

Keep the existing values for `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_ENABLED`, `REDIS_URL` and the other scheduler/cache settings. Do not paste secret values into GitHub, this guide, screenshots or chat.

Save the environment changes and deploy the latest backend commit on Render. Wait until the service reports **Live**.

## 4. Connect ptclahore.co to Vercel

The code cannot register a domain or change DNS on your behalf.

1. Open Vercel → the AttendPro project → Settings → Domains.
2. Add `ptclahore.co`. Add `www.ptclahore.co` too if you want the www address.
3. Vercel will display the DNS records required for your domain registrar. Copy the exact records Vercel displays; do not guess or substitute generic records.
4. Wait until Vercel reports the domain as configured and HTTPS is active.
5. Keep the Vercel project's Root Directory set to `static`, Framework Preset `Other`, and keep the existing `/api/*` rewrite to the Render backend.
6. Confirm the production branch setting. If it is `main`, merge the Pull Request into `main` and allow Vercel to deploy the production build.

After the domain is connected, the portal entry link is:

`https://ptclahore.co/#portal=dashboard`

## 5. Remove the browser's Vercel sign-in popup

The browser-native Username/Password popup in the supplied screenshot is Vercel Deployment Protection. It is not the AttendPro login form and cannot be removed by changing HTML or Python.

In Vercel → Project → Settings → Deployment Protection, configure the production deployment/domain to be publicly reachable (use the production/public setting available in your project). Keep preview deployments protected if desired. Do not turn off protection for every preview unless you intentionally want preview builds public.

The PTC Manawan username/password form remains the application's own login and continues to use Supabase authentication.

## 6. Verify after deployment

Open a private/incognito browser window and check:

1. `https://ptclahore.co/` opens the public PTC Manawan institutional page without the Vercel browser-native sign-in popup.
2. Click Portal Login. The PTC Manawan full-screen sign-in page should appear; the dashboard must not be visible behind it.
3. The Police Training College Lahore crest and Manawan flags photo should load.
4. `https://ptclahore.co/api/auth/status` should return JSON showing `mode: "supabase"` and an unauthenticated state before login.
5. Sign in using a valid, active Supabase Auth account that also has an active AttendPro application-user profile.
6. After successful login, the dashboard appears. On logout, the full-screen login page returns.

## 7. Interpreting a remaining 403

The screenshot's current preview origin was not in the backend's exact-origin allowlist. This patch adds that exact preview URL and the requested production domain, while still rejecting unrelated origins.

The frontend now displays plain-text backend errors instead of reducing every one to just `403`. If the message says the account is not enabled, check that the user exists in Supabase Auth and has an active row in the AttendPro application-user profile table. Do not disable RLS or weaken role checks to bypass this.

## Important boundary

The source patch is prepared and can be tested locally. The custom domain, DNS, Vercel Deployment Protection, Render environment values and live Supabase user/profile state must still be configured in the user's own hosting accounts. This patch does not claim those external account actions have already happened.
