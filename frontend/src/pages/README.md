# Frontend page ownership

The current AttendPro UI is a vanilla JavaScript single-page application. Keep these three top-level page regions in `frontend/index.html`:

1. Public institutional landing page: `#apPublicLanding`
2. Portal sign-in page: `#loginOverlay`
3. Authenticated HRMS dashboard: `.app` / `#appShell`

The public-landing navigation and transitions are in `../js/public-landing.js`. The portal login, authenticated state and dashboard modules remain in `../js/attendpro-app.js`. Keep the existing IDs and `data-screen` route values stable because the dashboard modules and regression tests depend on them.
