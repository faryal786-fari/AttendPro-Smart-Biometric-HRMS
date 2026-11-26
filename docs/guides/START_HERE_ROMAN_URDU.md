# AttendPro — Start Here (Roman Urdu)

Aapka original AttendPro layout preserve kiya gaya hai. Is build mein multi-device status/switching, dark mode, employee attendance dropdown, local attendance review/update, Excel template export aur 3 user roles add kiye gaye hain.

## 1) Ubuntu par run karein

```bash
sudo apt update
sudo apt install -y python3-venv python3-pip mdbtools libreoffice
cd ~/Downloads/AttendPro_Merged_Project
bash start.sh
```

Browser mein **http://127.0.0.1:8000** kholein. `attendance-proto.html` ko double-click na karein.

## 2) Pehla login

First run ke liye:
- **Username:** `admin`
- **Password:** `admin123`

Login ke baad **System Users** mein ja kar default password change kar dein. Users ke liye 3 roles hain:
- **View Only User:** dashboard/attendance dekhna, report export aur print.
- **Supervisor:** view-only ke rights + local attendance check-in/check-out aur review/update.
- **Super Admin:** tamam rights, including devices aur users manage karna.

## 3) Multiple devices

1. Sidebar mein kisi device ke blue item par click kar ke switch karein.
2. **Device Status → + Add Device** se naya device add karein.
3. Har device ka naam, model, serial number aur uske live `att2000.mdb` ka full path set karein.
4. **Test MDB** se path verify karein; phir **Sync Now** chalayein.
5. Automatic sync on karne ke liye active device ki connection settings mein checkbox tick karein.

Agar sab biometric terminals ek hi central `att2000.mdb` mein data likhte hain, to har terminal ke liye alag copy banane ke bajaye usi live central database ka path use karein. Har alag MDB configure karne par records AttendPro ke local attendance view mein combine ho sakte hain.

## 4) Attendance records edit karna

Attendance Records mein employee ke naam par click kar ke selected date range ki attendance history expand karein. **Review / Update** se clock-in, clock-out, shift aur status update kar sakte hain. Supervisor aur Super Admin hi update kar sakte hain.

Yeh edits sirf AttendPro ke `data/attendance.sqlite3` local read-model mein save hoti hain. **Original ZKTeco `att2000.mdb` ko app write nahi karti.** Excel export ko edit karne se bhi main database update nahi hota.

## 5) Reports / Excel template

Reports & Exports mein date range/department/employee filter karein, phir Preview Report chalayein. Supervisor/Super Admin preview cells mein report copy edit kar sakte hain. **Export / Open Editable Excel** aapki di hui Police Training College report template ke mutabiq `.xlsx` file download karta hai, jise Excel ya LibreOffice mein khol kar edit kiya ja sakta hai. Browser desktop Excel app ko khud se launch nahi kar sakta, is liye file download hone ke baad usay open karein.

Excel export mein template ki 2 sheets hoti hain: `Absent+ Late` summary aur `Sheet1` attendance data. CSV export aur Print bhi available hain.

## 6) Live MDB connection

- Ubuntu par `mdbtools` required hai.
- Windows par rakhi MDB ke liye client IT se secured read-only network share/mount arrange karwayein.
- Purani/copied MDB sirf us copy ke records dikhayegi; live updates ke liye wohi file connect karein jo ZKTeco software update karta hai.

Bundled Excel data historical preview ke liye hai. Client ki actual MDB ke saath live connection ko client ke network par **Test MDB** aur **Sync Now** se verify karna hoga.


## 29 October UI Update (AttendPro A-Z Profiles)

- **Important:** `frontend_source/attendance-proto-original.html` sirf purana static DEMO reference hai; use file:// se na kholein. Real updated UI sirf `http://127.0.0.1:8000` par chalti hai.
- Dashboard > Today's Attendance Distribution donut ab visibly bara hai; colors, layout aur baqi dashboard same.
- People > Employees mein original employee table preserved hai; Name default A–Z sorted. Header column click se A–Z / Z–A ascending-descending ho sakta hai.
- Har employee ka **name** ya **View** click karen, usi row ke neeche 9 profile fields aur latest 15 days ki history expand hogi. 'Open Profile Modal' se pehle wala modal bhi milega.
- Attendance Records flat list hi hai, koi employee dropdown nahi. Review / Update permissions same.
- Jo field asli DB mein nahi (designation, shift) usay invented data nahi samjhein: 'Not provided' ya default label show ho sakta hai.
- Backend purani client Access database READ-ONLY read karta hai. Manual attendance edit local SQLite mein save hoti hai; source MDB automatically update NAHI hota.
- Agar client ki live MDB alag computer par ho, to machine's local data ko use karne ke liye shared/Mounted path set karna hoga.


## Layout Update — Blue Sidebar + White Workspace (same A-Z project)

Yeh updated build **AttendPro_AZ_Employee_Profiles_Live_Dashboard.zip** ka hi existing frontend aur backend hai; sirf layout controls add kiye gaye hain.

1. Top bar mein **☰** click karein: blue left menu compact ya expanded ho jayega.
2. Blue aur white section ke darmiyan thin border ko **mouse se drag** karein: blue sidebar ki width change hogi aur right white workspace automatically stretch/shrink hoga.
3. Divider ko **double-click** karein: default 240px width restore ho jayegi.
4. Top bar mein **⛶** dabayein: blue menu hide aur white workspace full window width ho jayegi. Dobara dabayein to menu restore hoga.
5. Size settings browser mein save rahengi. Mobile par menu compact dikhega.

**Baqi sab same:** employee directory default A–Z, employee in-row profiles/history, bigger donut, flat attendance records, dark mode, reports, roles, multi-device support, aur existing FastAPI/SQLite/MDB sync.

**Important:** Browser se `attendance-proto-original.html` open na karein. Always `bash start.sh` chala kar `http://127.0.0.1:8000` open karein.

## Latest changes: Employees A–Z + Sidebar Half Screen

1. **People > Employees** kholein. List mein ab sirf employee name aur arrow hoga, separate Employee ID/Department/Status columns nahi honge.
2. Original MDB mein kai names ke andar `ASI-`, `CONS-`, `HC-` aur service numbers shamil hain. Employees list sirf display ke waqt rank/service label hata kar clean naam A–Z dikhati hai. Original database aur stored name **badalte nahi**. Original entry employee profile mein bhi available hai.
3. Kisi naam par click karein: uske neeche 9 profile fields aur attendance history expand ho jayegi. Doosri baar click se close.
4. Top search ya Employees search mein naam likhein. Agar blank screen aaye to **Clear Filters** dabayein; yeh department/status/search ke purane filters clear karega.
5. Blue sidebar aur white workspace ke darmiyan divider ko drag karein. Maximum blue width screen ke 50% tak hai. `☰` se collapse aur `⛶` se full white workspace ho sakta hai.
6. **+ Add Employee** Super Admin ke liye hai; local AttendPro SQLite mein entry banegi. Yeh biometric machine mein enrollment nahin hai; original MDB read-only rahega.
7. Client ki real attendance ke liye **Device Status** mein unki **live** `att2000.mdb` ka full path dein, test karein aur auto-sync enable karein.

Agar pichla browser tab purana UI dikhaye to Ctrl+Shift+R se hard refresh karein aur hamesha `http://127.0.0.1:8000` use karein, na ke Downloads wali standalone HTML file.
