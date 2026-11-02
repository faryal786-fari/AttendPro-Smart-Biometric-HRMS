# AttendPro Redis — Phase 1 + Phase 2 + Phase 3 Setup (Roman Urdu)

## Is guide ka maqsad

Redis snapshot, one-hour MDB scheduler, read-through API cache aur biometric discrepancy exception rules ab is project mein implement hain. Detailed updated steps `REDIS_PHASE2_PHASE3_SETUP_ROMAN_URDU.md` mein hain.

## Architecture boundary

- Original ZKTeco `att2000.mdb`: sirf read-only source.
- Python FastAPI: MDB/SQLite read projection ko process karta hai.
- Redis: rebuildable cache snapshot; permanent database nahi.
- Supabase PostgreSQL: cloud ka permanent source of truth.
- `raw_daily` / `raw_punches`: original imported evidence.
- `daily` / `cloud_adjustment_cache`: effective attendance aur Supabase correction overlay.
- `discrepancy_reviews`: discrepancy decisions; original punch data se alag.

Redis mein original aur effective attendance alag keys mein store hoti hain. Redis se kabhi MDB mein write-back nahi hota.

## 1. Ubuntu par Redis install karein

```bash
sudo apt update
sudo apt install -y redis-server
sudo systemctl enable --now redis-server
sudo systemctl status redis-server
```

Redis test:

```bash
redis-cli ping
```

Expected result:

```text
PONG
```

## 2. Python dependencies install karein

Project folder mein:

```bash
source .venv/bin/activate
pip install -r requirements.txt
```

Is phase mein `redis` Python package add hua hai.

## 3. Environment variables set karein

`.env` file open karein:

```bash
nano .env
```

Yeh values add karein:

```env
REDIS_CACHE_ENABLED=1
REDIS_URL=redis://127.0.0.1:6379/0
REDIS_API_CACHE_TTL_SECONDS=3600  # Phase 2 ke API read-cache ke liye
REDIS_KEY_PREFIX=attendpro:v1
```

Save: `Ctrl+O`, Enter, `Ctrl+X`.

`.env` ko GitHub, ZIP share, WhatsApp ya screenshot mein share na karein.

## 4. AttendPro start karein

```bash
bash start.sh
```

Application startup par current local read-projection Redis mein snapshot hogi. MDB ko touch/write nahi kiya jata.

## 5. Redis connection aur data verify karein

AttendPro mein login karein. Phir browser mein:

```text
http://127.0.0.1:8000/api/cache/status
```

Is endpoint ke liye login required hai. Expected response mein:

- `enabled: true`
- `configured: true`
- `connected: true`
- `snapshot.generated_at`
- `snapshot.counts.employees`
- `snapshot.counts.source_daily`
- `snapshot.counts.effective_daily`
- `snapshot.counts.raw_punches`
- `snapshot.counts.discrepancy_reviews`

Agar Redis connect nahi hai to `last_error` check karein.

Super Admin current projection ka snapshot manually refresh kar sakta hai:

```text
POST http://127.0.0.1:8000/api/cache/refresh
```

Super Admin cached rows ka ek 500-record chunk browser/API se dekh sakta hai, misaal:

```text
GET http://127.0.0.1:8000/api/cache/snapshot/employees?chunk=0
GET http://127.0.0.1:8000/api/cache/snapshot/effective_daily?chunk=0
GET http://127.0.0.1:8000/api/cache/snapshot/discrepancy_reviews?chunk=0
```

Dataset names: `employees`, `source_daily`, `effective_daily`, `raw_punches`,
`discrepancy_reviews`, `correction_overrides`, `attendance_audit`, `devices`.
Yeh debug/verification API sirf Super Admin ko available hai.

Browser address bar GET request bhejta hai; POST ke liye API client/curl use karein:

```bash
curl -X POST \
  -b 'attendpro_cloud_access=YOUR_SESSION_TOKEN' \
  http://127.0.0.1:8000/api/cache/refresh
```

Cloud login cookie ko command history ya kisi ke sath share na karein. Behtar hai logged-in browser dev tools se request karein; normal operation mein startup aur successful data writes snapshot ko refresh karte hain.

## 6. Redis keys dekhna

All AttendPro snapshot keys:

```bash
redis-cli --scan --pattern 'attendpro:v1:snapshot:*'
```

Snapshot manifest:

```bash
redis-cli GET 'attendpro:v1:snapshot:meta'
redis-cli GET 'attendpro:v1:snapshot:employees:manifest'
redis-cli GET 'attendpro:v1:snapshot:source_daily:manifest'
redis-cli GET 'attendpro:v1:snapshot:effective_daily:manifest'
redis-cli GET 'attendpro:v1:snapshot:raw_punches:manifest'
redis-cli GET 'attendpro:v1:snapshot:discrepancy_reviews:manifest'
```

Actual rows 500-record chunks mein hain, misaal:

```bash
redis-cli GET 'attendpro:v1:snapshot:employees:000000'
redis-cli GET 'attendpro:v1:snapshot:effective_daily:000000'
```

Redis mein data strings/JSON chunks ki surat mein hoga. `manifest` mein chunk count aur total records honge.

## 7. Snapshot kab update hota hai?

Phase 1 mein Redis snapshot in events par refresh hota hai:

1. AttendPro startup par, initial Supabase projection pull ke baad.
2. MDB sync se naye/changed source records milne par.
3. Attendance correction, discrepancy decision, employee/device update ya Excel import successful hone par.

Agar Redis temporarily band ho jaye to existing AttendPro backend Redis ke baghair bhi chalta rahega; Redis error log/status mein nazar aayega. Redis cache ko dobara source projection se rebuild kiya ja sakta hai.

## 8. Frontend aur API Redis se kaise read karte hain?

Dashboard, employees, attendance, attendance history aur discrepancy JSON read endpoints one-hour Redis response cache use karte hain. Successful manual writes aur scheduled refresh ke baad API cache invalidate hota hai. Redis unavailable ho to existing read projection se fallback hota hai.

## 9. Phase 2 — One-hour scheduler

- Local/on-prem Python worker har 3600 seconds baad Automatic Sync enabled MDB devices ko read-only scan karta hai.
- Scheduler Redis distributed lock use karta hai taake duplicate jobs na chalain.
- Naye/changed source records Supabase mein persist hone ke baad Redis snapshot refresh hota hai.
- Job run time, last success, next run aur errors `/api/scheduler/status` se milte hain.
- Cloud Render host local client MDB ko directly read nahi kar sakta; worker us machine/network par chalega jahan MDB accessible ho.

## 10. Phase 3 — Discrepancy rules / write protection

- Missing checkout, missing check-in, biometric not configured aur leave-with-punch discrepancy queue mein track hote hain.
- Sirf explicitly confirmed Not Configured employee ke original MDB check-in par automatic On Leave rule lagta hai.
- Unknown biometric status par automatic leave nahi lagti.
- Human corrections aur automatic exception Supabase correction + audit layer mein save hoti hain.
- Original MDB, source daily rows aur raw punches kabhi overwrite nahi hote.
- Existing human correction ko scheduler overwrite nahi karta.

Detailed SQL migration 002, `.env` aur run steps: `REDIS_PHASE2_PHASE3_SETUP_ROMAN_URDU.md`.

## 10. Production note

Local Redis URL `127.0.0.1` sirf usi computer ke liye hai. Production mein private managed Redis/Key Value service ka TLS URL `REDIS_URL` mein set karna hoga. Redis port `6379` ko public internet par expose na karein.

Supabase permanent database hai; Redis cache loss hone par cache ko Supabase/local read projection se rebuild karna mumkin hona chahiye.
