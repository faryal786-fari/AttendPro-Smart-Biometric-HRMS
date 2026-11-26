# AttendPro — Redis Phase 2 Scheduler + Phase 3 Discrepancy Rules

Yeh guide Redis Phase 1 ke baad chalani hai. Existing frontend ka layout, colors,
sidebar aur baqi attendance features isi tarah rakhe gaye hain.

## Architecture

```text
ZKTeco Machine
    |
Existing ZKTeco Software
    |
att2000.mdb  (READ ONLY)
    |
Python / mdbtools hourly worker
    |
Supabase source tables  (permanent original records)
    |
SQLite read projection on the local bridge
    |
Redis snapshots + one-hour API response cache
    |
AttendPro FastAPI + existing frontend
```

- MDB ko sirf `mdbtools` read commands se read kiya jata hai. Koi SQL UPDATE/INSERT MDB mein nahi hota.
- Original biometric punches aur source attendance Supabase ke `attendpro_raw_punches` aur `attendpro_source_daily` mein rehte hain.
- Supervisor/Admin corrections `attendpro_corrections` aur `attendpro_correction_audit` mein save hoti hain.
- Redis rebuildable cache hai, permanent database nahi.
- Successful user write par relevant API cache invalidate hota hai; scheduled refresh par bhi cache invalidate hota hai.

## 1. Supabase migration 002 run karein

Aap pehle `001_attendpro_schema.sql` run kar chuke hain. Ab project ke `supabase` folder mein:

`002_hourly_cache_and_biometric_discrepancy.sql`

file ko Supabase Dashboard → SQL Editor → New Query mein open karke poora SQL Run karein.

Is migration mein:
- Correction, audit aur discrepancy review records mein `actor_type` / `actor_label` add hote hain.
- Human edits `user` ke taur par label hoti hain.
- Automatic exception `AttendPro Scheduler` ke naam se audit hoti hai.
- `attendpro_apply_biometric_exception` RPC create hota hai.
- Tables ki RLS/backend-only permissions barqarar rehti hain.

SQL migration ko successful run karne ke baad Supabase Table Editor mein correction/audit tables verify karein.

## 2. `.env` configuration

Project folder mein `.env` open karein. Apni existing Supabase URL, publishable key aur secret key ko change na karein. Yeh Redis/scheduler values add ya verify karein:

```env
REDIS_CACHE_ENABLED=1
REDIS_URL=redis://127.0.0.1:6379/0
REDIS_API_CACHE_TTL_SECONDS=3600
REDIS_KEY_PREFIX=attendpro:v1
ATTENDPRO_HOURLY_SCHEDULER_ENABLED=1
ATTENDPRO_MDB_SCHEDULER_INTERVAL_SECONDS=3600
REDIS_SCHEDULER_LOCK_TTL_SECONDS=4200
ATTENDPRO_AUTO_LEAVE_UNCONFIGURED_BIOMETRIC=1
```

Code scheduler interval ko 3600 seconds (1 hour) se kam allow nahi karta. Device settings mein agar purana interval 90 seconds bhi ho, automatic scheduler phir bhi 1 hour se pehle MDB read nahi karega.

## 3. Redis start karein

Ubuntu par:

```bash
sudo systemctl enable --now redis-server
redis-cli ping
```

Expected: `PONG`.

## 4. Device par Automatic Sync enable karein

AttendPro mein Super Admin login karein:

1. Device Status open karein.
2. Existing `att2000.mdb` ka actual local path set karein.
3. Test MDB successful karein.
4. Automatic database sync checkbox enable karein.
5. Save Database Settings karein.

Hourly scheduler sirf configured devices jin par Automatic Sync enabled ho, unko schedule par read karta hai. Manual Sync Now button existing tarah kaam karta rahega.

## 5. Scheduler ka workflow

Application startup par existing read projection ka Redis snapshot load hota hai. Uske baad scheduler har 3600 seconds baad:

