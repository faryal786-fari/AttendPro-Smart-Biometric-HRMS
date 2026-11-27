ATTENDPRO — Targeted Login/Staff UI + Private Female Trainee MDB Preview

WHAT CHANGED
- Existing login page ke left-side decorative panel ko CSS se hide kiya gaya hai.
- Wahi original Passing Out Parade image background mein nazar aati hai.
- Existing Supabase login card full center mein hai; ID/password/Show Password unchanged.
- Staff KPI cards ka appearance Trainee KPIs jaisa kiya hai; labels, counts, handlers unchanged.
- Existing trainee distribution bars/recent activity aur staff charts unchanged.
- App ke authentication, API, DB, device, Redis, attendance modules touched nahi kiye.

IMPORTANT TRAINEE DATA FACT
Uploaded att20002(1).mdb file byte-for-byte same hai as pehle uploaded att20002.mdb.
MDB existing staff/trainee distinction prove nahi karta. Is liye production mein
kisi USERINFO record ko automatically trainee mark NAHI kiya gaya.

Private MDB ko check karne ke liye (Ubuntu machine):
  python3 backend/scripts/preview_attendpro_mdb_trainees.py \
    --mdb "$HOME/AttendPro-MDB-Private/data/source/att20002.mdb"

Is se sirf department IDs/names aur user counts print honge. Names ya passwords
Terminal mein print nahi honge. Agar Police college officially confirm kare ke
koi particular department ID female trainees ka hai, to department ID aur
course name use karke private CSV generate ki ja sakti hai:

  python3 backend/scripts/preview_attendpro_mdb_trainees.py \
    --mdb "$HOME/AttendPro-MDB-Private/data/source/att20002.mdb" \
    --approved-dept-id "VERIFIED_DEPT_ID" \
    --course-name "VERIFIED_COURSE" \
    --output "$HOME/AttendPro-MDB-Private/PTS_Verified_Female_Trainees.csv" \
    --confirm ROSTER_VERIFIED

CSV ka personal data ab department-approved staff review kare. Phir logged-in
Supervisor/Admin ke Trainee roster import feature se upload kare. Is se dashboard
ke trainee counts populate honge. Daily attendance records ke liye authorized
attendance import/marking separately required hai; MDB punch rows ko as trainee
infer karke auto-copy na karein.

Do NOT upload MDB/CSV to GitHub or share employee records publicly.
