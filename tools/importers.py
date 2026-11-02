"""Read Excel .xls/.xlsx/.csv and ZKTeco Access reports into the local SQLite database.
All imports are idempotent and preserve source of each daily summary.
"""
from __future__ import annotations
from datetime import datetime,date,time,timedelta
from pathlib import Path
import csv,io,zipfile,xml.etree.ElementTree as ET,subprocess, shutil,hashlib
from .read_xls import get_sheets

def safe_datetime(value):
 if isinstance(value,datetime):return value.replace(tzinfo=None)
 if value is None:return None
 s=str(value).strip()
 if not s:return None
 for fmt in ('%Y-%m-%d %H:%M:%S','%Y-%m-%d %H:%M','%m/%d/%Y %H:%M:%S','%m/%d/%Y %H:%M','%d/%m/%Y %H:%M:%S'):
  try:return datetime.strptime(s,fmt)
  except ValueError:pass
 try:return datetime.fromisoformat(s.replace('Z','+00:00')).replace(tzinfo=None)
 except ValueError:return None

def date_value(v):
 if isinstance(v,datetime):return v.date().isoformat()
 s=str(v or '').strip()
 if not s:return ''
 for fmt in ('%m/%d/%Y','%Y-%m-%d','%d-%m-%Y','%d/%m/%Y','%m/%d/%y'):
  try:return datetime.strptime(s,fmt).date().isoformat()
  except ValueError:pass
 # Excel serial day (workbook dates only; 1900 date-system assumption)
 try:
  if 30000<float(s)<80000:return (datetime(1899,12,30)+timedelta(days=float(s))).date().isoformat()
 except ValueError:pass
 return ''

def minutes(v):
 s=str(v or '').strip()
 if not s or s in ('0','0.0'):return None
 if ':' in s:
  pieces=s.split(':')
  try:return int(pieces[0])*60+int(pieces[1])
  except ValueError:return None
 try:return round(float(s)*60)
 except ValueError:return None

def hhmm(v):
 s=str(v or '').strip()
 if not s:return None
 if isinstance(v,datetime):return v.strftime('%H:%M')
 if ':' in s:
  try:
   parts=s.split(':');return f'{int(parts[0]):02d}:{int(parts[1]):02d}'
  except (ValueError,IndexError):return None
 try:
  if 0<float(s)<1:
   mins=int(round(float(s)*24*60))
   return f'{mins//60%24:02d}:{mins%60:02d}'
 except ValueError:pass
 return None

def is_yes(v):return str(v or '').strip().lower() in ('true','yes','1','y','absent')
def key(v):return ''.join(ch for ch in str(v or '').strip().lower() if ch.isalnum())
def as_id(v):
 s=str(v or '').strip()
 if not s:return ''
 try:
  n=float(s)
  if n.is_integer():return str(int(n))
 except ValueError:pass
 return s