1. Redis distributed lock leta hai taake ek hi scheduled job multiple workers mein duplicate na chale.
2. Automatic Sync enabled devices ki MDB file read-only scan karta hai.
3. File signature unchanged ho to duplicate full import avoid hota hai.
4. Naye raw punches aur source attendance local read projection mein import hoti hai.
5. Cloud mode mein source records Supabase mein upload/verify hote hain.
6. Confirmed biometric exception rule evaluate hota hai.
7. Latest Supabase source + corrections local read projection mein pull hote hain.
8. Redis snapshots rebuild hote hain aur one-hour API response cache invalidate hota hai.
9. Last run, result, errors aur next run local scheduler status mein record hote hain.

## 6. Scheduler status aur manual test

Login ke baad browser mein:

```text
http://127.0.0.1:8000/api/scheduler/status
```

Ismein enabled flag, 3600-second interval, Redis connectivity, last run, next run aur configured device status milta hai.

Super Admin manual test:

```bash
curl -X POST -b 'attendpro_cloud_access=YOUR_SESSION_TOKEN' \
  http://127.0.0.1:8000/api/scheduler/run
```

Manual run sirf testing/admin action hai; automatic scheduler ka minimum one-hour interval phir bhi enforce hota hai.

## 7. Redis se API reads

Dashboard, employees, attendance records, attendance history aur discrepancy read endpoints ke JSON responses Redis mein 3600 seconds tak cache ho sakte hain.

- Same query dobara aaye to Redis cached result use hota hai.
- Manual attendance correction / employee / discrepancy write ke baad API cache invalidate hota hai.
- Hourly MDB/Supabase refresh ke baad API cache invalidate hota hai.
- Redis unavailable ho to API existing authoritative SQLite read projection se fallback karti hai.
- Redis cache expire/lost ho jaye to snapshots aur API responses dobara rebuild ho sakte hain.

## 8. Discrepancy exception rule

Automatic On Leave rule sirf tab chalega jab ye teen conditions ek sath true hon:

1. Employee profile mein biometric enrollment ko Supervisor/Super Admin ne explicitly `Not Configured` confirm kiya ho.
2. Original source attendance mein us date ka check-in ho.
3. Us employee/date ke liye original MDB raw punch exist karta ho.

`Unknown / Not Verified` ko kabhi Not Configured nahi maana jata. Excel-only attendance row ya bina MDB punch ke record par automatic leave nahi lagti.

Agar teeno conditions match hon:
- Effective attendance status `On Leave` hota hai.
- `biometric_not_configured` aur `leave_with_punch` discrepancy reviews automatic `AttendPro Scheduler` actor ke sath resolved store hote hain.
- Original `raw_daily`, `raw_punches`, Supabase `attendpro_source_daily`, Supabase `attendpro_raw_punches`, aur original MDB unchanged rehte hain.
- Agar pehle se human correction exist karti hai to automatic rule usay overwrite nahi karta.
- Missing check-out/check-in jaise doosre unresolved issues review queue mein reh sakte hain.

Automatic rule sirf current local work date par apply hota hai; purani history ko retroactively On Leave nahi banata.

## 9. Correction write-protection

Supervisor/Admin ka manual edit:

```text
AttendPro -> FastAPI role check -> Supabase correction RPC
          -> attendpro_corrections + attendpro_correction_audit
          -> local effective projection -> Redis refresh
```

MDB importer sirf `raw_daily` / source tables ko update karta hai. Manual corrections `daily` effective projection aur Supabase correction layer mein rehti hain. Importer corrections ko source rows mein merge nahi karta.

## 10. Quick Reports aur English UI fixes

- Quick Reports har button ke liye apna date range/filter set karta hai.
- Reports ka default date latest stored attendance date hota hai, current system date nahi; isliye historical data ke liye blank preview nahi aana chahiye.
- Department Summary aggregate table banata hai; is report ke liye CSV/Print available hain.
- System Users role descriptions aur Logout confirmation English mein hain.

## Important production boundary

Yeh scheduler us Ubuntu/computer par run hona chahiye jahan client ki original MDB file ka path accessible ho. Render/cloud web server ko local client MDB ka direct path available nahi hota. Deployment ke waqt local MDB bridge/worker alag on-prem process hoga; cloud website Supabase/Redis se data read karegi.
