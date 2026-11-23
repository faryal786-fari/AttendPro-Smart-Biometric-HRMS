# AttendPro — Police Training College Lahore, Campus II Manawan

## Is update mein kya change hua?
- Public landing page ki identity ab **Police Training College Lahore — Campus II, Manawan** hai.
- Farooqabad ke title, logo/image URLs, contact details, history, gallery captions aur statistics hata diye gaye hain.
- Landing page par Campus I (Chung) aur Campus II (Manawan) ka farq explain kiya gaya hai.
- Thokar Niaz Baig ko current Manawan address nahi dikhaya gaya; usay Campus II ki 2004 wali historical location ke taur par mention kiya gaya hai.
- Punjab Police ke public record ke mutabiq Campus II June 2004 mein Thokar Niaz Baig ke qareeb establish hua aur June 2006 mein KC Factory, G.T. Road, Manawan shift hua.
- Police Training School Lahore ko 2012 mein Police College Lahore ka naam diya gaya.
- Public courses section mein Punjab Police Training Branch ki published course information use ki gayi hai. Campus-wise current course allocation ki guarantee nahi di gayi; page par administration se confirm karne ka note hai.
- Official principal ka naam, unki photo ya unka personal message invent nahi kiya gaya. Is ki jagah Punjab Police Training Branch ka published mission use kiya gaya hai.
- Farooqabad ki unrelated photos use nahi ho rahi. Hero, about aur training panels mein clearly illustrative SVG artwork use hua hai; ye actual Manawan campus photographs nahi hain.
- Main College contact phone/email official Punjab Police contact listing se liye gaye hain aur page par clear note hai ke ye Chung main administration contacts hain, Manawan campus ke direct contacts ke taur par verify nahi hue.
- AttendPro portal, login flow, Dashboard, Employees, Attendance, Reports, Redis, Scheduler, Device Status, Settings aur existing application scripts ko change nahi kiya gaya. Is update ka main code change `static/index.html` ke public landing page section aur uski landing styles hain.

## Important source distinction
1. Punjab Police Training Branch page Campus II ki history batata hai: June 2004 near Thokar Niaz Baig; June 2006 shift to KC Factory, G.T. Road, Manawan. It also records the Police College Lahore designation in 2012.
2. Police College Lahore institutional information describes Campus I at Chung and Campus II at Manawan. The campus-specific Manawan capacity/course allocation on non-official pages has deliberately not been represented as a current official fact.

## Deploy
- Vercel Root Directory apni current working configuration ke mutabiq hi rakhein; agar existing project `static` root se deploy ho raha hai to usay `static` hi rehne dein.
- `static/vercel.json`, backend API rewrites, Supabase migrations, Redis configuration, scheduler aur environment variables ko is landing update ke liye change na karein.
- GitHub par branch push karein, Pull Request review/merge karein, phir Vercel Production deployment ke `Ready` hone ka wait karein.

## Approval items before official public launch
- Manawan campus ki approved, real photographs upload karna.
- Current Manawan campus direct phone/email confirm karna (abhi shown contact main College administration ka hai).
- Current Commandant/Principal name and approved message confirm karna, agar page par publish karna ho.
- Current campus-wise course schedule/seat details confirm karna.
