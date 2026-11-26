# AttendPro — Redis & Scheduler Monitor (Roman Urdu)

## Naya section kahan hai?

AttendPro ke left sidebar mein **System → Redis & Scheduler** open karein. Ye page existing Dashboard, Employees, Attendance Records, Discrepancies, Reports, Device Status aur Settings se alag hai.

## Is page par kya show hota hai?

- Redis connection: Connected / Disconnected / Not Configured
- Scheduler: Running / Starting / Stopped
- Scheduler interval, last start, last completion aur next run
- Redis keys, API cache TTL aur snapshot generation time
- Cached datasets aur har dataset ke record/chunk counts
- Supabase cloud sync aur pending source upload ka status
- MDB devices ka configured/automatic sync status aur last error
- Recent scheduler/cache activity logs
- Super Admin ke liye cached data ka read-only sample preview

## Buttons aur permissions

- **Refresh Status:** tamam roles ke liye; sirf status APIs dobara read karta hai.
- **Refresh Redis Cache:** sirf Super Admin; current AttendPro read projection ka Redis snapshot dobara banata hai. Ye button MDB ko dobara read nahi karta.
- **Run Scheduler Now:** sirf Super Admin; configured MDB devices ko read karta hai, Supabase workflow chalata hai (agar enabled ho), aur phir Redis snapshot refresh karta hai.
- **View Data:** sirf Super Admin; selected Redis dataset ke pehle chunk ke pehle 10 records ka read-only preview dikhata hai.

View Only aur Supervisor users monitor dekh sakte hain, lekin cache refresh, scheduler run ya cached sample inspection nahi kar sakte.

## Activity logs kahan save hote hain?

Monitor ke operational logs AttendPro ki local application SQLite database ke `settings` table mein `monitor_activity_log` key ke andar save hote hain. Ye attendance source records nahi hain aur original ZKTeco MDB ko touch nahi karte. Latest 100 events rakhe jate hain.

## Important data safety

- Original `att2000.mdb` read-only rehta hai; is project mein us par write operation nahi hota.
- `source_daily` original imported biometric attendance ko represent karta hai.
- `effective_daily` current attendance ko represent karta hai jisme approved corrections apply ho sakti hain.
- Supabase enabled hone par Supabase permanent cloud data source rehta hai; Redis rebuildable cache hai.
- Agar Redis connected nahi ya snapshot abhi bana nahi, to dataset counts zero/empty ya unavailable dikh sakte hain. Pehle `.env` mein `REDIS_CACHE_ENABLED=1`, valid `REDIS_URL`, aur `ATTENDPRO_HOURLY_SCHEDULER_ENABLED=1` verify karein.
- Scheduler ka minimum interval code mein 3600 seconds (1 hour) enforce hai.

## APIs used by this monitor

- `GET /api/cache/status`
- `POST /api/cache/refresh` (Super Admin)
- `GET /api/cache/snapshot/{dataset}?chunk=0` (Super Admin)
- `GET /api/scheduler/status`
- `POST /api/scheduler/run` (Super Admin)
- `GET /api/cloud/status`
- `GET /api/monitor/logs?limit=30`
