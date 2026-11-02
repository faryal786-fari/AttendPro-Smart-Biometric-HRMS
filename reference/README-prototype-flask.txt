╔══════════════════════════════════════════════════════════╗
║           AttendPro — Setup (2 Steps Only)              ║
╚══════════════════════════════════════════════════════════╝

STEP 1 — api.py chalao (Windows PC par jahan att2000.mdb hai):
──────────────────────────────────────────────────────────────
  1. api.py mein MDB_PATH check karo (line 18)
     Default: C:\Program Files (x86)\ZKTeco\att2000.mdb

  2. Terminal mein:
     pip install flask flask-cors pyodbc
     python api.py

  3. Dikhaey ga: "AttendPro API chal raha hai → http://localhost:5000"


STEP 2 — index.html browser mein kholo:
────────────────────────────────────────
  attendance-proto.html double-click karo.
  Ya kisi bhi PC par:  http://[windows-pc-ip]/  (agar same network)


BAS. Kuch aur nahi. ✅
──────────────────────
- att2000.mdb → haath nahi lagaya
- Att.exe     → haath nahi lagaya  
- Devices     → haath nahi lagaya
- New DB      → nahi banaya

Sirf ek Python file padhti hai jo pehle se bani hai.
