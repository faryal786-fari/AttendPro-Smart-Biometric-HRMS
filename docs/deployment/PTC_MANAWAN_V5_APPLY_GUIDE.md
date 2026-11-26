# AttendPro PTC Manawan — UI and Login Fix v5

This update is additive. It does not change database schemas, attendance records, role definitions, existing screen IDs, or existing API routes.

## What changed

1. Fixed Render origin validation for new Vercel preview deployments. Only the `attendpro-smart-biometric-hrms-static` project under the `faryal3` Vercel account is accepted by the preview-origin pattern; arbitrary `*.vercel.app` origins remain blocked.
2. Fixed the missing `applyRolePermissions()` frontend helper by adding a backward-compatible alias to the existing `applyPermissions()` role logic.
3. Fixed the oversized logo in the dashboard top bar by enforcing a 38 × 38 px image size.
4. Removed the extra JavaScript-inserted `Attendance & Leave` category. Existing leave links remain under the existing `Leave & Permissions` category.
5. Changed the sidebar into a true single-open accordion: opening one category closes the previously opened category. Selecting a child screen also closes other categories.
6. Cropped the flags/building photo for the login and public landing hero cards so the image fills the card without a white letterbox.
7. Added the newly supplied Commandant Office photo to the campus-location section. The crop removes the corner badges and bottom overlay text while retaining the flags, entrance and Commandant Office sign.
8. Changed the login footer link to return to the current website (`/`) rather than a custom domain that may not yet be configured.
9. Kept existing application features and route names intact.

## Apply the patch to your existing Git project

Open a terminal in the existing project folder (the folder that contains `app.py`):

```bash
cd /path/to/AttendPro-Smart-Biometric-HRMS
unzip -o ~/Downloads/AttendPro-PTC-Manawan-UI-Fix-v5-PATCH.zip -d .

git status

git add app.py frontend/index.html \
  frontend/assets/ptc-manawan-flags-card.jpg \
  frontend/assets/ptc-manawan-flags-card.webp \
  frontend/assets/ptc-manawan-commandant-office.jpg \
  frontend/assets/ptc-manawan-commandant-office.webp \
  tests/test_hosted_integration_fix.py \
  tests/test_ptc_manawan_login_redesign.py \
  tests/test_ptc_manawan_ui_refresh.py \
  PTC_MANAWAN_V5_APPLY_GUIDE.md

git commit -m "Fix PTC Manawan login origin and dashboard UI"
git push origin main
```

Replace `/path/to/AttendPro-Smart-Biometric-HRMS` with the actual folder path. If the ZIP is saved somewhere other than `~/Downloads`, change the ZIP path accordingly.

## Deploy

If Render and Vercel are connected to the same GitHub repository and `main` branch, the push above should trigger both deployments automatically:

- **Render:** deploy the backend update containing the Vercel preview-origin fix.
- **Vercel:** deploy the static frontend update containing the image, logo, sidebar and role-helper fixes. The Vercel project root directory should remain `static`.

If Vercel is not auto-deploying, from the project folder run:

```bash
cd frontend
npx vercel --prod
```

If Render is not auto-deploying, open the Render service and choose **Manual Deploy → Deploy latest commit**.

## Make the Vercel website publicly reachable

This is a Vercel dashboard setting; it cannot be changed by the ZIP or Git commands:

1. Open Vercel Dashboard → the `attendpro-smart-biometric-hrms-static` project.
2. Open **Settings → Deployment Protection**.
3. Set **Vercel Authentication** to **Disabled** for the deployment type you want to share.
4. Save the setting.

For a public link, disable protection for Production. If you also want preview URLs to be public, disable protection for Preview deployments too. A custom domain is not required; the Vercel project URL can be shared.

**Security note:** This makes the website and login page publicly reachable. It does not make attendance records public. People still need valid AttendPro/Supabase credentials to enter the dashboard. Do not remove authentication from the HRMS because it contains staff, trainee and biometric attendance information.

## Verification

The project test suite passed after this update: **94 tests passed**. JavaScript inline-script syntax checks also passed. No database migration is required.
