# AttendPro — Female Trainee MDB Auto-Sync (Roman Urdu)

## Kya karta hai

- Existing configured ZKTeco MDB se sirf `USERINFO` aur `DEPARTMENTS` tables read karta hai.
- Sirf us department ko trainee source maanta hai jiska exact naam `CORPORAL 02 TRAINIES F` ho.
- Sirf us verified parent department ke direct child platoons ke users select karta hai (current MDB mein `CORPORAL PUNJAB` aur `CORPORAL GILGIT`).
- Selected records ko existing `pts_trainees` table mein sync karta hai.
- Staff `employees`, `daily`, `punches`, original MDB aur attendance punches ko modify nahi karta.
- Existing trainee ka status, father name aur course dates preserve karta hai. Name/platoon ki source update ho sakti hai.
- Repeated sync duplicate rows nahi banata; employee number + course/platoon matching use hoti hai.

## Auto-sync kab chalega

Jab AttendPro ka existing Device MDB Sync ya Hourly MDB Scheduler chalega, usi successful MDB sync ke baad trainee roster bhi Supabase/local `pts_trainees` mein sync hoga. Is tarah initial upload ke liye device ka **Sync Now** ek baar chalana hai. Uske baad existing hourly scheduler ke enabled hone par automatic update hoga.

## Requirements

- Backend usi computer/server par chalna chahiye jahan configured `.mdb` path accessible ho.
- Linux host par `mdbtools` (`mdb-export`) installed ho.
- Supabase mode mein existing migration `005_pts_training_management.sql` pehle se apply honi chahiye; is patch ko koi nayi SQL migration nahi chahiye.
- Supabase `.env` mein server-side service key configured ho. Secret key frontend mein kabhi na daalein.

## Expected initial result (provided MDB snapshot)

- `CORPORAL PUNJAB`: 17
- `CORPORAL GILGIT`: 42
- Total candidates: 59

Course parent department ke naam se initialize hota hai, aur platoon child department ke naam se. MDB mein father name aur course dates nahi hain, is liye woh blank rahenge. Baad mein Supervisor/Admin portal se edit kar sakta hai.

## Safety

Agar expected parent department na mile, duplicate badge number ho, ya name/ID missing ho to sync abort hoga aur existing trainee records ko delete nahi karega. Yeh patch MDB mein write nahi karta aur punch data ko trainee attendance mein convert nahi karta.
