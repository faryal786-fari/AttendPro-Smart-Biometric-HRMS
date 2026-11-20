# AttendPro Landing Page Update — Roman Urdu

## Kya add hua hai?
- Root page ab public Police Training School Farooqabad landing page dikhata hai.
- Navigation: Home, About, Training, Facilities, Gallery, Contact.
- Hero section, institution history, core values, Principal message, training areas, campus facilities, gallery, contact aur AttendPro Portal CTA add kiye gaye hain.
- Public page se Portal Login click karne par existing AttendPro application khulti hai.
- Direct portal routes bhi supported hain: `#portal=dashboard`, `#portal=reports`, `#portal=employees`, etc.
- Existing app screens, API calls, authentication, role permissions, Redis, Scheduler, MDB read-only flow aur report functions ko replace nahi kiya gaya.
- Existing portal ke topbar mein Website button aur login overlay mein Back to Website link add kiya gaya hai.

## Important
- Landing page ki campus photos aur emblem PTS Farooqabad ki public website se load hotay hain. Internet connection zaroori hai.
- Public page ke institutional facts reference website aur Punjab Police ke public information se liye gaye hain. Kisi bhi official publication se pehle school administration se content/contact details confirm kar lena behtar hai.
- Is update mein database schema, Supabase migrations, Redis configuration ya scheduler logic change nahi ki gayi.

## Deploy
Vercel ka Root Directory `static` hi rakhein. `static/vercel.json` ko replace na karein. GitHub par branch push karne ke baad Vercel deployment complete hone dein. Agar Render service bhi isi repository se static homepage serve karti hai to Render par bhi latest commit deploy karein.
