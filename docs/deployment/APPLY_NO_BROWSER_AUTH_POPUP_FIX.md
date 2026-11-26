# AttendPro — Fix browser Sign in popup (HTTP Basic Auth challenge)

This patch fixes the native browser username/password popup that appears even after
Vercel Deployment Protection has been switched off.

## Root cause
The FastAPI `auth_guard` returned a 401 response with a `WWW-Authenticate: Basic`
header when a request had no AttendPro session. Browsers interpret that header as
an instruction to open their own HTTP Basic Authentication dialog. AttendPro already
has its own login form and session-cookie flow, so the API should return a normal
JSON 401 without the challenge header.

## Files in this patch
- `app.py` — removes the `WWW-Authenticate` header from the missing-session response.
- `tests/test_app_api.py` — adds a regression test confirming that unauthenticated API
  requests return 401 without triggering a browser Basic Auth prompt.

No database, schema, frontend, credentials, or existing application workflows are changed.

## Apply on Linux / Ubuntu
Open Terminal in the existing `AttendPro-Smart-Biometric-HRMS` project directory:

```bash
unzip -o ~/Downloads/AttendPro-No-Browser-Auth-Popup-PATCH.zip -d .
python -m pytest -q tests/test_app_api.py
git status
git add app.py tests/test_app_api.py
git commit -m "Fix browser Basic Auth popup on API 401"
git push origin main
```

If your default branch is not `main`, replace `main` with your actual branch name.

## Deployment
- Render must redeploy the backend because `app.py` changed. If Render is connected to
  the same GitHub branch with auto-deploy enabled, the push should start the deployment.
- Vercel's static frontend does not need a code change for this fix. Leave the Vercel
  `Require Log In` setting OFF and save it.
- Wait for the Render deployment to finish, then open the Vercel production URL in a
  fresh Incognito window.

## Expected result
The browser's native `Sign in` username/password popup should no longer appear.
Unauthenticated API requests still return HTTP 401, so the AttendPro login/session
security remains in place. Users still need valid AttendPro credentials to access
protected dashboard functions.