def xlsx_sheets(raw:bytes):
 z=zipfile.ZipFile(io.BytesIO(raw)); namespace={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
 ns=namespace['m'];ss=[]
 if 'xl/sharedStrings.xml' in z.namelist():
  root=ET.fromstring(z.read('xl/sharedStrings.xml'))
  for si in root.findall('m:si',namespace):ss.append(''.join(t.text or '' for t in si.findall('.//m:t',namespace)))
 book=ET.fromstring(z.read('xl/workbook.xml'))
 rels=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
 relmap={r.attrib['Id']:r.attrib['Target'] for r in rels}
 sheets={}
 for sheet in book.findall('m:sheets/m:sheet',namespace):
  rid=sheet.attrib.get('{%s}id'%namespace['r']);loc=relmap.get(rid,'')
  filepath=loc.lstrip('/') if loc.startswith('/xl/') else ('xl/'+loc.lstrip('/') if not loc.startswith('xl/') else loc)
  if filepath not in z.namelist():continue
  xml=ET.fromstring(z.read(filepath));cells={}
  for row in xml.findall('.//m:sheetData/m:row',namespace):
   rindex=int(row.attrib.get('r','1'))-1
   for c in row.findall('m:c',namespace):
    ref=c.attrib.get('r','A1');letters=''.join(ch for ch in ref if ch.isalpha());col=0
    for char in letters:col=col*26+(ord(char.upper())-64)
    col-=1;typ=c.attrib.get('t');v=c.find('m:v',namespace)
    if typ=='inlineStr':text=''.join(t.text or '' for t in c.findall('.//m:t',namespace))
    elif v is None:text=''
    elif typ=='s':text=ss[int(v.text)] if v.text else ''
    elif typ=='b':text='True' if v.text=='1' else ''
    else:text=v.text or ''
    cells[(rindex,col)]=text
  if cells:
   maxr=max(r for r,c in cells);maxc=max(c for r,c in cells)
   if maxr>100000 or maxc>300:raise ValueError('Unusually large spreadsheet; export to CSV')
   sheets[sheet.attrib.get('name','Sheet1')]=[[cells.get((r,c),'') for c in range(maxc+1)] for r in range(maxr+1)]
 return sheets

def get_workbook(raw:bytes, filename:str):
 suffix=Path(filename).suffix.lower()
 if suffix=='.xls':return get_sheets(raw)
 if suffix=='.xlsx':return xlsx_sheets(raw)
 if suffix=='.csv':
  text=raw.decode('utf-8-sig',errors='replace');return {'CSV':list(csv.reader(io.StringIO(text)))}
 raise ValueError('Use an XLS, XLSX or CSV attendance export')

def _row_map(row,head):return {head[i]:row[i] if i<len(row) else '' for i in range(len(head))}
def _pick(row,*keys):
 for k in keys:
  v=row.get(k,'')
  if v not in ('',None):return v
 return ''

def import_spreadsheet(db,raw:bytes,filename:str):
 wb=get_workbook(raw,filename);selected=None
 for sheet_name,rows in wb.items():
  for n,r in enumerate(rows[:12]):
   keys={key(x) for x in r}
   if 'name' in keys and ('acno' in keys or 'badgenumber' in keys or 'userid' in keys) and ('date' in keys or 'checktime' in keys):
    selected=(sheet_name,r,rows[n+1:]);break
  if selected:break
 if not selected:raise ValueError('No attendance table found. Expected Name, AC-No., Date, Clock In/Out columns.')
 sheet_name,header,body=selected
 hdr=[key(v) for v in header];detailed='empno' in hdr and 'realtime' in hdr
 source='excel_detailed' if detailed else 'excel_summary'
 employees=set();attended=0;skipped=0;events=0;dates=set()
 for row in body:
  a=_row_map(row,hdr)
  badge=as_id(_pick(a,'acno','badgenumber','userid'))
  name=str(_pick(a,'name')).strip()
  if not badge or not name or name.upper() in ('NILL','TOTAL','NAME'):skipped+=1;continue
  workdate=date_value(_pick(a,'date'))
  if not workdate:skipped+=1;continue
  dep=str(_pick(a,'department')).strip() or 'Unassigned'
  source_uid=as_id(_pick(a,'empno'))
  dtin=hhmm(_pick(a,'clockin'))
  dtout=hhmm(_pick(a,'clockout'))
  late=minutes(_pick(a,'late'))
  early=minutes(_pick(a,'early'))
  worked=minutes(_pick(a,'worktime'))
  if worked is None and dtin and dtout:
   try:
    first=datetime.fromisoformat(workdate+'T'+dtin);last=datetime.fromisoformat(workdate+'T'+dtout)
    if last>first:worked=int((last-first).total_seconds()/60)
   except ValueError:pass
  absent=is_yes(_pick(a,'absent'))
  if absent:status='absent'
  elif dtin or dtout:status='late' if late and late>0 else 'present'
  else:status='unknown'
  db.execute('''INSERT INTO employees(device_user_id,source_userid,badge_number,name,department) VALUES (?,?,?,?,?)
   ON CONFLICT(device_user_id) DO UPDATE SET
    source_userid=CASE WHEN excluded.source_userid!='' THEN excluded.source_userid ELSE employees.source_userid END,
    badge_number=excluded.badge_number,name=excluded.name,
    department=CASE WHEN excluded.department!='Unassigned' THEN excluded.department ELSE employees.department END,
    updated_at=CURRENT_TIMESTAMP''',(badge,source_uid,badge,name,dep))
  eid=db.execute('SELECT id FROM employees WHERE device_user_id=?',(badge,)).fetchone()['id']
  employees.add(eid);dates.add(workdate)
  # Preserve detailed source when overlapping summary sheets are uploaded.
  existing=db.execute('SELECT source FROM daily WHERE employee_id=? AND work_date=?',(eid,workdate)).fetchone()
  if not existing or existing['source']!='device' and (source=='excel_detailed' or existing['source']!='excel_detailed'):
   db.execute('''INSERT INTO daily(employee_id,work_date,status,clock_in,clock_out,late_minutes,
    early_minutes,work_minutes,shift,source,raw_absent) VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(employee_id,work_date) DO UPDATE SET status=excluded.status,clock_in=excluded.clock_in,
    clock_out=excluded.clock_out,late_minutes=excluded.late_minutes,early_minutes=excluded.early_minutes,
    work_minutes=excluded.work_minutes,shift=excluded.shift,source=excluded.source,raw_absent=excluded.raw_absent,
    updated_at=CURRENT_TIMESTAMP''',
    (eid,workdate,status,dtin,dtout,late,early,worked,str(_pick(a,'timetable')),source,str(_pick(a,'absent'))))
  for kind,tm in (('IN',dtin),('OUT',dtout)):
   if not tm:continue
   cur=db.execute('INSERT OR IGNORE INTO punches(employee_id,device_user_id,happened_at,kind,source) VALUES (?,?,?,?,?)',
    (eid,badge,workdate+'T'+tm+':00',kind,'excel_report'))
   events+=cur.rowcount
  attended+=1
 db.execute('INSERT INTO imports(filename,source,employee_rows,attendance_rows,skipped_rows,details) VALUES (?,?,?,?,?,?)',
  (filename,source,len(employees),attended,skipped,','.join(sorted(dates))))
 db.commit()
 return {'success':True,'filename':filename,'sheet':sheet_name,'source':source,'employees_found':len(employees),
   'rows_imported':attended,'skipped':skipped,'new_punches':events,'dates':sorted(dates)}


def import_mdb(db,mdb_file,limit=None):
 """Import Access tables via mdbtools (sudo apt install mdbtools).
 Historical punches are saved. Does not modify the original Access database.
 """
 if not shutil.which('mdb-export'):raise RuntimeError('mdbtools missing: sudo apt update && sudo apt install mdbtools')
 if not Path(mdb_file).is_file():raise FileNotFoundError(mdb_file)
 def stream_table(table):
  cmd=['mdb-export','-D','%Y-%m-%d %H:%M:%S',str(mdb_file),table]
  p=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8',errors='replace')
  try:
   for idx,row in enumerate(csv.DictReader(p.stdout)):
    yield {key(k):v for k,v in row.items()}
    if limit and idx>=limit-1:break
  finally:
   p.stdout.close();p.terminate()
   try:p.wait(timeout=3)
   except subprocess.TimeoutExpired:p.kill()
 departments={}
 for row in stream_table('DEPARTMENTS'):
  departments[as_id(row.get('deptid'))]=row.get('deptname','Unassigned')
 people=0;new_logs=0;unknown=0;touched=set()
 for row in stream_table('USERINFO'):
  userid=as_id(row.get('userid'));badge=as_id(row.get('badgenumber'))
  name=(row.get('name') or '').strip()
  if not badge:continue
  dept=departments.get(as_id(row.get('defaultdeptid')),'Unassigned')
  db.execute('''INSERT INTO employees(device_user_id,badge_number,source_userid,name,department) VALUES (?,?,?,?,?)
    ON CONFLICT(device_user_id) DO UPDATE SET source_userid=excluded.source_userid,
     name=CASE WHEN employees.name LIKE 'User %' THEN excluded.name ELSE employees.name END,
     department=CASE WHEN employees.department='Unassigned' THEN excluded.department ELSE employees.department END''',
    (badge,badge,userid,name or f'User {badge}',dept));people+=1
 db.commit()
 # Note: CHECKINOUT.USERID refers to USERINFO.USERID, not the device badge.
 source_lookup={as_id(r['source_userid']):r for r in db.execute('SELECT id,source_userid,badge_number FROM employees WHERE source_userid IS NOT NULL')}
 for row in stream_table('CHECKINOUT'):
  source_uid=as_id(row.get('userid'));emp=source_lookup.get(source_uid)
  dt=safe_datetime(row.get('checktime'))
  if not dt:continue
  ctype=str(row.get('checktype') or '').strip().upper()
  kind={'I':'IN','O':'OUT','0':'IN','1':'OUT'}.get(ctype,'CHECK')
  badge=emp['badge_number'] if emp else 'MDB_UID:'+source_uid
  eid=emp['id'] if emp else None
  cur=db.execute('INSERT OR IGNORE INTO punches(employee_id,device_user_id,happened_at,kind,source,raw_status) VALUES (?,?,?,?,?,?)',
    (eid,badge,dt.isoformat(timespec='seconds'),kind,'mdb',ctype))
  if cur.rowcount:
   new_logs+=1
   if eid:touched.add((eid,dt.date().isoformat()))
   else:unknown+=1
  if new_logs and new_logs%5000==0:db.commit()
 db.commit()
 # Build summary for imported MDB punches where detailed reports/device days do not already exist.
 for eid,workdate in touched:
  previous=db.execute('SELECT source FROM daily WHERE employee_id=? AND work_date=?',(eid,workdate)).fetchone()
  if previous and previous['source'] in ('excel_detailed','device'):continue
  rs=db.execute('SELECT happened_at,kind FROM punches WHERE employee_id=? AND source=? AND substr(happened_at,1,10)=? ORDER BY happened_at',
    (eid,'mdb',workdate)).fetchall()
  if not rs:continue
  first=next((x['happened_at'] for x in rs if x['kind']=='IN'),rs[0]['happened_at'])
  last=next((x['happened_at'] for x in reversed(rs) if x['kind']=='OUT'),None)
  late=None;work=None
  if last and last>first:work=int((datetime.fromisoformat(last)-datetime.fromisoformat(first)).total_seconds()/60)
  db.execute('''INSERT INTO daily(employee_id,work_date,status,clock_in,clock_out,late_minutes,work_minutes,source)
  VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(employee_id,work_date) DO UPDATE SET
  status=excluded.status,clock_in=excluded.clock_in,clock_out=excluded.clock_out,
  work_minutes=excluded.work_minutes,source=excluded.source''',
  (eid,workdate,'present',first[11:16],last[11:16] if last else None,late,work,'mdb'))
 db.execute('INSERT INTO imports(filename,source,employee_rows,attendance_rows,skipped_rows,details) VALUES (?,?,?,?,?,?)',
  (Path(mdb_file).name,'mdb',people,new_logs,unknown,'ZKTeco USERINFO/CHECKINOUT/DEPARTMENTS'))
 db.commit()
 return {'mdb_employees':people,'new_punches':new_logs,'unmatched_punches':unknown,'days_updated':len(touched)}
