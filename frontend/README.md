# Frontend

This is the Vercel Root Directory.

The existing single-page application keeps its established DOM IDs, forms, routes and inline event-handler contracts. The UI is now separated by responsibility without converting it to a new framework:

- `index.html`: application shell containing three page regions: public landing (`#apPublicLanding`), portal login (`#loginOverlay`) and authenticated dashboard (`.app` / `#appShell`).
- `src/styles/main.css`: extracted stylesheet.
- `src/js/attendpro-app.js`: existing AttendPro dashboard, login and module logic.
- `src/js/public-landing.js`: public landing navigation and portal hash routing.
- `assets/`: public PTC logo and campus images.
- The unused historical prototype is preserved under `docs/archive/frontend-prototype/`; it is not loaded in production.

The public landing and portal login remain in one HTML shell because the existing app switches between them using the URL hash and body classes. This avoids duplicating or breaking the current login/dashboard state.
