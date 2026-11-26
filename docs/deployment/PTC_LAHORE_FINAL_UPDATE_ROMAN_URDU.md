# AttendPro — Police Training College Lahore (Chung + Manawan) Update

## Is update mein kya change hua?
- Website ka official-facing title **Police Training College Lahore** kar diya gaya hai.
- Hero section mein dono campuses show honge:
  - Main Campus: Chung, Thokar Niaz Baig ke qareeb.
  - Campus II: Manawan, G.T. Road, New Khan Metro Bus Depot ke qareeb.
- Thokar Niaz Baig aur Manawan ko ek hi current address nahi dikhaya gaya; dono campus locations ko alag rakha gaya hai.
- Pehle wali generated placeholder image hata di gayi hai.
- Aapke bheje hue screenshot se do visible campus photos crop karke `frontend/assets/` mein local files ke taur par add ki gayi hain.
- Gallery mein ye photos show hongi.
- AttendPro portal, backend APIs, FastAPI, Supabase, Redis, Scheduler, ZKTeco MDB import, reports aur HRMS modules ko is update mein touch nahi kiya gaya.

## Photo quality aur source note
Ye photos aapke bheje hue Google Images screenshot se crop ki gayi hain. Screenshot mein original photo URLs ya full-resolution images nahi the, is liye ye temporary low-resolution reference crops hain. Official website par final publish karne se pehle institution ki approved original high-resolution photos se replace karna behtar hai.

## Official location information
Punjab Police ki Training Branch website ke mutabiq:
- Police Recruit Training Centre 16 July 1989 ko Chung mein shift hua.
- Campus-II June 2004 mein Thokar Niaz Baig ke qareeb establish hua.
- Campus-II June 2006 mein KC Factory, G.T. Road, Manawan shift hua.
- Police Training School Lahore ko 2012 mein Police College Lahore ka naam diya gaya.

## Build identifier
`2026-11-23-ptc-lahore-two-campus-user-photos-v2`

## Scope
Sirf `frontend/index.html`, do local image assets aur documentation update ki gayi hai. Existing HRMS backend aur functions preserve kiye gaye hain.
