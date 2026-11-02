# AttendPro — Latest Update (Phase 2 + Phase 3)

## Aapki requested UI fixes

1. **Quick Reports fixed:** har quick-report button apna correct date range aur filter set karta hai. Result right-side white Report Preview panel mein show hota hai.
   - Today's Attendance Register: latest stored attendance date use karta hai, isliye agar MDB ka latest data kal/previous month ka ho to blank current-date report nahi banti.
   - This Week Summary: latest stored date tak pichhle 7 din.
   - Late Arrivals: latest stored data ke month ki late entries.
   - Missing Check-outs: check-in present aur check-out missing rows.
   - Department Summary: department-wise employees/present/late/absent/on-leave summary.
2. **System Users descriptions:** View Only, Supervisor aur Super Admin ki descriptions English mein.
3. **Browser confirmation:** Logout confirmation English mein — “Are you sure you want to log out?”

## Phase 2 — One-hour scheduler + Redis read cache

- FastAPI background scheduler har 3600 seconds minimum par run karta hai.
- Sirf configured MDB path aur Automatic Sync enabled devices scheduled scan mein shamil hote hain.
- Redis distributed lock multiple app workers mein duplicate scheduled jobs rokta hai.
- MDB read-only scan hota hai; original MDB mein koi write-back nahi.
- Cloud mode mein source rows Supabase confirm hone ke baad hi Redis snapshot refresh hota hai.
- Dashboard, employee, attendance, attendance-history aur discrepancy GET APIs 3600-second Redis response cache use karti hain.
- Successful manual writes aur hourly refresh API response cache invalidate karte hain.
- Scheduler status: `GET /api/scheduler/status`.
- Super Admin manual test: `POST /api/scheduler/run`.

## Phase 3 — Discrepancy exception + correction protection

- Missing check-in/out, biometric-not-configured aur leave-with-punch issues discrepancy list mein track hote hain.
- Automatic On Leave rule sirf explicitly confirmed `not_configured` employee par, current work date ke original MDB check-in punch ke saath trigger hota hai.
- `unknown` biometric enrollment par automatic leave nahi lagti.
- Existing human correction ko automatic rule overwrite nahi karta.
- Supabase mode mein automatic exception `attendpro_corrections`, `attendpro_correction_audit` aur `attendpro_discrepancy_reviews` mein `AttendPro Scheduler` actor label ke saath save hoti hai.
- Original MDB, Supabase source_daily aur raw_punches unchanged rehte hain.

## Required Supabase step

Supabase SQL Editor mein `supabase/002_hourly_cache_and_biometric_discrepancy.sql` ko migration 001 ke baad run karein.

## Environment

`.env.example` mein required Redis/scheduler variables diye gaye hain. Apni actual `.env` file private rakhein. Device Status mein MDB path test karke Automatic database sync enable karein.

## Validation

- Python compilation: passed.
- Automated tests: 49 passed.
- Inline JavaScript syntax check: passed.
- Actual client Supabase credentials, live Redis server aur original MDB ke saath end-to-end verification aapke Ubuntu/client environment par karni hogi.

## Deployment

Is package mein deployment perform nahi ki gayi. Agla step aapki confirmation ke baad deployment hoga. Live MDB worker us machine/network par run hona chahiye jahan client ki original MDB accessible ho; cloud web host ko local MDB path direct access nahi hota.
