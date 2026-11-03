"""ZKTeco Attendance Hub — local-first FastAPI service. No cloud services required."""
from __future__ import annotations
import asyncio, csv, io, json, os, re, secrets, sqlite3, threading, hashlib, time, unicodedata, hmac, functools, inspect
from contextlib import asynccontextmanager,contextmanager
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
from typing import Optional
from urllib.parse import quote
from fastapi import FastAPI, HTTPException, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from tools.importers import import_spreadsheet, get_workbook, safe_datetime
from tools.access_live import verify_source, sync_access, SourceError
from tools.report_export import build_report_xlsx
from cloud_service import CLOUD_ENABLED, cloud, CloudError, cloud_or_503
from cloud_projection import prepare_raw_tables, capture_original_from_daily, apply_override_local, push_sources, pull_cloud
from redis_cache import redis_cache

ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get('ATTENDANCE_DATA_DIR', ROOT/'data'))
DATA_DIR.mkdir(exist_ok=True,parents=True)
DB_PATH = DATA_DIR/'attendance.sqlite3'
STATIC=ROOT/'static'
WRITE_LOCK=threading.RLock()
SYNC_LOCK=threading.Lock()
AUTH=HTTPBasic(auto_error=False)
SESSION_TOKENS={}
SESSION_LOCK=threading.RLock()
SESSION_COOKIE='attendpro_session'
ROLE_LABELS={'view_only':'View Only User','supervisor':'Supervisor','super_admin':'Super Admin'}


def redis_cached_endpoint(namespace):
    """Cache authenticated JSON read endpoints for the configured Redis window."""
    def decorate(func):
        signature = inspect.signature(func)
        @functools.wraps(func)
        def wrapped(*args, **kwargs):
            if not redis_cache.enabled or cloud_source_upload_pending():
                return func(*args, **kwargs)
            try:
                bound = signature.bind_partial(*args, **kwargs)
                request = next((v for v in bound.arguments.values() if isinstance(v, Request)), None)
                params = dict(request.query_params) if request is not None else {
                    k:v for k,v in bound.arguments.items() if k != 'request'
                }
                raw = json.dumps(params, sort_keys=True, ensure_ascii=False, default=str, separators=(',', ':'))
                digest = hashlib.sha256(raw.encode('utf-8')).hexdigest()
                key = f'api:{namespace}:{digest}'
                cached = redis_cache.get_json(key)
            except Exception as exc:
                print(f'Redis API cache read warning ({namespace}): {str(exc)[:180]}')
                cached = None
                key = None
            if cached is not None:
                return cached
            # Keep endpoint exceptions/HTTP status codes intact; only cache failures
            # are swallowed. Never execute a read endpoint twice after an exception.
            result = func(*args, **kwargs)
            if key and isinstance(result, (dict, list)):
                try:
                    redis_cache.set_json(key, result, ttl=redis_cache.api_ttl_seconds)
                except Exception as exc:
                    print(f'Redis API cache write warning ({namespace}): {str(exc)[:180]}')
            return result
        return wrapped
    return decorate


def env_flag(name, default=False):
    return os.getenv(name, '1' if default else '0').strip().lower() in ('1','true','yes','on')


def scheduler_interval_seconds():
    try:
        return max(3600, int(os.getenv('ATTENDPRO_MDB_SCHEDULER_INTERVAL_SECONDS', '3600')))
    except ValueError:
        return 3600


def scheduler_lock_ttl_seconds():
    try:
        return max(scheduler_interval_seconds()+60, int(os.getenv('REDIS_SCHEDULER_LOCK_TTL_SECONDS', '4200')))
    except ValueError:
        return max(scheduler_interval_seconds()+60,4200)


HOURLY_SCHEDULER_ENABLED = env_flag('ATTENDPRO_HOURLY_SCHEDULER_ENABLED', redis_cache.enabled)
AUTO_BIOMETRIC_LEAVE_ENABLED = env_flag('ATTENDPRO_AUTO_LEAVE_UNCONFIGURED_BIOMETRIC', True)
HOURLY_JOB_LOCK = threading.Lock()
SCHEDULER_LOCK_KEY = 'scheduler:hourly-mdb-sync'

@contextmanager
def connection():
 db=sqlite3.connect(DB_PATH, timeout=30)
 db.row_factory=sqlite3.Row
 db.execute('PRAGMA foreign_keys=ON')
 db.execute('PRAGMA busy_timeout=30000')
 try:
  yield db
  db.commit()
 except Exception:
  db.rollback()
  raise
 finally:
  db.close()


def cloud_source_upload_pending():
    if not CLOUD_ENABLED:
        return False
    try:
        with connection() as db:
            row=db.execute("SELECT value FROM cloud_replication_state WHERE key='pending'").fetchone()
        return bool(row and row[0]=='1')
    except Exception:
        # Fail closed: do not put a possibly unconfirmed local source projection in Redis.
        return True

def init_db():
 with connection() as db:
  db.executescript('''
  PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS employees (
   id INTEGER PRIMARY KEY, device_user_id TEXT NOT NULL UNIQUE, source_userid TEXT,
   badge_number TEXT, name TEXT NOT NULL, department TEXT NOT NULL DEFAULT 'Unassigned',
   active INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS ix_employees_dept ON employees(department);
  CREATE TABLE IF NOT EXISTS daily (
   employee_id INTEGER NOT NULL REFERENCES employees(id), work_date TEXT NOT NULL,
   status TEXT NOT NULL, clock_in TEXT, clock_out TEXT, late_minutes INTEGER,
   early_minutes INTEGER, work_minutes INTEGER, shift TEXT, source TEXT NOT NULL,
   raw_absent TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY(employee_id,work_date)
  );
  CREATE INDEX IF NOT EXISTS ix_daily_date ON daily(work_date,status);
  CREATE TABLE IF NOT EXISTS punches (
   id INTEGER PRIMARY KEY, employee_id INTEGER REFERENCES employees(id), device_user_id TEXT NOT NULL,
   happened_at TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'CHECK', source TEXT NOT NULL,
   raw_status TEXT, UNIQUE(device_user_id,happened_at,kind,source)
  );
  CREATE INDEX IF NOT EXISTS ix_punches_time ON punches(happened_at DESC);
  CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS watched_files(path TEXT PRIMARY KEY, checksum TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS device_people(device_user_id TEXT PRIMARY KEY,name TEXT,seen_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS device_map(device_user_id TEXT PRIMARY KEY,employee_id INTEGER NOT NULL REFERENCES employees(id));
  CREATE TABLE IF NOT EXISTS imports(id INTEGER PRIMARY KEY, filename TEXT, source TEXT,
    imported_at TEXT DEFAULT CURRENT_TIMESTAMP, employee_rows INTEGER DEFAULT 0,
    attendance_rows INTEGER DEFAULT 0, skipped_rows INTEGER DEFAULT 0, details TEXT);
  CREATE TABLE IF NOT EXISTS devices(
   id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, model TEXT NOT NULL DEFAULT 'ZKTeco uFace 800',
   serial_number TEXT NOT NULL DEFAULT 'Not configured', mdb_path TEXT NOT NULL DEFAULT '',
   auto_sync INTEGER NOT NULL DEFAULT 0, sync_interval INTEGER NOT NULL DEFAULT 90,
   status TEXT NOT NULL DEFAULT 'not_configured', last_sync TEXT, last_test TEXT, last_attempt TEXT,
   last_error TEXT, last_fetched INTEGER NOT NULL DEFAULT 0, last_inserted INTEGER NOT NULL DEFAULT 0,
   created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS app_users(
   id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
   role TEXT NOT NULL CHECK(role IN ('view_only','supervisor','super_admin')),
   password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
   created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS attendance_changes(
   id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL, work_date TEXT NOT NULL,
   changed_by TEXT NOT NULL, action TEXT NOT NULL, before_json TEXT, after_json TEXT,
   created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS discrepancy_reviews(
   employee_id INTEGER NOT NULL REFERENCES employees(id), work_date TEXT NOT NULL,
   issue_type TEXT NOT NULL, resolution TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
   reviewed_by TEXT NOT NULL, reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY(employee_id, work_date, issue_type));
  CREATE TABLE IF NOT EXISTS biometric_status_changes(
   id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL REFERENCES employees(id),
   prior_status TEXT NOT NULL, new_status TEXT NOT NULL, changed_by TEXT NOT NULL,
   note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

  ''')
  prepare_raw_tables(db)
  # Optional editable local HR profile fields; original Access MDB is never modified.
  existing_cols={r[1] for r in db.execute('PRAGMA table_info(employees)')}
  for col,typ in [('designation',"TEXT DEFAULT 'Staff'"),('shift',"TEXT DEFAULT 'General'"),('phone',"TEXT DEFAULT ''"),('email',"TEXT DEFAULT ''"),('biometric_enrollment',"TEXT NOT NULL DEFAULT 'unknown'")]:
   if col not in existing_cols:
    db.execute(f'ALTER TABLE employees ADD COLUMN {col} {typ}')
  for key,value in {'device_ip':'','device_port':'4370','device_comm_key':'0','auto_sync':'false','sync_seconds':'60','office_start':'09:00','grace_minutes':'15','weekend_days':'6','device_status':'not_configured','last_sync':'','last_error':'','access_path':'','access_auto':'false','access_interval':'90','access_last_sync':'','access_last_error':'','access_status':'not_configured','access_signature':'','access_last_attempt':'','active_device_id':''}.items():
   db.execute('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)',(key,value))
  # Migrate the older single-device settings into a multi-device table without
  # touching the client's original Access database.
  if not db.execute('SELECT 1 FROM devices LIMIT 1').fetchone():
   old_path=setting(db,'access_path','')
   cur=db.execute('''INSERT INTO devices(name,model,serial_number,mdb_path,auto_sync,sync_interval,status,last_sync,last_test,last_attempt,last_error,last_fetched,last_inserted)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)''',('ZKTeco uFace 800','ZKTeco uFace 800','Not configured',old_path,
    1 if setting(db,'access_auto')=='true' else 0,int(setting(db,'access_interval','90')),setting(db,'access_status','not_configured'),
    setting(db,'access_last_sync') or None,setting(db,'access_last_test') or None,setting(db,'access_last_attempt') or None,
    setting(db,'access_last_error') or None,int(setting(db,'access_last_fetched','0') or 0),int(setting(db,'access_last_inserted','0') or 0)))
   db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES ('active_device_id',?)",(str(cur.lastrowid),))
  elif not setting(db,'active_device_id'):
   first=db.execute('SELECT id FROM devices ORDER BY id LIMIT 1').fetchone()
   if first:db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES ('active_device_id',?)",(str(first['id']),))
  if not db.execute('SELECT 1 FROM app_users LIMIT 1').fetchone():
   db.execute('INSERT INTO app_users(username,display_name,role,password_hash,active) VALUES(?,?,?,?,1)',
    ('admin','Admin Rehman','super_admin',hash_password('admin123')))

def setting(db,key,default=''):
 row=db.execute('SELECT value FROM settings WHERE key=?',(key,)).fetchone()
 return row[0] if row else default

def hash_password(password,salt=None):
 salt=salt or secrets.token_hex(16)
 digest=hashlib.pbkdf2_hmac('sha256',str(password).encode('utf-8'),salt.encode('utf-8'),160000).hex()
 return f'{salt}${digest}'

def verify_password(password,stored):
 try:
  salt,digest=stored.split('$',1)
  candidate=hashlib.pbkdf2_hmac('sha256',str(password).encode('utf-8'),salt.encode('utf-8'),160000).hex()
  return hmac.compare_digest(candidate,digest)
 except Exception:return False

def session_user(request):
 if CLOUD_ENABLED:
  token=request.cookies.get('attendpro_cloud_access','')
  return cloud.identity(token) if token else None
 token=request.cookies.get(SESSION_COOKIE,'')
 with SESSION_LOCK:
  data=SESSION_TOKENS.get(token)
  if not data:return None
  if data.get('expires',0)<time.time():
   SESSION_TOKENS.pop(token,None);return None
  return dict(data)

def auth_guard(request:Request,credentials: Optional[HTTPBasicCredentials]=Depends(AUTH)):
 if request.url.path in ('/','/api/auth/login','/api/auth/status','/api/auth/refresh') or request.url.path.startswith('/static/'):
  return
 password='' if CLOUD_ENABLED else os.environ.get('DASHBOARD_PASSWORD','')
 if password:
  username=os.environ.get('DASHBOARD_USERNAME','admin')
  if credentials and secrets.compare_digest(credentials.username,username) and secrets.compare_digest(credentials.password,password):return
 user=session_user(request)
 if not user:
  raise HTTPException(401,'Login required',headers={'WWW-Authenticate':'Basic realm="AttendPro"'})

def require_roles(request:Request,*roles):
 user=cloud.identity(request.cookies.get('attendpro_cloud_access',''),force=True) if CLOUD_ENABLED else session_user(request)
 if not user:raise HTTPException(401,'Login required')
 if user.get('role') not in roles:raise HTTPException(403,'Your role does not allow this action.')
 return user

# Device timestamps are treated as local wall-clock time. The dashboard's server
# day is explicit so a UTC-configured Linux host does not silently shift dates.
def local_now():
 try:return datetime.now(ZoneInfo(os.getenv('APP_TIMEZONE','Asia/Karachi'))).replace(tzinfo=None)
 except (KeyError,ValueError):return datetime.now()
def today_iso():return local_now().date().isoformat()
def stamp():return local_now().isoformat(timespec='seconds')

def requested_date(db,work_date):
 if work_date:
  try:return date.fromisoformat(work_date).isoformat()
  except ValueError:raise HTTPException(400,'Date must be YYYY-MM-DD')
 if setting(db,'access_auto')=='true' and setting(db,'access_last_sync','')[:10]==today_iso():return today_iso()
 row=db.execute('SELECT MAX(work_date) FROM daily').fetchone()
 return row[0] if row and row[0] else today_iso()

def safe_pagination(page,per_page):
 return max(1,min(page,100000)),max(1,min(per_page,150))

def rows_as_dict(rows):return [dict(r) for r in rows]

def daily_query(work_date,status='',department='',search=''):
 where=['d.work_date=?'];args=[work_date]
 if status and status!='all': where.append('d.status=?');args.append(status)
 if department and department!='all':where.append('e.department=?');args.append(department)
 if search:
  where.append('(e.name LIKE ? OR e.badge_number LIKE ? OR e.device_user_id LIKE ?)')
  args.extend([f'%{search}%']*3)
 return '''FROM daily d JOIN employees e ON e.id=d.employee_id WHERE '''+' AND '.join(where),args

def overview(db,work_date):
 total=db.execute('SELECT COUNT(*) FROM employees WHERE active=1').fetchone()[0]
 statuses={r['status']:r['n'] for r in db.execute('''SELECT d.status,COUNT(*) n FROM daily d JOIN employees e ON e.id=d.employee_id WHERE d.work_date=? AND e.active=1 GROUP BY d.status''',(work_date,))}
 present=statuses.get('present',0)+statuses.get('late',0)
 absent=statuses.get('absent',0)
 unknown=max(0,total-present-absent)
 late=statuses.get('late',0)
 punches=db.execute("SELECT COUNT(*) FROM punches WHERE substr(happened_at,1,10)=?",(work_date,)).fetchone()[0]
 inc=db.execute("SELECT COUNT(*) FROM daily WHERE work_date=? AND ((clock_in IS NULL AND clock_out IS NOT NULL) OR (clock_in IS NOT NULL AND clock_out IS NULL))",(work_date,)).fetchone()[0]
 return {'total':total,'present':present,'absent':absent,'late':late,'unknown':unknown,'attendance_percentage':round(100*present/total,1) if total else 0,'incomplete':inc,'punches':punches,'not_checked_in':unknown,'provisional_absent':unknown if (work_date==today_iso() and setting(db,'last_sync','')[:10]==today_iso()) else 0}

def active_device_id(db):
 try:return int(setting(db,'active_device_id','') or 0)
 except (TypeError,ValueError):return 0

def device_status(db,device_id=None):
    if device_id is None:device_id=active_device_id(db)
    row=db.execute('SELECT * FROM devices WHERE id=?',(device_id,)).fetchone() if device_id else None
    if not row:
        path=setting(db,'access_path');last=setting(db,'access_last_sync');error=setting(db,'access_last_error')
        status=setting(db,'access_status','not_configured');auto=setting(db,'access_auto')=='true';interval=int(setting(db,'access_interval','90'))
        last_test=setting(db,'access_last_test') or None;last_fetched=int(setting(db,'access_last_fetched','0') or 0);last_inserted=int(setting(db,'access_last_inserted','0') or 0)
        name='ZKTeco uFace 800';model='ZKTeco uFace 800';serial='Not configured';ident=device_id or None
    else:
        path=row['mdb_path'];last=row['last_sync'];error=row['last_error'];status=row['status'];auto=bool(row['auto_sync']);interval=int(row['sync_interval'])
        last_test=row['last_test'];last_fetched=int(row['last_fetched'] or 0);last_inserted=int(row['last_inserted'] or 0)
        name=row['name'];model=row['model'];serial=row['serial_number'];ident=row['id']
    modified=None
    if path:
        try:
            modified=datetime.fromtimestamp(Path(path).stat().st_mtime).isoformat(timespec='seconds')
            if status=='online' and (local_now()-datetime.fromisoformat(modified)).total_seconds()>86400:status='stale_source'
        except OSError:status='missing_file'
    return {'id':ident,'name':name,'model':model,'serial_number':serial,'path':path or '',
        'status':status if path else 'not_configured','configured':bool(path),'auto_sync':auto,'sync_interval':interval,
        'last_sync':last or None,'last_test':last_test,'file_modified':modified,'error':error or None,
        'last_fetched':last_fetched,'last_inserted':last_inserted,
        'source':'Microsoft Access MDB (existing ZKTeco software)'}

def all_devices(db):
    rows=db.execute('SELECT id FROM devices ORDER BY id').fetchall()
    selected=active_device_id(db)
    return {'active_device_id':selected,'items':[device_status(db,int(r['id'])) for r in rows]}

def validate_mdb_path(value):
    path=str(value or '').strip()
    if len(path)>1024 or '\x00' in path or (path and Path(path).suffix.lower()!='.mdb'):
        raise HTTPException(400,'Please provide the full local path to an .mdb file')
    return path

def normalize_name(name):
 value=unicodedata.normalize('NFKC',str(name or '')).casefold()
 return ' '.join(''.join(ch if ch.isalnum() else ' ' for ch in value).split())

def candidate_matches(db):
 # All automatic candidates must match the same badge/AC-No. AND same name.
 # Never match by the Excel "Emp No." column: it has known collisions.
 people=rows_as_dict(db.execute('SELECT device_user_id,name FROM device_people ORDER BY device_user_id').fetchall())
 result=[]
 for p in people:
  uid=p['device_user_id'];record=db.execute('''SELECT e.id,e.name,e.badge_number,
   m.device_user_id AS already_mapped FROM employees e
   LEFT JOIN device_map m ON m.employee_id=e.id
   WHERE e.badge_number=? AND e.active=1''',(uid,)).fetchone()
  mapped=db.execute('SELECT employee_id FROM device_map WHERE device_user_id=?',(uid,)).fetchone()
  if mapped:status='mapped'
  elif not record:status='needs_manual_mapping'
  elif record['already_mapped']:status='employee_already_mapped'
  elif normalize_name(p['name']) and normalize_name(p['name'])==normalize_name(record['name']):status='verified_candidate'
  else:status='name_mismatch'
  result.append({'device_user_id':uid,'device_name':p['name'],
   'badge_number':record['badge_number'] if record else None,
   'employee_name':record['name'] if record else None,'status':status})
 return result

def scan_import_folder():
 """Pick up new or replaced report files saved by the client into a trusted local folder."""
 folder=os.environ.get('APP_WATCH_FOLDER','').strip()
 if not folder:return {'configured':False,'processed':0}
 root=Path(folder).expanduser()
 if not root.is_dir():return {'configured':True,'processed':0,'error':'Watch folder not found'}
 done=0;errors=[]
 for path in sorted(root.iterdir()):
  if not path.is_file() or path.suffix.lower() not in ('.xls','.xlsx','.csv'):continue
  try:
   st=path.stat()
   if st.st_size>25_000_000 or st.st_size<20 or time.time()-st.st_mtime<4:continue
   raw=path.read_bytes();checksum=hashlib.sha256(raw).hexdigest()
   with connection() as db:
    previous=db.execute('SELECT checksum FROM watched_files WHERE path=?',(str(path),)).fetchone()
    if previous and previous['checksum']==checksum:continue
   with WRITE_LOCK:
    with connection() as db:
     import_spreadsheet(db,raw,path.name)
     if CLOUD_ENABLED:
      capture_original_from_daily(db)
      mark_pending_sync(db)
     db.execute('INSERT OR REPLACE INTO watched_files(path,checksum) VALUES (?,?)',(str(path),checksum))
     db.execute('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)',('last_folder_import',stamp()))
     db.commit()
   done+=1
  except Exception as exc:errors.append(f'{path.name}: {exc}')
 if errors:
  with connection() as db:db.execute('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)',('last_folder_error','; '.join(errors)[:300]))
 return {'configured':True,'processed':done,'errors':errors[:5]}

def refresh_redis_snapshot():
    """Refresh rebuildable Redis cache from the current AttendPro read projection."""
    if not redis_cache.enabled:
        return {"success": False, "reason": "Redis cache is disabled"}
    if cloud_source_upload_pending():
        return {"success":False,"reason":"Source records are still pending Supabase confirmation; Redis was not refreshed."}
    with connection() as db:
        result=redis_cache.refresh_snapshot(db)
    if result.get('success'):
        redis_cache.invalidate_api_cache()
    return result


async def auto_poll():
    last_folder_check=0
    last_cloud_check=0
    while True:
        await asyncio.sleep(5)
        if os.environ.get('APP_WATCH_FOLDER') and time.monotonic()-last_folder_check>25:
            last_folder_check=time.monotonic()
            await asyncio.to_thread(scan_import_folder)
        if CLOUD_ENABLED and time.monotonic()-last_cloud_check>=20:
            last_cloud_check=time.monotonic()
            try:await asyncio.to_thread(refresh_cloud_projection)
            except Exception as e:print('Supabase refresh warning:',str(e)[:250])
            try:await asyncio.to_thread(flush_pending_source_upload)
            except Exception as e:print('Supabase source upload pending:',str(e)[:250])
        # Automatic MDB reads are handled by the hourly scheduler below.

@asynccontextmanager
async def lifespan(app):
 init_db()
 cloud_ready=True
 if CLOUD_ENABLED:
  try:await asyncio.to_thread(refresh_cloud_projection)
  except Exception as e:
   cloud_ready=False
   print('Cloud not yet reachable; Redis initial snapshot deferred:',e)
 if redis_cache.enabled and cloud_ready and not cloud_source_upload_pending():
  try:
   result=await asyncio.to_thread(refresh_redis_snapshot)
   if not result.get('success'):print('Redis initial cache warning:',result.get('reason','unknown error'))
  except Exception as e:print('Redis initial cache warning:',str(e)[:250])
 worker=asyncio.create_task(auto_poll())
 scheduler_worker=asyncio.create_task(hourly_scheduler_loop()) if HOURLY_SCHEDULER_ENABLED else None
 try:yield
 finally:
  worker.cancel()
  try:await worker
  except asyncio.CancelledError:pass
  if scheduler_worker:
   scheduler_worker.cancel()
   try:await scheduler_worker
   except asyncio.CancelledError:pass

app=FastAPI(title='Attenda Access Live',description='Read-only Microsoft Access MDB bridge to ZKTeco attendance dashboard',version='2.0',lifespan=lifespan,dependencies=[Depends(auth_guard)])
# CORS is enabled for the optional local-file preview; normal use is same-origin at http://127.0.0.1:8000.
if not CLOUD_ENABLED:
 app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])

@app.middleware('http')
async def protect_cloud_writes(request:Request,call_next):
 if CLOUD_ENABLED and request.method not in ('GET','HEAD','OPTIONS'):
  origin=request.headers.get('origin')
  # Vercel rewrites /api/* to Render; the browser's Origin is the Vercel site.
  # Allow explicitly configured frontends and this API's own origin, not every origin.
  origin_allowed={f'{request.url.scheme}://{request.headers.get("host","")}'.rstrip('/')}
  for item in (os.getenv('ATTENDPRO_PUBLIC_ORIGIN',''),os.getenv('ATTENDPRO_ALLOWED_ORIGINS','')):
   origin_allowed.update(x.strip().rstrip('/') for x in item.split(',') if x.strip())
  # Default Vercel production domain is exact, so no attacker-controlled wildcard is needed.
  origin_allowed.add('https://attendpro-smart-biometric-hrms-stat.vercel.app')
  if origin and origin.rstrip('/') not in origin_allowed:
   return Response('Origin not permitted for this application.',status_code=403)
 return await call_next(request)

@app.middleware('http')
async def refresh_redis_after_write(request:Request, call_next):
    response = await call_next(request)
    path = request.url.path
    relevant = path.startswith((
        '/api/attendance', '/api/discrepancies', '/api/employees',
        '/api/devices', '/api/database', '/api/import-excel',
        '/api/settings', '/api/cloud'
    ))
    if (redis_cache.enabled and request.method in ('POST','PUT','PATCH','DELETE')
            and response.status_code < 400 and relevant):
        try:
            redis_cache.invalidate_api_cache()
            if cloud_source_upload_pending():
                print('Redis refresh deferred: source upload is pending Supabase confirmation.')
                return response
            redis_cache.delete_pattern('snapshot:*')
            result = await asyncio.to_thread(refresh_redis_snapshot)
            if not result.get('success'):
                print('Redis cache refresh warning:', result.get('reason','unknown error'))
        except Exception as exc:
            print('Redis cache refresh warning:', str(exc)[:250])
    return response


def set_cloud_cookies(response,tokens):
 secure=os.getenv('ATTENDPRO_HTTPS','0')=='1'
 response.set_cookie('attendpro_cloud_access',tokens['access_token'],httponly=True,
    samesite='strict',secure=secure,path='/',max_age=int(tokens.get('expires_in',3600)))
 if tokens.get('refresh_token'):
  response.set_cookie('attendpro_cloud_refresh',tokens['refresh_token'],httponly=True,
    samesite='strict',secure=secure,path='/',max_age=60*60*24*14)

def refresh_cloud_login(request,response):
 token=request.cookies.get('attendpro_cloud_refresh')
 if not token:return None
 try:
  result=cloud.refresh(token)
  set_cloud_cookies(response,result)
  return cloud.identity(result['access_token'])
 except (CloudError,KeyError):return None

def refresh_cloud_projection(force=False):
 if not CLOUD_ENABLED:return
 with WRITE_LOCK:
  with connection() as db:
   # Never pull a stale cloud snapshot over attendance not yet uploaded.
   pending=db.execute("SELECT value FROM cloud_replication_state WHERE key='pending'").fetchone()
   if pending and pending[0]=='1':
    push_sources(db)  # if cloud unavailable, keep pending data and retry later
    db.execute("INSERT OR REPLACE INTO cloud_replication_state(key,value) VALUES ('pending','0')")
   pull_cloud(db, force=force)

def mark_pending_sync(db):
 db.execute("INSERT OR REPLACE INTO cloud_replication_state(key,value) VALUES ('pending','1')")

def flush_pending_source_upload():
 if not CLOUD_ENABLED:return
 with WRITE_LOCK:
  with connection() as db:
   pending=db.execute("SELECT value FROM cloud_replication_state WHERE key='pending'").fetchone()
   if not pending or pending[0]!='1':return
   push_sources(db)  # only clear pending AFTER Supabase accepted the full upload
   db.execute("INSERT OR REPLACE INTO cloud_replication_state(key,value) VALUES ('pending','0')")

# Manual corrections always go to Supabase FIRST. Raw punches/source rows are untouched.
def cloud_edit_attendance(user,body,employee_id,work_date,action):
 def valid_time(value):
  if value is None or str(value).strip()=='':return None
  value=str(value).strip()
  if not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d',value):raise HTTPException(400,'Time must be HH:MM')
  return value
 reason=str(body.get('reason') or '').strip()
 if len(reason)<3:raise HTTPException(400,'Please provide a correction reason (at least 3 characters)')
 with WRITE_LOCK:
  with connection() as db:
   emp=db.execute('SELECT id,name FROM employees WHERE id=?',(employee_id,)).fetchone()
   if not emp:raise HTTPException(404,'Employee not found')
   old=db.execute('SELECT * FROM daily WHERE employee_id=? AND work_date=?',(employee_id,work_date)).fetchone()
   before=dict(old) if old else None
   cin=valid_time(body.get('clock_in')) if action=='update' else (local_now().strftime('%H:%M') if action=='check_in' else (old['clock_in'] if old else None))
   cout=valid_time(body.get('clock_out')) if action=='update' else (local_now().strftime('%H:%M') if action=='check_out' else (old['clock_out'] if old else None))
   shift=str(body.get('shift') or (old['shift'] if old else setting(db,'office_start','09:00'))).strip()[:40]
   status=str(body.get('status') or ('present' if cin or cout else 'absent')).lower().replace(' ','_')
   allowed={'present','late','absent','on_leave','early_arrival','missing_check_in','not_checked_in'}
   if status not in allowed:raise HTTPException(400,'Invalid attendance status')
   late_minutes=0
   if cin and re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d',shift):
    late_minutes=max(0,(int(cin[:2])*60+int(cin[3:]))-(int(shift[:2])*60+int(shift[3:])+int(setting(db,'grace_minutes','15'))))
    if late_minutes and status in ('present','early_arrival'):status='late'
   work_minutes=None
   if cin and cout:
    work_minutes=int((datetime.strptime(cout,'%H:%M')-datetime.strptime(cin,'%H:%M')).total_seconds()//60)
    if work_minutes<0:work_minutes+=1440
   after={'status':status,'clock_in':cin,'clock_out':cout,'late_minutes':late_minutes,
          'early_minutes':before.get('early_minutes') if before else 0,
          'work_minutes':work_minutes,'shift':shift}
   verrow=db.execute('SELECT version FROM cloud_adjustment_cache WHERE employee_id=? AND work_date=?',(employee_id,work_date)).fetchone()
   expected_version=int(verrow[0]) if verrow else 0
   # Atomic remote correction + immutable remote audit; errors reject entire save.
   result=cloud_or_503(lambda:cloud.save_adjustment(employee_id,work_date,after,
               user['auth_id'],action,reason,expected_version=expected_version))
   version=int(result['version']) if isinstance(result,dict) else expected_version+1
   apply_override_local(db,employee_id,work_date,after,version)
   record=dict(db.execute('SELECT * FROM daily WHERE employee_id=? AND work_date=?',(employee_id,work_date)).fetchone())
   db.execute("""INSERT INTO attendance_changes(employee_id,work_date,changed_by,action,before_json,after_json)
      VALUES(?,?,?,?,?,?)""",(employee_id,work_date,user.get('email','unknown'),action,
                     json.dumps(before,default=str),json.dumps(record,default=str)))
 return {'success':True,'message':'Correction saved in Supabase. Original MDB/raw punches unchanged.','record':record,'version':version}



@app.get('/')
def homepage():
    # Always serve the current UI build; this prevents stale cached inline JavaScript
    # from keeping an old Redis monitor renderer in the browser.
    return FileResponse(STATIC/'index.html', headers={
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
    })

@app.get('/api/auth/status')
def auth_status(request:Request,response:Response):
    user=session_user(request)
    if CLOUD_ENABLED and not user:user=refresh_cloud_login(request,response)
    if user:
        return {'authenticated':True,'user':{k:user.get(k) for k in ('id','username','display_name','role')},
                'role_label':ROLE_LABELS.get(user.get('role'),user.get('role')),
                'mode':'supabase' if CLOUD_ENABLED else 'local'}
    return {'authenticated':False,'user':None,'mode':'supabase' if CLOUD_ENABLED else 'local'}

@app.post('/api/auth/login')
async def auth_login(request:Request,response:Response):
    body=await request.json()
    username=str(body.get('username','')).strip()
    password=str(body.get('password',''))
    if CLOUD_ENABLED:
        if '@' not in username:raise HTTPException(400,'Enter your Supabase account email address.')
        try:
            session=cloud.login(username,password)
            user=cloud.identity(session['access_token'])
            if not user:raise HTTPException(403,'Account is not enabled in AttendPro. Contact Super Admin.')
            set_cloud_cookies(response,session)
        except CloudError as e:raise HTTPException(401,'Incorrect email/password or account disabled.') from e
        return {'success':True,'user':{k:user.get(k) for k in ('id','username','display_name','role')},
                'role_label':ROLE_LABELS[user['role']],'mode':'supabase'}
    with connection() as db:
        row=db.execute('SELECT * FROM app_users WHERE username=? AND active=1',(username,)).fetchone()
    if not row or not verify_password(password,row['password_hash']):
        raise HTTPException(401,'Incorrect username/password.')
    token=secrets.token_urlsafe(36)
    data={'id':int(row['id']),'username':row['username'],'display_name':row['display_name'],
          'role':row['role'],'expires':time.time()+43200}
    with SESSION_LOCK:SESSION_TOKENS[token]=data
    response.set_cookie(SESSION_COOKIE,token,httponly=True,samesite='strict',max_age=43200,path='/')
    return {'success':True,'user':{k:data[k] for k in ('id','username','display_name','role')},'role_label':ROLE_LABELS[row['role']]}

@app.post('/api/auth/refresh')
def auth_refresh(request:Request,response:Response):
    if not CLOUD_ENABLED:raise HTTPException(400,'Local mode does not use refresh tokens')
    user=refresh_cloud_login(request,response)
    if not user:raise HTTPException(401,'Session expired; please sign in again')
    return {'authenticated':True,'user':{k:user.get(k) for k in ('id','username','display_name','role')}}

@app.post('/api/auth/logout')
def auth_logout(request:Request,response:Response):
    if CLOUD_ENABLED:
        response.delete_cookie('attendpro_cloud_access',path='/')
        response.delete_cookie('attendpro_cloud_refresh',path='/')
        return {'success':True}
    token=request.cookies.get(SESSION_COOKIE,'')
    with SESSION_LOCK:SESSION_TOKENS.pop(token,None)
    response.delete_cookie(SESSION_COOKIE,path='/')
    return {'success':True}

@app.post('/api/auth/change-password')
async def auth_change_password(request:Request):
    user=require_roles(request,'view_only','supervisor','super_admin')
    body=await request.json();old=str(body.get('current_password',''));new=str(body.get('new_password',''))
    if len(new)<8:raise HTTPException(400,'Password must contain at least 8 characters.')
    if CLOUD_ENABLED:
        try:
            cloud.login(user['email'],old)  # Explicitly re-authenticate before changing password.
            cloud.update_password(request.cookies.get('attendpro_cloud_access',''),new)
        except CloudError as e:raise HTTPException(400,'Current password incorrect or Supabase unavailable') from e
        return {'success':True,'message':'Password updated in Supabase Auth.'}
    with connection() as db:
        row=db.execute('SELECT password_hash FROM app_users WHERE id=?',(user['id'],)).fetchone()
        if not row or not verify_password(old,row['password_hash']):raise HTTPException(400,'Current password incorrect')
        db.execute('UPDATE app_users SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',(hash_password(new),user['id']))
    return {'success':True,'message':'Password updated'}

@app.get('/api/cloud/status')
def cloud_sync_status(request:Request):
 require_roles(request,'view_only','supervisor','super_admin')
 import cloud_projection as cp
 with connection() as db:
  pending=setting_cloud(db,'pending','0')
  last_upload=setting_cloud(db,'last_push','')
  upload_error=setting_cloud(db,'last_push_error','')
 return {'enabled':CLOUD_ENABLED,'pending_source_upload':pending=='1','last_source_upload':last_upload,
         'last_source_error':upload_error if pending=='1' else '',
         'cloud_pull_error':cp.PULL_ERROR,'cloud_pull_active':bool(cp.PULL_LAST),
         'original_mdb_never_written':True}

@app.get('/api/cache/status')
def redis_cache_status(request:Request):
    require_roles(request,'view_only','supervisor','super_admin')
    return redis_cache.status()


@app.post('/api/cache/refresh')
def redis_cache_refresh(request:Request):
    require_roles(request,'super_admin')
    if not redis_cache.enabled:
        raise HTTPException(503,'Redis is not configured. Set REDIS_URL and REDIS_CACHE_ENABLED=1.')
    result=refresh_redis_snapshot()
    append_monitor_log('Manual Redis cache refresh', 'Success' if result.get('success') else 'Failed',
                       records=sum((result.get('counts') or {}).values()) if result.get('success') else None,
                       details=result.get('reason') or 'Snapshot rebuilt from the current AttendPro read projection.',
                       trigger='manual')
    if not result.get('success'):
        raise HTTPException(503,result.get('reason','Redis cache refresh failed'))
    return result


@app.get('/api/cache/snapshot/{dataset}')
def redis_cache_snapshot(dataset:str, request:Request, chunk:int=0):
    require_roles(request,'super_admin')
    if dataset not in redis_cache.SNAPSHOT_TABLES:
        raise HTTPException(404,'Unknown cache dataset')
    if chunk < 0:
        raise HTTPException(400,'Chunk must be zero or greater')
    manifest=redis_cache.get_json(f'snapshot:{dataset}:manifest')
    if manifest is None:
        raise HTTPException(503,'Redis snapshot is not available')
    if chunk >= int(manifest.get('chunks',0)):
        raise HTTPException(404,'Snapshot chunk not found')
    items=redis_cache.get_json(f'snapshot:{dataset}:{chunk:06d}')
    if items is None:
        raise HTTPException(404,'Snapshot chunk not found')
    return {'dataset':dataset,'chunk':chunk,'total_chunks':manifest.get('chunks',0),
            'total_records':manifest.get('records',0),'items':items}


@app.get('/api/scheduler/status')
def scheduler_status(request:Request):
    require_roles(request,'view_only','supervisor','super_admin')
    with connection() as db:
        state={r['key']:r['value'] for r in db.execute("SELECT key,value FROM settings WHERE key LIKE 'scheduler_%'").fetchall()}
        devices=rows_as_dict(db.execute("SELECT id,name,mdb_path,auto_sync,sync_interval,last_sync,last_error,status,last_attempt,last_fetched,last_inserted FROM devices ORDER BY id").fetchall())
    return {
        'enabled':HOURLY_SCHEDULER_ENABLED,
        'interval_seconds':scheduler_interval_seconds(),
        'interval_minutes':scheduler_interval_seconds()//60,
        'redis_connected':redis_cache.ping() if redis_cache.enabled else False,
        'last_started':state.get('scheduler_last_started'),
        'last_finished':state.get('scheduler_last_finished'),
        'last_success':state.get('scheduler_last_success'),
        'last_error':state.get('scheduler_last_error',''),
        'last_trigger':state.get('scheduler_last_trigger',''),
        'last_result':json.loads(state['scheduler_last_result']) if state.get('scheduler_last_result') else None,
        'next_run':state.get('scheduler_next_run'),
        'devices':[{'id':d['id'],'name':d['name'],'configured':bool(d['mdb_path']),
                    'automatic_sync_enabled':bool(d['auto_sync']),'last_sync':d['last_sync'],
                    'last_error':d['last_error'],'status':d['status'],'last_attempt':d['last_attempt'],
                    'last_fetched':d['last_fetched'],'last_inserted':d['last_inserted']} for d in devices]
    }


@app.post('/api/scheduler/run')
def scheduler_run_now(request:Request):
    require_roles(request,'super_admin')
    result=run_hourly_sync_cycle(force=True, trigger='manual')
    if not result.get('success'):
        raise HTTPException(503,result.get('message','Scheduler run failed'))
    return result


@app.get('/api/monitor/logs')
def monitor_activity_logs(request:Request, limit:int=30):
    require_roles(request,'view_only','supervisor','super_admin')
    limit=max(1,min(int(limit or 30),100))
    with connection() as db:
        row=db.execute("SELECT value FROM settings WHERE key='monitor_activity_log'").fetchone()
    try:
        items=json.loads(row['value']) if row and row['value'] else []
    except (TypeError,ValueError):
        items=[]
    if not isinstance(items,list):items=[]
    return {'items':items[:limit],'total':len(items)}


def setting_cloud(db,key,default=''):
 row=db.execute('SELECT value FROM cloud_replication_state WHERE key=?',(key,)).fetchone()
 return row[0] if row else default

@app.post('/api/cloud/sync')
async def cloud_sync_now(request:Request):
 require_roles(request,'super_admin')
 if not CLOUD_ENABLED:raise HTTPException(400,'Supabase mode is not configured')
 try:
  await asyncio.to_thread(flush_pending_source_upload)
  await asyncio.to_thread(refresh_cloud_projection)
 except CloudError as e:raise HTTPException(503,str(e)) from e
 return {'success':True,'status':cloud_sync_status(request)}

@app.get('/api/attendance/provenance')
def attendance_provenance(request:Request,employee_id:int,work_date:str):
 require_roles(request,'view_only','supervisor','super_admin')
 try:work_date=date.fromisoformat(work_date).isoformat()
 except ValueError:raise HTTPException(400,'Invalid date')
 with connection() as db:
  source=db.execute('SELECT * FROM raw_daily WHERE employee_id=? AND work_date=?',(employee_id,work_date)).fetchone()
  effective=db.execute('SELECT * FROM daily WHERE employee_id=? AND work_date=?',(employee_id,work_date)).fetchone()
  raw_punches=rows_as_dict(db.execute("SELECT happened_at,kind,source,raw_status FROM punches WHERE employee_id=? AND substr(happened_at,1,10)=? ORDER BY happened_at",(employee_id,work_date)).fetchall())
 audit=[]
 if CLOUD_ENABLED:
  audit=cloud_or_503(lambda:cloud.rows('attendpro_correction_audit',{
      'employee_id':'eq.'+str(employee_id),'work_date':'eq.'+work_date,
      'order':'created_at.desc'}))
 return {'employee_id':employee_id,'work_date':work_date,
         'original':dict(source) if source else None,'effective':dict(effective) if effective else None,
         'raw_punches':raw_punches,'cloud_audit':audit,'mdb_changed':False}

@app.get('/api/health')
def health():
 with connection() as db:
  return {'ok':True,'database':'connected','employees':db.execute('SELECT COUNT(*) FROM employees').fetchone()[0],'time':stamp(),'mode':'supabase' if CLOUD_ENABLED else 'local'}

@app.get('/api/dashboard')
@redis_cached_endpoint('dashboard')
def dashboard(date:Optional[str]=None):
 with connection() as db:
  d=requested_date(db,date);stats=overview(db,d)
  depts=rows_as_dict(db.execute('''SELECT e.department, COUNT(*) total,
   SUM(CASE WHEN d.status IN ('present','late') THEN 1 ELSE 0 END) present,
   SUM(CASE WHEN d.status='absent' THEN 1 ELSE 0 END) absent
   FROM employees e LEFT JOIN daily d ON d.employee_id=e.id AND d.work_date=?
   WHERE e.active=1 GROUP BY e.department ORDER BY total DESC''',(d,)).fetchall())
  for it in depts:it['present']=it['present'] or 0;it['absent']=it['absent'] or 0
  recent=rows_as_dict(db.execute('''SELECT p.happened_at,p.kind,p.source,e.name,e.department,e.badge_number
   FROM punches p LEFT JOIN employees e ON e.id=p.employee_id WHERE substr(p.happened_at,1,10)=?
   ORDER BY p.happened_at DESC,p.id DESC LIMIT 9''',(d,)).fetchall())
  hourly=rows_as_dict(db.execute('''SELECT substr(happened_at,12,2) hour,COUNT(DISTINCT employee_id) people,
   COUNT(*) punches FROM punches WHERE substr(happened_at,1,10)=? GROUP BY substr(happened_at,12,2)
   ORDER BY hour''',(d,)).fetchall())
  last_import=db.execute('SELECT filename,imported_at,attendance_rows FROM imports ORDER BY id DESC LIMIT 1').fetchone()
  dates=[r[0] for r in db.execute('SELECT DISTINCT work_date FROM daily ORDER BY work_date DESC LIMIT 150')]
  device_list=all_devices(db)
  return {'date':d,'is_today':d==today_iso(),'metrics':stats,'departments':depts,
    'recent':recent,'hourly':hourly,'dates':dates,'device':device_status(db),
    'devices':device_list['items'],'active_device_id':device_list['active_device_id'],
    'last_import':dict(last_import) if last_import else None,'server_time':stamp(),'watch_folder':bool(os.environ.get('APP_WATCH_FOLDER'))}

@app.get('/api/attendance')
@redis_cached_endpoint('attendance')
def attendance(date:Optional[str]=None,status:str='',department:str='',search:str='',page:int=1,per_page:int=30):
 with connection() as db:
  d=requested_date(db,date);page,per_page=safe_pagination(page,per_page)
  frm,args=daily_query(d,status,department,search)
  n=db.execute('SELECT COUNT(*) '+frm,args).fetchone()[0]
  items=rows_as_dict(db.execute('''SELECT e.id employee_id,e.badge_number,e.device_user_id,e.name,e.department,
  d.work_date,d.status,d.clock_in,d.clock_out,d.late_minutes,d.early_minutes,d.work_minutes,d.shift,d.source
  '''+frm+''' ORDER BY CASE d.status WHEN 'late' THEN 0 WHEN 'present' THEN 1 WHEN 'absent' THEN 2 ELSE 3 END,e.name LIMIT ? OFFSET ?''',args+[per_page,(page-1)*per_page]).fetchall())
  return {'date':d,'total':n,'page':page,'per_page':per_page,'items':items}

@app.get('/api/attendance/history')
@redis_cached_endpoint('attendance-history')
def attendance_history(request: Request):
 # Default to the latest available attendance date, not the server's calendar date.
 # This keeps reports useful when the latest imported MDB/Excel file is historical.
 params=request.query_params
 from_text=params.get('from') or ''
 to_text=params.get('to') or ''
 if not from_text and not to_text:
  with connection() as db:
   latest=db.execute('SELECT MAX(work_date) FROM daily').fetchone()[0] or today_iso()
  from_text=to_text=latest
 elif from_text and not to_text:
  to_text=from_text
 elif to_text and not from_text:
  from_text=to_text
 try:
  from_day=date.fromisoformat(from_text)
  to_day=date.fromisoformat(to_text)
 except ValueError:
  raise HTTPException(400,'Dates must be YYYY-MM-DD')
 if from_day>to_day:
  raise HTTPException(400,'From date must be before or equal to To date')
 if (to_day-from_day).days>366:
  raise HTTPException(400,'Please select a date range of 366 days or less')
 where=['d.work_date BETWEEN ? AND ?'];args=[from_day.isoformat(),to_day.isoformat()]
 department=params.get('department','').strip()
 status=params.get('status','').strip().lower()
 search=params.get('search','').strip()
 if department and department!='all':where.append('e.department=?');args.append(department)
 if status and status!='all':where.append('d.status=?');args.append(status)
 if search:where.append('(e.name LIKE ? OR e.badge_number LIKE ? OR e.device_user_id LIKE ?)');args.extend([f'%{search}%']*3)
 with connection() as db:
  sql = """SELECT e.id employee_id,e.badge_number,e.device_user_id,e.name,e.department,
   d.work_date,d.status,d.clock_in,d.clock_out,d.late_minutes,d.early_minutes,d.work_minutes,d.shift,d.source
   FROM daily d JOIN employees e ON e.id=d.employee_id WHERE """ + ' AND '.join(where) + ' ORDER BY d.work_date DESC,e.name'
  items=rows_as_dict(db.execute(sql,args).fetchall())
  return {'from':from_day.isoformat(),'to':to_day.isoformat(),'total':len(items),'items':items}

@app.put('/api/attendance/edit')
async def edit_attendance(request:Request):
    user=require_roles(request,'supervisor','super_admin')
    body=await request.json()
    try:employee_id=int(body.get('employee_id'))
    except (TypeError,ValueError):raise HTTPException(400,'Employee ID required')
    work_date=str(body.get('work_date') or today_iso())
    try:work_date=date.fromisoformat(work_date).isoformat()
    except ValueError:raise HTTPException(400,'Date must be YYYY-MM-DD')
    action=str(body.get('action') or 'update').strip().lower()
    if action not in ('update','check_in','check_out'):raise HTTPException(400,'Invalid attendance action')
    def valid_time(value):
        value=str(value or '').strip()
        if not value:return None
        if not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d',value):raise HTTPException(400,'Time must be HH:MM')
        return value
    if CLOUD_ENABLED:
        return cloud_edit_attendance(user,body,employee_id,work_date,action)
    with WRITE_LOCK:
      with connection() as db:
        emp=db.execute('SELECT id,name FROM employees WHERE id=?',(employee_id,)).fetchone()
        if not emp:raise HTTPException(404,'Employee not found')
        old=db.execute('SELECT * FROM daily WHERE employee_id=? AND work_date=?',(employee_id,work_date)).fetchone()
        before=dict(old) if old else None
        cin=valid_time(body.get('clock_in')) if action=='update' else (local_now().strftime('%H:%M') if action=='check_in' else (old['clock_in'] if old else None))
        cout=valid_time(body.get('clock_out')) if action=='update' else (local_now().strftime('%H:%M') if action=='check_out' else (old['clock_out'] if old else None))
        shift=str(body.get('shift') or (old['shift'] if old else setting(db,'office_start','09:00'))).strip()[:40]
        status=str(body.get('status') or ('present' if cin or cout else 'absent')).lower().replace(' ','_')
        allowed={'present','late','absent','on_leave','early_arrival','missing_check_in','not_checked_in'}
        if status not in allowed:raise HTTPException(400,'Invalid attendance status')
        late_minutes=0
        if cin and re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d',shift):
            late_minutes=max(0,(int(cin[:2])*60+int(cin[3:]))-(int(shift[:2])*60+int(shift[3:])+int(setting(db,'grace_minutes','15'))))
            if late_minutes and status in ('present','early_arrival'):status='late'
        work_minutes=None
        if cin and cout:
            work_minutes=int((datetime.strptime(cout,'%H:%M')-datetime.strptime(cin,'%H:%M')).total_seconds()//60)
            if work_minutes<0:work_minutes+=1440
        db.execute('''INSERT INTO daily(employee_id,work_date,status,clock_in,clock_out,late_minutes,work_minutes,shift,source)
          VALUES(?,?,?,?,?,?,?,?, 'local_edit') ON CONFLICT(employee_id,work_date) DO UPDATE SET
          status=excluded.status,clock_in=excluded.clock_in,clock_out=excluded.clock_out,
          late_minutes=excluded.late_minutes,work_minutes=excluded.work_minutes,shift=excluded.shift,
          source='local_edit',updated_at=CURRENT_TIMESTAMP''',
          (employee_id,work_date,status,cin,cout,late_minutes,work_minutes,shift))
        after=dict(db.execute('SELECT * FROM daily WHERE employee_id=? AND work_date=?',(employee_id,work_date)).fetchone())
        db.execute('INSERT INTO attendance_changes(employee_id,work_date,changed_by,action,before_json,after_json) VALUES(?,?,?,?,?,?)',
          (employee_id,work_date,user.get('username','unknown'),action,json.dumps(before,default=str),json.dumps(after,default=str)))
    return {'success':True,'message':'Attendance updated. Original MDB was not modified.','record':after}

# ── Discrepancies: a separate, audited local review queue. ────────────────────
# CHECKINOUT does not reveal the biometric modality. Enrollment remains UNKNOWN
# until explicitly confirmed. Only a confirmed Not Configured employee with an
# original MDB check-in is eligible for the separate automatic leave exception.
ISSUE_LABELS={
 'missing_check_out':'Missing Check-out',
 'missing_check_in':'Missing Check-in',
 'biometric_not_configured':'Biometric Not Configured',
 'leave_with_punch':'Leave With Attendance Punch'
}

def candidate_issues(row):
    ci=bool(row['clock_in']);co=bool(row['clock_out'])
    status=str(row['status'] or '').lower()
    issues=[]
    if ci and not co:issues.append('missing_check_out')
    if co and not ci:issues.append('missing_check_in')
    if (ci or co) and row['biometric_enrollment']=='not_configured':
        issues.append('biometric_not_configured')
    if (ci or co) and status=='on_leave':
        issues.append('leave_with_punch')
    return issues


def apply_auto_biometric_exceptions(work_date=None, employee_id=None):
    """Apply the explicit Not Configured rule to today's verified MDB check-ins.

    Unknown enrollment is never treated as Not Configured. Only a confirmed
    not_configured employee with a source MDB check-in is eligible. The original
    raw_daily/punches remain untouched; only the effective attendance overlay and
    discrepancy review are written (to Supabase in cloud mode).
    """
    if not AUTO_BIOMETRIC_LEAVE_ENABLED:
        return {'enabled':False,'applied':0,'items':[]}
    day = str(work_date or today_iso())
    try:
        day = date.fromisoformat(day).isoformat()
    except ValueError:
        raise HTTPException(400,'Invalid work date for automatic biometric rule')
    note = ('Automatic rule: employee is explicitly marked Not Configured for biometric enrollment '
            'and a check-in punch exists in the original MDB. Original biometric source data was preserved.')
    applied=[];warnings=[]
    with WRITE_LOCK:
      with connection() as db:
        sql="""SELECT s.employee_id,s.work_date,s.status,s.clock_in,s.clock_out,s.late_minutes,
                      s.early_minutes,s.work_minutes,s.shift,e.biometric_enrollment,d.source effective_source
               FROM raw_daily s JOIN employees e ON e.id=s.employee_id
               LEFT JOIN daily d ON d.employee_id=s.employee_id AND d.work_date=s.work_date
               WHERE s.work_date=? AND e.biometric_enrollment='not_configured'
                 AND s.clock_in IS NOT NULL
                 AND EXISTS(SELECT 1 FROM punches p WHERE p.employee_id=s.employee_id
                   AND substr(p.happened_at,1,10)=s.work_date AND p.source LIKE 'mdb%')"""
        args=[day]
        if employee_id is not None:
            sql+=' AND s.employee_id=?';args.append(int(employee_id))
        candidates=rows_as_dict(db.execute(sql+' ORDER BY s.employee_id',args).fetchall())
        for source in candidates:
            ident=int(source['employee_id'])
            current=db.execute('SELECT * FROM daily WHERE employee_id=? AND work_date=?',(ident,day)).fetchone()
            if not current:
                continue
            if current['source'] in ('local_edit','cloud_adjustment','auto_rule'):
                continue
            after={
                'status':'on_leave','clock_in':source['clock_in'],'clock_out':source['clock_out'],
                'late_minutes':int(source.get('late_minutes') or 0),
                'early_minutes':int(source.get('early_minutes') or 0),
                'work_minutes':source.get('work_minutes'),'shift':source.get('shift')
            }
            try:
                if CLOUD_ENABLED:
                    remote=cloud.rpc('attendpro_apply_biometric_exception',{
                        'p_employee_id':ident,'p_work_date':day,'p_note':note})
                    if not isinstance(remote,dict) or not remote.get('applied'):
                        continue
                    version=int(remote.get('version') or 1)
                    after_remote=remote.get('after_json') or after
                    if isinstance(after_remote,str):after_remote=json.loads(after_remote)
                    apply_override_local(db,ident,day,after_remote,version)
                    after=after_remote
                else:
                    before=dict(current)
                    db.execute("""UPDATE daily SET status='on_leave',source='auto_rule',
                       late_minutes=?,early_minutes=?,work_minutes=?,shift=?,updated_at=CURRENT_TIMESTAMP
                       WHERE employee_id=? AND work_date=?""",(
                       after['late_minutes'],after['early_minutes'],after['work_minutes'],after['shift'],ident,day))
                    after=dict(db.execute('SELECT * FROM daily WHERE employee_id=? AND work_date=?',(ident,day)).fetchone())
                    db.execute("""INSERT INTO attendance_changes(employee_id,work_date,changed_by,action,before_json,after_json)
                       VALUES(?,?,?,?,?,?)""",(ident,day,'AttendPro Scheduler','auto_biometric_not_configured',
                       json.dumps(before,default=str),json.dumps(after,default=str)))
                for issue_type in ('biometric_not_configured','leave_with_punch'):
                    db.execute("""INSERT INTO discrepancy_reviews(employee_id,work_date,issue_type,resolution,note,reviewed_by)
                       VALUES(?,?,?,?,?,?) ON CONFLICT(employee_id,work_date,issue_type)
                       DO UPDATE SET resolution=excluded.resolution,note=excluded.note,
                         reviewed_by=excluded.reviewed_by,reviewed_at=CURRENT_TIMESTAMP""",
                       (ident,day,issue_type,'on_leave',note,'AttendPro Scheduler'))
                applied.append({'employee_id':ident,'work_date':day,'status':'on_leave'})
            except Exception as exc:
                warnings.append({'employee_id':ident,'error':str(exc)[:220]})
    return {'enabled':True,'applied':len(applied),'items':applied,'warnings':warnings,
            'original_mdb_changed':False,'supabase_only_correction':bool(CLOUD_ENABLED)}

@app.get('/api/discrepancies')
@redis_cached_endpoint('discrepancies')
def list_discrepancies(request: Request, from_date:str='', to_date:str='', state:str='open', issue:str='', search:str='',page:int=1,per_page:int=50):
    with connection() as db:
        # Default to the newest imported report, not server's calendar date.
        most_recent=db.execute('SELECT MAX(work_date) FROM daily').fetchone()[0] or today_iso()
        left=from_date or most_recent;right=to_date or left
        try:l=date.fromisoformat(left);r=date.fromisoformat(right)
        except ValueError:raise HTTPException(400,'Dates must be YYYY-MM-DD')
        if l>r or (r-l).days>366:raise HTTPException(400,'Choose a valid date range up to 366 days')
        if state not in ('open','resolved','all'):raise HTTPException(400,'Invalid state filter')
        if issue and issue not in ISSUE_LABELS:raise HTTPException(400,'Invalid issue filter')
        where=['d.work_date BETWEEN ? AND ?'];args=[l.isoformat(),r.isoformat()]
        if search:
            where.append('(e.name LIKE ? OR e.badge_number LIKE ? OR e.device_user_id LIKE ?)')
            args.extend([f'%{search.strip()}%']*3)
        rows=db.execute('''SELECT d.employee_id,d.work_date,d.clock_in,d.clock_out,d.status,d.source,d.shift,
          e.name,e.badge_number,e.department,e.biometric_enrollment,
          v.issue_type reviewed_issue,v.resolution,v.note,v.reviewed_by,v.reviewed_at
          FROM daily d JOIN employees e ON e.id=d.employee_id
          LEFT JOIN discrepancy_reviews v ON v.employee_id=d.employee_id AND v.work_date=d.work_date
          WHERE '''+' AND '.join(where)+''' ORDER BY d.work_date DESC,e.name''',args).fetchall()
        by_key={};cases=[]
        for row in rows:
            d=dict(row);key=(d['employee_id'],d['work_date'])
            item=by_key.setdefault(key,{**d,'reviews':{}})
            if d['reviewed_issue']:
                item['reviews'][d['reviewed_issue']]={'resolution':d['resolution'],'note':d['note'],
                 'reviewed_by':d['reviewed_by'],'reviewed_at':d['reviewed_at']}
        for item in by_key.values():
            for kind in candidate_issues(item):
                if issue and kind!=issue:continue
                review=item['reviews'].get(kind)
                # Manually reviewed cases remain visible in the Resolved/All filter,
                # even if a local correction later removes the raw issue.
                cases.append({k:item[k] for k in ('employee_id','work_date','clock_in','clock_out','status','source','shift',
                      'name','badge_number','department','biometric_enrollment')}|
                      {'issue_type':kind,'issue_label':ISSUE_LABELS[kind],
                       'review_state':'resolved' if review else 'open',
                       'resolution':review['resolution'] if review else None,
                       'review_note':review['note'] if review else '',
                       'reviewed_by':review['reviewed_by'] if review else None,
                       'reviewed_at':review['reviewed_at'] if review else None})
            for kind,review in item['reviews'].items():
                if kind in candidate_issues(item) or (issue and kind!=issue):continue
                cases.append({k:item[k] for k in ('employee_id','work_date','clock_in','clock_out','status','source','shift',
                      'name','badge_number','department','biometric_enrollment')}|
                      {'issue_type':kind,'issue_label':ISSUE_LABELS.get(kind,kind),
                       'review_state':'resolved','resolution':review['resolution'],
                       'review_note':review['note'],'reviewed_by':review['reviewed_by'],
                       'reviewed_at':review['reviewed_at']})
        all_count=len(cases)
        open_count=sum(x['review_state']=='open' for x in cases)
        resolved_count=all_count-open_count
        filtered=[x for x in cases if state=='all' or x['review_state']==state]
        page,per_page=safe_pagination(page,per_page)
        return {'from':left,'to':right,'total':len(filtered),'page':page,'per_page':per_page,
             'summary':{'total':all_count,'open':open_count,'resolved':resolved_count,
             'missing_check_out':sum(x['issue_type']=='missing_check_out' for x in cases),
             'missing_check_in':sum(x['issue_type']=='missing_check_in' for x in cases),
             'biometric_not_configured':sum(x['issue_type']=='biometric_not_configured' for x in cases)},
             'items':filtered[(page-1)*per_page:page*per_page]}

@app.put('/api/discrepancies/biometric-status')
async def update_biometric_status(request:Request):
    user=require_roles(request,'supervisor','super_admin')
    body=await request.json()
    try:employee_id=int(body.get('employee_id'))
    except (TypeError,ValueError):raise HTTPException(400,'Choose an employee')
    enrollment=str(body.get('status') or '').strip()
    if enrollment not in ('unknown','configured','not_configured'):
        raise HTTPException(400,'Choose Unknown, Configured, or Not Configured')
    note=str(body.get('note') or '').strip()[:400]
    with WRITE_LOCK:
      with connection() as db:
        old=db.execute('SELECT biometric_enrollment FROM employees WHERE id=?',(employee_id,)).fetchone()
        if not old:raise HTTPException(404,'Employee not found')
        if CLOUD_ENABLED:
          cloud_or_503(lambda:cloud.rpc('attendpro_set_biometric_status',{
              'p_actor':user['auth_id'],'p_employee_id':employee_id,
              'p_status':enrollment,'p_note':note}))
        db.execute('UPDATE employees SET biometric_enrollment=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',(enrollment,employee_id))
        db.execute('''INSERT INTO biometric_status_changes(employee_id,prior_status,new_status,changed_by,note)
             VALUES(?,?,?,?,?)''',(employee_id,old['biometric_enrollment'],enrollment,user['username'],note))
    auto_rule=apply_auto_biometric_exceptions(today_iso(),employee_id) if enrollment=='not_configured' else {'applied':0}
    return {'success':True,'status':enrollment,'auto_rule':auto_rule,
            'message':'Biometric enrollment status saved. Confirmed Not Configured check-ins are automatically marked On Leave in the effective record; original MDB remains unchanged.'}

@app.post('/api/discrepancies/resolve')
async def resolve_discrepancy(request:Request):
    user=require_roles(request,'supervisor','super_admin')
    body=await request.json()
    try:employee_id=int(body.get('employee_id'))
    except (TypeError,ValueError):raise HTTPException(400,'Choose an employee')
    issue=str(body.get('issue_type') or '').strip()
    resolution=str(body.get('resolution') or '').strip()
    if issue not in ISSUE_LABELS:raise HTTPException(400,'Invalid discrepancy type')
    if resolution not in ('reviewed','present','on_leave'):
        raise HTTPException(400,'Choose Reviewed, Present, or On Leave')
    note=str(body.get('note') or '').strip()[:500]
    if resolution in ('present','on_leave') and len(note)<3:
        raise HTTPException(400,'Please explain why you changed attendance (minimum 3 characters)')
    try:work_day=date.fromisoformat(str(body.get('work_date') or '')).isoformat()
    except ValueError:raise HTTPException(400,'Valid date required')
    with WRITE_LOCK:
      with connection() as db:
        row=db.execute('''SELECT d.*, e.biometric_enrollment FROM daily d JOIN employees e ON e.id=d.employee_id
                 WHERE d.employee_id=? AND d.work_date=?''',(employee_id,work_day)).fetchone()
        prior_review=db.execute('SELECT 1 FROM discrepancy_reviews WHERE employee_id=? AND work_date=? AND issue_type=?',
                    (employee_id,work_day,issue)).fetchone()
        if not row:raise HTTPException(404,'No attendance record found for this employee and date')
        if issue not in candidate_issues(row) and not prior_review:
            raise HTTPException(409,'This discrepancy is no longer present; refresh the screen')
        before=dict(row)
        if CLOUD_ENABLED:
            after_for_cloud={k:before[k] for k in ('status','clock_in','clock_out','late_minutes','early_minutes','work_minutes','shift')}
            if resolution in ('present','on_leave'):after_for_cloud['status']=resolution
            # Single cloud transaction includes BOTH review and optional approved correction.
            cloud_or_503(lambda:cloud.rpc('attendpro_resolve_discrepancy',{
                'p_employee_id':employee_id,'p_work_date':work_day,'p_issue':issue,
                'p_resolution':resolution,'p_note':note,'p_actor':user['auth_id'],
                'p_after':after_for_cloud if resolution in ('present','on_leave') else None}))
        if resolution in ('present','on_leave'):
            db.execute('''UPDATE daily SET status=?,source='local_edit',updated_at=CURRENT_TIMESTAMP
                     WHERE employee_id=? AND work_date=?''',(resolution,employee_id,work_day))
            after=dict(db.execute('SELECT * FROM daily WHERE employee_id=? AND work_date=?',(employee_id,work_day)).fetchone())
            db.execute('''INSERT INTO attendance_changes(employee_id,work_date,changed_by,action,before_json,after_json)
               VALUES(?,?,?,?,?,?)''',(employee_id,work_day,user['username'],'discrepancy_'+resolution,
                           json.dumps(before,default=str),json.dumps(after,default=str)))
        db.execute('''INSERT INTO discrepancy_reviews(employee_id,work_date,issue_type,resolution,note,reviewed_by)
            VALUES(?,?,?,?,?,?) ON CONFLICT(employee_id,work_date,issue_type)
            DO UPDATE SET resolution=excluded.resolution,note=excluded.note,reviewed_by=excluded.reviewed_by,
             reviewed_at=CURRENT_TIMESTAMP''',(employee_id,work_day,issue,resolution,note,user['username']))
    return {'success':True,'message':'Discrepancy reviewed and saved in AttendPro. Original ZKTeco MDB unchanged.'}

@app.post('/api/employees')
async def create_employee(request:Request):
 require_roles(request,'super_admin')
 try: data=await request.json()
 except Exception:raise HTTPException(400,'Valid JSON data required')
 if not isinstance(data,dict):raise HTTPException(400,'Employee object required')
 name=str(data.get('name') or '').strip()
 if len(name)<2 or len(name)>120:raise HTTPException(400,'Full name must contain 2 to 120 characters')
 fields={}
 for key,maximum,default in [('badge_number',80,''),('department',100,'Unassigned'),('designation',100,'Staff'),('shift',100,'General')]:
  val=str(data.get(key) or '').strip() or default
  if len(val)>maximum:raise HTTPException(400,key+' is too long')
  fields[key]=val
 device_id='manual-'+secrets.token_hex(12)
 if CLOUD_ENABLED:
  actor=require_roles(request,'super_admin')
  remote=cloud_or_503(lambda:cloud.rpc('attendpro_create_employee',{
     'p_actor':actor['auth_id'],'p_device_user_id':device_id,
     'p_badge_number':fields['badge_number'],'p_name':name,'p_department':fields['department'],
     'p_designation':fields['designation'],'p_shift':fields['shift']}))
  with WRITE_LOCK:
   with connection() as db:
    db.execute('''INSERT OR IGNORE INTO employees(id,device_user_id,source_userid,badge_number,name,
       department,designation,shift,active) VALUES(?,?,?,?,?,?,?,?,1)''',(
       int(remote['id']),device_id,None,fields['badge_number'] or None,name,
       fields['department'],fields['designation'],fields['shift']))
  return {'success':True,'employee':dict(remote),'message':'Employee created in Supabase; MDB unchanged.'}
 with WRITE_LOCK:
  with connection() as db:
   if fields['badge_number'] and db.execute('SELECT 1 FROM employees WHERE badge_number=?',(fields['badge_number'],)).fetchone():
    raise HTTPException(409,'This AC-No. already belongs to another employee')
   cur=db.execute('''INSERT INTO employees (device_user_id,source_userid,badge_number,name,department,designation,shift,active)
     VALUES(?,NULL,?,?,?,?,?,1)''',(device_id,fields['badge_number'] or None,name,fields['department'],fields['designation'],fields['shift']))
   employee=dict(db.execute('SELECT * FROM employees WHERE id=?',(cur.lastrowid,)).fetchone())
   if CLOUD_ENABLED:
    from cloud_projection import EMP_COLUMNS
    record={k:employee.get(k) for k in EMP_COLUMNS};record['active']=True
    cloud_or_503(lambda:cloud.upsert('attendpro_employees',record,'id'))
 return {'success':True,'employee':employee,'message':'Employee saved in Supabase.' if CLOUD_ENABLED else 'Employee created in local AttendPro database. Original MDB unchanged.'}

@app.patch('/api/employees/{employee_id}')
async def update_employee_profile(employee_id:int,request:Request):
    """Save an HR profile override. Never write an MDB or the original source snapshot."""
    actor=require_roles(request,'super_admin')
    body=await request.json()
    if not isinstance(body,dict):raise HTTPException(400,'Employee profile object required')
    allowed=('name','department','designation','shift','phone','email')
    with connection() as db:
        existing=db.execute('SELECT * FROM employees WHERE id=?',(employee_id,)).fetchone()
        if not existing:raise HTTPException(404,'Employee not found')
        values={field:str(body.get(field,existing[field]) or '').strip() for field in allowed}
        if not 2<=len(values['name'])<=120:raise HTTPException(400,'Name must contain 2 to 120 characters')
        if any(len(values[field])>180 for field in allowed):raise HTTPException(400,'Profile field is too long')
        if values['email'] and ('@' not in values['email'] or len(values['email'])>180):
            raise HTTPException(400,'Invalid email address')
        if CLOUD_ENABLED:
            try:
                cloud.upsert('attendpro_employee_profile_overrides',{
                    'employee_id':employee_id,**values,'updated_by':actor['auth_id']},'employee_id')
            except CloudError as exc:
                raise HTTPException(503,'Supabase profile override could not be saved. Apply migration 003 and check the cloud connection: '+str(exc)) from exc
        with WRITE_LOCK:
            db.execute('UPDATE employees SET '+','.join(field+'=?' for field in allowed)+
                       ',updated_at=CURRENT_TIMESTAMP WHERE id=?',list(values.values())+[employee_id])
    return {'success':True,'employee_id':employee_id,'profile':values,
            'saved_to':'supabase' if CLOUD_ENABLED else 'local',
            'original_mdb_changed':False}

@app.get('/api/employees')
@redis_cached_endpoint('employees')
def employees(search:str='',department:str='',page:int=1,per_page:int=30):
 with connection() as db:
  page,per_page=safe_pagination(page,per_page)
  wh=['active=1'];args=[]
  if search:wh.append('(name LIKE ? OR badge_number LIKE ? OR device_user_id LIKE ?)');args.extend([f'%{search}%']*3)
  if department and department!='all':wh.append('department=?');args.append(department)
  where=' WHERE '+' AND '.join(wh)
  n=db.execute('SELECT COUNT(*) FROM employees'+where,args).fetchone()[0]
  out=rows_as_dict(db.execute('SELECT * FROM employees'+where+' ORDER BY name LIMIT ? OFFSET ?',args+[per_page,(page-1)*per_page]).fetchall())
  return {'total':n,'page':page,'items':out}

@app.get('/api/employee/{employee_id}')
@redis_cached_endpoint('employee-detail')
def employee_detail(employee_id:int):
 with connection() as db:
  e=db.execute('SELECT * FROM employees WHERE id=?',(employee_id,)).fetchone()
  if not e:raise HTTPException(404,'Employee not found')
  days=rows_as_dict(db.execute('SELECT * FROM daily WHERE employee_id=? ORDER BY work_date DESC LIMIT 180',(employee_id,)).fetchall())
  punches=rows_as_dict(db.execute('SELECT * FROM punches WHERE employee_id=? ORDER BY happened_at DESC LIMIT 100',(employee_id,)).fetchall())
  return {'employee':dict(e),'history':days,'punches':punches}

@app.get('/api/imports')
def imports():
 with connection() as db:return {'items':rows_as_dict(db.execute('SELECT * FROM imports ORDER BY id DESC LIMIT 20').fetchall())}

@app.post('/api/import-excel')
async def upload(request:Request, filename:str='upload.xls'):
 require_roles(request,'super_admin')
 suffix=Path(filename).suffix.lower()
 if suffix not in ('.xls','.xlsx','.csv'):raise HTTPException(400,'Only .xls, .xlsx and .csv supported')
 raw=await request.body()
 if len(raw)>25_000_000:raise HTTPException(413,'File too large (25 MB max)')
 if len(raw)<20:raise HTTPException(400,'Empty file')
 try:
  with WRITE_LOCK:
   with connection() as db:
    result=import_spreadsheet(db,raw,filename)
    if CLOUD_ENABLED:
     capture_original_from_daily(db)
     mark_pending_sync(db)
   if CLOUD_ENABLED:
    try:flush_pending_source_upload()
    except CloudError:result['cloud_pending']=True
   return result
 except (ValueError,UnicodeError,KeyError,IndexError,AssertionError) as exc:raise HTTPException(400,str(exc)) from exc

@app.get('/api/export')
def export(date:Optional[str]=None,status:str='',department:str='',search:str=''):
 with connection() as db:
  d=requested_date(db,date);frm,args=daily_query(d,status,department,search)
  rows=db.execute('''SELECT e.badge_number,e.name,e.department,d.work_date,d.status,d.clock_in,d.clock_out,
   d.late_minutes,d.work_minutes,d.source '''+frm+' ORDER BY e.name',args).fetchall()
  data=[list(row) for row in rows]
 out=io.StringIO();writer=csv.writer(out);writer.writerow(['AC-No.','Name','Department','Date','Status','Clock In','Clock Out','Late (min)','Work (min)','Source'])
 for row in data:
  # Guard against spreadsheet formula injection on downloaded CSV
  writer.writerow(["'"+str(v) if isinstance(v,str) and v.startswith(('=','+','-','@','\t','\r')) else v for v in row])
 return Response(out.getvalue(),media_type='text/csv; charset=utf-8',headers={'Content-Disposition':f'attachment; filename="attendance-{d}.csv"'})

@app.post('/api/reports/excel')
async def export_report_excel(request:Request):
    body=await request.json()
    from_text=str(body.get('from') or (local_now().date()-timedelta(days=6)).isoformat())
    to_text=str(body.get('to') or from_text)
    try:
        from_day=date.fromisoformat(from_text);to_day=date.fromisoformat(to_text)
    except ValueError:raise HTTPException(400,'Dates must be YYYY-MM-DD')
    if from_day>to_day:raise HTTPException(400,'From date must be before or equal to To date')
    if (to_day-from_day).days>366:raise HTTPException(400,'Please select a date range of 366 days or less')
    posted_rows=body.get('rows')
    if posted_rows is not None:
        if not isinstance(posted_rows,list) or len(posted_rows)>20000:raise HTTPException(400,'Invalid report rows')
        rows=[]
        for item in posted_rows:
            if not isinstance(item,dict):continue
            rows.append({'badge_number':str(item.get('id') or ''),'name':str(item.get('name') or ''),
              'work_date':str(item.get('date') or from_text),'shift':str(item.get('timetable') or item.get('shift') or ''),
              'clock_in':str(item.get('cin') or ''),'clock_out':str(item.get('cout') or ''),
              'status':str(item.get('status') or ('absent' if str(item.get('absent','')).lower() in ('true','yes','1') else 'present')).lower().replace(' ','_'),
              'department':str(item.get('dept') or item.get('department') or ''),
              'late_minutes':item.get('late_minutes',0),'early_minutes':item.get('early_minutes',0)})
    else:
        where=['d.work_date BETWEEN ? AND ?'];args=[from_day.isoformat(),to_day.isoformat()]
        department=str(body.get('department') or '').strip();status=str(body.get('status') or '').strip().lower()
        search=str(body.get('search') or '').strip()
        if department and department!='all':where.append('e.department=?');args.append(department)
        if status and status!='all':where.append('d.status=?');args.append(status)
        if search:where.append('(e.name LIKE ? OR e.badge_number LIKE ? OR e.device_user_id LIKE ?)');args.extend([f'%{search}%']*3)
        with connection() as db:
            rows=rows_as_dict(db.execute('''SELECT e.badge_number,e.name,e.department,d.work_date,d.status,d.clock_in,d.clock_out,d.shift,d.late_minutes,d.early_minutes
              FROM daily d JOIN employees e ON e.id=d.employee_id WHERE '''+' AND '.join(where)+' ORDER BY d.work_date,e.name',args).fetchall())
    try:
        content=build_report_xlsx(ROOT/'templates'/'attendance_report_template.xlsx',rows,from_day.isoformat(),to_day.isoformat())
    except Exception as exc:
        raise HTTPException(500,f'Could not create Excel report: {exc}') from exc
    filename=f'attendpro-report-{from_day.strftime("%Y%m%d")}-{to_day.strftime("%Y%m%d")}.xlsx'
    return StreamingResponse(io.BytesIO(content),media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition':f'attachment; filename="{filename}"','Cache-Control':'no-store'})

@app.get('/api/settings')
def get_settings():
 with connection() as db:
  selected=active_device_id(db)
  row=db.execute('SELECT * FROM devices WHERE id=?',(selected,)).fetchone()
  if not row: row=db.execute('SELECT * FROM devices ORDER BY id LIMIT 1').fetchone()
  dev_id=int(row['id']) if row else None
  devices=all_devices(db)
  return {'access_path':row['mdb_path'] if row else '',
   'access_auto':bool(row['auto_sync']) if row else False,
   'access_interval':int(row['sync_interval']) if row else 90,
   'office_start':setting(db,'office_start','09:00'),
   'grace_minutes':int(setting(db,'grace_minutes','15')),
   'device':device_status(db,dev_id),'devices':devices['items'],'active_device_id':devices['active_device_id'],
   'last_folder_import':setting(db,'last_folder_import')}

@app.put('/api/settings')
async def change_settings(request:Request):
 require_roles(request,'super_admin')
 body=await request.json()
 allow={'access_path','access_auto','access_interval','office_start','grace_minutes'}
 updates={k:v for k,v in body.items() if k in allow}
 if 'access_path' in updates: updates['access_path']=validate_mdb_path(updates['access_path'])
 if 'access_interval' in updates:
  try:n=int(updates['access_interval'])
  except (TypeError,ValueError):raise HTTPException(400,'Invalid interval')
  if not 30<=n<=86400:raise HTTPException(400,'Interval must be 30–86400 seconds')
  updates['access_interval']=n
 if 'office_start' in updates and not re.fullmatch(r'([01]\d|2[0-3]):[0-5]\d',str(updates['office_start'])):raise HTTPException(400,'Office start HH:MM required')
 if 'grace_minutes' in updates:
  try:grace=int(updates['grace_minutes'])
  except (TypeError,ValueError):raise HTTPException(400,'Invalid grace minutes')
  if not 0<=grace<=120:raise HTTPException(400,'Grace must be 0–120')
 with WRITE_LOCK:
  with connection() as db:
   dev_id=active_device_id(db)
   if dev_id and any(k in updates for k in ('access_path','access_auto','access_interval')):
    row=db.execute('SELECT mdb_path FROM devices WHERE id=?',(dev_id,)).fetchone()
    prior=row['mdb_path'] if row else ''
    path=updates.get('access_path',prior)
    auto=updates.get('access_auto');interval=updates.get('access_interval')
    if 'access_path' in updates and prior!=path:
     db.execute("UPDATE devices SET status='not_tested',last_error=NULL,last_sync=NULL WHERE id=?",(dev_id,))
     db.execute('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)',(f'device_{dev_id}_access_signature',''))
    sets=[];vals=[]
    if 'access_path' in updates:sets.append('mdb_path=?');vals.append(path)
    if auto is not None:sets.append('auto_sync=?');vals.append(1 if auto else 0)
    if interval is not None:sets.append('sync_interval=?');vals.append(interval)
    if sets:db.execute('UPDATE devices SET '+','.join(sets)+' WHERE id=?',vals+[dev_id])
    db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES ('access_path',?)",(path,))
    if auto is not None:db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES ('access_auto',?)",('true' if auto else 'false',))
    if interval is not None:db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES ('access_interval',?)",(str(interval),))
   for k in ('office_start','grace_minutes'):
    if k in updates:db.execute('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)',(k,str(updates[k])))
 return get_settings()

@app.get('/api/devices')
def list_devices():
 with connection() as db:return all_devices(db)

@app.post('/api/devices')
async def create_device(request:Request):
 require_roles(request,'super_admin')
 body=await request.json();name=str(body.get('name') or '').strip()[:100]
 if not name:raise HTTPException(400,'Device name required')
 path=validate_mdb_path(body.get('mdb_path',''))
 model=str(body.get('model') or 'ZKTeco uFace 800').strip()[:120]
 serial=str(body.get('serial_number') or 'Not configured').strip()[:120]
 try:interval=int(body.get('sync_interval',90))
 except (TypeError,ValueError):raise HTTPException(400,'Invalid sync interval')
 if not 30<=interval<=86400:raise HTTPException(400,'Sync interval must be 30–86400 seconds')
 with connection() as db:
  cur=db.execute('''INSERT INTO devices(name,model,serial_number,mdb_path,auto_sync,sync_interval,status)
   VALUES(?,?,?,?,?,?,?)''',(name,model,serial,path,1 if body.get('auto_sync') else 0,interval,'not_tested' if path else 'not_configured'))
  ident=cur.lastrowid
  if not active_device_id(db):db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES ('active_device_id',?)",(str(ident),))
  return {'success':True,'device':device_status(db,ident),'devices':all_devices(db)}

@app.put('/api/devices/{device_id}')
async def update_device(device_id:int,request:Request):
 require_roles(request,'super_admin');body=await request.json();values={}
 with connection() as db:
  row=db.execute('SELECT * FROM devices WHERE id=?',(device_id,)).fetchone()
  if not row:raise HTTPException(404,'Device not found')
  for key in ('name','model','serial_number'):
   if key in body:
    value=str(body[key] or '').strip()[:120]
    if key=='name' and not value:raise HTTPException(400,'Device name required')
    values[key]=value
  if 'mdb_path' in body:
   path=validate_mdb_path(body['mdb_path']);values['mdb_path']=path
   if path!=row['mdb_path']:
    values['status']='not_tested' if path else 'not_configured';values['last_error']=None;values['last_sync']=None
    db.execute('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)',(f'device_{device_id}_access_signature',''))
  if 'auto_sync' in body:values['auto_sync']=1 if body['auto_sync'] else 0
  if 'sync_interval' in body:
   try:interval=int(body['sync_interval'])
   except (TypeError,ValueError):raise HTTPException(400,'Invalid sync interval')
   if not 30<=interval<=86400:raise HTTPException(400,'Sync interval must be 30–86400 seconds')
   values['sync_interval']=interval
  if values:db.execute('UPDATE devices SET '+','.join(f'{k}=?' for k in values)+' WHERE id=?',list(values.values())+[device_id])
  return {'success':True,'device':device_status(db,device_id),'devices':all_devices(db)}

@app.delete('/api/devices/{device_id}')
def delete_device(device_id:int,request:Request):
 require_roles(request,'super_admin')
 with connection() as db:
  if not db.execute('SELECT id FROM devices WHERE id=?',(device_id,)).fetchone():raise HTTPException(404,'Device not found')
  if db.execute('SELECT COUNT(*) FROM devices').fetchone()[0]<=1:raise HTTPException(400,'At least one device must remain configured.')
  db.execute('DELETE FROM devices WHERE id=?',(device_id,))
  if active_device_id(db)==device_id:
   nxt=db.execute('SELECT id FROM devices ORDER BY id LIMIT 1').fetchone()
   db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES ('active_device_id',?)",(str(nxt['id']),))
  return {'success':True,'devices':all_devices(db)}

@app.post('/api/devices/{device_id}/select')
def select_device(device_id:int,request:Request):
 require_roles(request,'super_admin')
 with connection() as db:
  row=db.execute('SELECT * FROM devices WHERE id=?',(device_id,)).fetchone()
  if not row:raise HTTPException(404,'Device not found')
  db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES ('active_device_id',?)",(str(device_id),))
  aliases={'access_path':row['mdb_path'],'access_auto':'true' if row['auto_sync'] else 'false','access_interval':str(row['sync_interval']),
   'access_last_sync':row['last_sync'] or '','access_last_test':row['last_test'] or '','access_last_attempt':row['last_attempt'] or '',
   'access_last_error':row['last_error'] or '','access_last_fetched':str(row['last_fetched'] or 0),'access_last_inserted':str(row['last_inserted'] or 0),'access_status':row['status']}
  for key,value in aliases.items():db.execute('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)',(key,value))
  return {'success':True,'active_device_id':device_id,'device':device_status(db,device_id),'devices':all_devices(db)}

async def test_device(device_id):
 with connection() as db:
  row=db.execute('SELECT mdb_path FROM devices WHERE id=?',(device_id,)).fetchone()
  if not row:raise HTTPException(404,'Device not found')
  path=row['mdb_path']
 try:
  info=await asyncio.to_thread(verify_source,path)
  with connection() as db:db.execute("UPDATE devices SET last_test=?,status='tested',last_error=NULL WHERE id=?",(stamp(),device_id))
  return {'success':True,'message':'MDB file readable; expected tables present.','details':info,'device_id':device_id}
 except Exception as exc:
  with connection() as db:db.execute("UPDATE devices SET status='error',last_error=? WHERE id=?",(str(exc)[:400],device_id))
  return {'success':False,'message':str(exc),'device_id':device_id}

@app.post('/api/devices/{device_id}/test')
async def test_specific_device(device_id:int,request:Request):
 require_roles(request,'super_admin')
 return await test_device(device_id)

@app.post('/api/devices/{device_id}/sync')
async def sync_specific_device(device_id:int,request:Request):
 require_roles(request,'super_admin')
 return await asyncio.to_thread(run_access_sync,True,device_id)

@app.get('/api/users')
def list_users(request:Request):
 require_roles(request,'super_admin')
 if CLOUD_ENABLED:
  users=cloud_or_503(lambda:cloud.rows('attendpro_app_users',{'order':'display_name.asc'}))
  return {'items':[{'id':u['id'],'username':u['email'],'display_name':u['display_name'],
          'role':u['role'],'active':u['active'],'created_at':u['created_at'],
          'role_label':ROLE_LABELS.get(u['role'],u['role'])} for u in users]}
 with connection() as db:
  rows=rows_as_dict(db.execute('SELECT id,username,display_name,role,active,created_at FROM app_users ORDER BY display_name COLLATE NOCASE').fetchall())
  for row in rows:row['role_label']=ROLE_LABELS.get(row['role'],row['role'])
  return {'items':rows}

@app.post('/api/users')
async def create_user(request:Request):
 require_roles(request,'super_admin')
 body=await request.json();username=str(body.get('username') or '').strip()
 display=str(body.get('display_name') or '').strip();role=str(body.get('role') or 'view_only');password=str(body.get('password') or '')
 if CLOUD_ENABLED:
  if '@' not in username or len(username)>250:raise HTTPException(400,'Enter a valid email address.')
  if role not in ROLE_LABELS or len(password)<8 or not display:raise HTTPException(400,'Valid name, role, email and password (8+ chars) required')
  try:
   created=cloud.admin_create(username,password)
   auth_id=created.get('id') or created.get('user',{}).get('id')
   if not auth_id:raise CloudError('Supabase did not return new Auth user id')
   try:
    profile=cloud.upsert('attendpro_app_users',{'auth_id':auth_id,'email':username.lower(),
          'display_name':display,'role':role,'active':True},'auth_id')[0]
   except CloudError:
    cloud.admin_delete(auth_id)
    raise
  except CloudError as e:raise HTTPException(503,str(e)) from e
  return {'success':True,'user':{'id':profile['id'],'username':username,'display_name':display,'role':role,'active':True}}
 if not re.fullmatch(r'[A-Za-z0-9_.-]{3,40}',username):raise HTTPException(400,'Username must be 3–40 characters and contain only letters, numbers, dots, dashes or underscores.')
 if not display:raise HTTPException(400,'Display name required')
 if role not in ROLE_LABELS:raise HTTPException(400,'Invalid user role')
 if len(password)<8:raise HTTPException(400,'Password must contain at least 8 characters.')
 with connection() as db:
  try:cur=db.execute('INSERT INTO app_users(username,display_name,role,password_hash,active) VALUES(?,?,?,?,1)',(username,display,role,hash_password(password)))
  except sqlite3.IntegrityError:raise HTTPException(409,'This username already exists.')
  return {'success':True,'user':dict(db.execute('SELECT id,username,display_name,role,active,created_at FROM app_users WHERE id=?',(cur.lastrowid,)).fetchone())}

@app.put('/api/users/{user_id}')
async def update_user(user_id:int,request:Request):
 require_roles(request,'super_admin');body=await request.json();updates={}
 if CLOUD_ENABLED:
  u=cloud_or_503(lambda:cloud.one('attendpro_app_users',{'id':'eq.'+str(user_id)}))
  if not u:raise HTTPException(404,'User not found')
  for field in ('display_name','role','active'):
   if field in body:updates[field]=body[field]
  if updates.get('role') and updates['role'] not in ROLE_LABELS:raise HTTPException(400,'Invalid role')
  if 'display_name' in updates and not str(updates['display_name']).strip():raise HTTPException(400,'Display name required')
  if u['role']=='super_admin' and (updates.get('role') not in (None,'super_admin') or updates.get('active') is False):
   active_admins=cloud_or_503(lambda:cloud.rows('attendpro_app_users',{'role':'eq.super_admin','active':'eq.true'}))
   if len(active_admins)<=1:raise HTTPException(400,'At least one active Super Admin required')
  if body.get('password'):
   if len(str(body['password']))<8:raise HTTPException(400,'Password must be 8+ chars')
   cloud_or_503(lambda:cloud.admin_update(u['auth_id'],{'password':str(body['password'])}))
  if updates:
   updates['updated_at']=datetime.now(ZoneInfo('UTC')).isoformat()
   cloud_or_503(lambda:cloud.patch('attendpro_app_users',{'id':'eq.'+str(user_id)},updates))
  return {'success':True,'user':cloud_or_503(lambda:cloud.one('attendpro_app_users',{'id':'eq.'+str(user_id)}))}
 with connection() as db:
  row=db.execute('SELECT * FROM app_users WHERE id=?',(user_id,)).fetchone()
  if not row:raise HTTPException(404,'User not found')
  for key in ('display_name','role'):
   if key in body:
    value=str(body[key] or '').strip()
    if key=='display_name' and not value:raise HTTPException(400,'Display name required')
    if key=='role' and value not in ROLE_LABELS:raise HTTPException(400,'Invalid user role')
    updates[key]=value
  if 'active' in body:updates['active']=1 if body['active'] else 0
  if body.get('password'):
   if len(str(body['password']))<8:raise HTTPException(400,'Password must contain at least 8 characters.')
   updates['password_hash']=hash_password(str(body['password']))
  if row['role']=='super_admin' and (updates.get('role') not in (None,'super_admin') or updates.get('active')==0):
   remaining=db.execute("SELECT COUNT(*) FROM app_users WHERE role='super_admin' AND active=1 AND id!=?",(user_id,)).fetchone()[0]
   if remaining==0:raise HTTPException(400,'At least one active Super Admin is required.')
  if updates:db.execute('UPDATE app_users SET '+','.join(f'{k}=?' for k in updates)+',updated_at=CURRENT_TIMESTAMP WHERE id=?',list(updates.values())+[user_id])
  return {'success':True,'user':dict(db.execute('SELECT id,username,display_name,role,active,created_at FROM app_users WHERE id=?',(user_id,)).fetchone())}

@app.delete('/api/users/{user_id}')
def delete_user(user_id:int,request:Request):
 current=require_roles(request,'super_admin')
 if CLOUD_ENABLED:
  u=cloud_or_503(lambda:cloud.one('attendpro_app_users',{'id':'eq.'+str(user_id)}))
  if not u:raise HTTPException(404,'User not found')
  if str(current['auth_id'])==str(u['auth_id']):raise HTTPException(400,'Cannot delete your own account')
  if u['role']=='super_admin':
   admins=cloud_or_503(lambda:cloud.rows('attendpro_app_users',{'role':'eq.super_admin','active':'eq.true'}))
   if len(admins)<=1:raise HTTPException(400,'At least one active Super Admin required')
  cloud_or_503(lambda:cloud.admin_delete(u['auth_id']))
  return {'success':True}
 if current['id']==user_id:raise HTTPException(400,'Cannot delete current account')
 with connection() as db:
  row=db.execute('SELECT role FROM app_users WHERE id=?',(user_id,)).fetchone()
  if not row:raise HTTPException(404,'User not found')
  if row['role']=='super_admin' and db.execute("SELECT COUNT(*) FROM app_users WHERE role='super_admin' AND active=1 AND id!=?",(user_id,)).fetchone()[0]==0:
   raise HTTPException(400,'At least one active Super Admin is required.')
  db.execute('DELETE FROM app_users WHERE id=?',(user_id,))
 return {'success':True}

def run_access_sync(force=False,device_id=None):
    if not SYNC_LOCK.acquire(blocking=False):return {'success':False,'message':'Another database sync is already running'}
    try:
        with connection() as db:
            device_id=int(device_id or active_device_id(db) or 0)
            row=db.execute('SELECT * FROM devices WHERE id=?',(device_id,)).fetchone()
            if not row:return {'success':False,'message':'Device not found'}
            path=row['mdb_path'];office=setting(db,'office_start','09:00');grace=int(setting(db,'grace_minutes','15'))
            db.execute('UPDATE devices SET last_attempt=? WHERE id=?',(stamp(),device_id))
        try:
            with WRITE_LOCK:
                with connection() as db:
                    result=sync_access(db,path,office,grace,force=force,source_tag=f'mdb:{device_id}',signature_key=f'device_{device_id}_access_signature')
                    stats={'last_sync':stamp(),'last_error':None,'status':'online',
                           'last_fetched':int(result.get('scanned_punches',row['last_fetched'] or 0)),
                           'last_inserted':int(result.get('new_punches',row['last_inserted'] or 0))}
                    db.execute('UPDATE devices SET last_sync=?,last_error=NULL,status=?,last_fetched=?,last_inserted=? WHERE id=?',
                        (stats['last_sync'],stats['status'],stats['last_fetched'],stats['last_inserted'],device_id))
                    if active_device_id(db)==device_id:
                        aliases={'access_last_sync':stats['last_sync'],'access_last_error':'','access_status':'online',
                          'access_last_fetched':str(stats['last_fetched']),'access_last_inserted':str(stats['last_inserted'])}
                        for k,v in aliases.items():db.execute('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)',(k,v))
            result['device_id']=device_id
            if CLOUD_ENABLED and result.get('changed'):
                with connection() as db:
                    capture_original_from_daily(db)
                    mark_pending_sync(db)
                try:flush_pending_source_upload();result['cloud_synced']=True
                except CloudError as e:
                    result['cloud_synced']=False
                    result['cloud_warning']=str(e)[:250]
            if result.get('success'):
                auto_rule=apply_auto_biometric_exceptions(today_iso())
                result['automatic_biometric_rule']=auto_rule
            cloud_confirmed=(not CLOUD_ENABLED) or bool(result.get('cloud_synced')) or not result.get('changed')
            if redis_cache.enabled and result.get('success') and result.get('changed') and cloud_confirmed:
                redis_cache.invalidate_api_cache()
                cache_result=refresh_redis_snapshot()
                result['redis_cache_refreshed']=bool(cache_result.get('success'))
            elif result.get('changed') and CLOUD_ENABLED and not cloud_confirmed:
                result['redis_cache_refreshed']=False
                result['redis_cache_deferred']='Waiting for Supabase to confirm source upload.'
            return result
        except Exception as exc:
            msg=f'{type(exc).__name__}: {exc}'[:400]
            with connection() as db:
                db.execute("UPDATE devices SET status='error',last_error=? WHERE id=?",(msg,device_id))
                if active_device_id(db)==device_id:
                    db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES ('access_status','error')")
                    db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES ('access_last_error',?)",(msg,))
            return {'success':False,'message':msg,'device_id':device_id}

    finally:SYNC_LOCK.release()


def save_scheduler_state(**values):
    with connection() as db:
        for key,value in values.items():
            if not key.startswith('scheduler_'):
                key='scheduler_'+key
            db.execute('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)',
                       (key, json.dumps(value,ensure_ascii=False,default=str) if isinstance(value,(dict,list)) else (str(value) if value is not None else '')))


def append_monitor_log(action, status, records=None, details='', trigger=''):
    """Keep a small local operational history for the Redis/Scheduler monitor.

    This log is diagnostic metadata only. It never stores credentials and never
    writes to the original biometric MDB or to attendance source rows.
    """
    item = {
        'time': stamp(),
        'action': str(action)[:140],
        'status': str(status)[:40],
        'records': records,
        'details': str(details or '')[:500],
        'trigger': str(trigger or '')[:40],
    }
    try:
        with WRITE_LOCK:
            with connection() as db:
                row = db.execute("SELECT value FROM settings WHERE key='monitor_activity_log'").fetchone()
                try:
                    history = json.loads(row['value']) if row and row['value'] else []
                except (TypeError, ValueError):
                    history = []
                if not isinstance(history, list):
                    history = []
                history.insert(0, item)
                db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES ('monitor_activity_log',?)",
                           (json.dumps(history[:100], ensure_ascii=False, default=str),))
    except Exception as exc:
        print('AttendPro monitor log warning:', str(exc)[:180])


def run_hourly_sync_cycle(force=False, trigger='scheduler'):
    '''Read enabled MDB devices, apply the safe discrepancy rule, then refresh Redis.

    The interval has a hard one-hour minimum. The original MDB is opened only by
    mdbtools read commands; all corrections are cloud/local overlays, never MDB writes.
    '''
    if not HOURLY_SCHEDULER_ENABLED:
        return {'success':False,'message':'Hourly scheduler is disabled in environment settings.'}
    if not HOURLY_JOB_LOCK.acquire(blocking=False):
        return {'success':False,'skipped':True,'message':'An hourly sync cycle is already running.'}
    token=secrets.token_urlsafe(24)
    distributed_lock=redis_cache.acquire_lock(SCHEDULER_LOCK_KEY,token,
        scheduler_lock_ttl_seconds()) if redis_cache.enabled else None
    if distributed_lock is False:
        HOURLY_JOB_LOCK.release()
        return {'success':False,'skipped':True,'message':'Another AttendPro worker owns the Redis scheduler lock.'}
    started=stamp()
    save_scheduler_state(last_started=started,last_error='',last_trigger=trigger)
    append_monitor_log('Scheduler started', 'Running', details='Hourly MDB sync cycle started.', trigger=trigger)
    device_results=[];warnings=[]
    try:
        if CLOUD_ENABLED:
            try:
                refresh_cloud_projection(force=True)
            except Exception as exc:
                warnings.append('Initial Supabase pull: '+str(exc)[:200])
        with connection() as db:
            devices=rows_as_dict(db.execute('''SELECT id,name,mdb_path,auto_sync,sync_interval,last_sync
                FROM devices WHERE mdb_path!='' ORDER BY id''').fetchall())
        checked=0
        for dev in devices:
            if not force and not bool(dev.get('auto_sync')):
                continue
            if not force and dev.get('last_sync'):
                try:
                    elapsed=(local_now()-datetime.fromisoformat(dev['last_sync'])).total_seconds()
                except (ValueError,TypeError):
                    elapsed=999999
                minimum=scheduler_interval_seconds()
                if elapsed < minimum:
                    device_results.append({'device_id':dev['id'],'name':dev['name'],'skipped':'minimum hourly interval not reached'})
                    continue
            checked+=1
            result=run_access_sync(False,int(dev['id']))
            device_result={'device_id':dev['id'],'name':dev['name'],
                           'success':bool(result.get('success')),
                           'changed':bool(result.get('changed')),
                           'new_punches':int(result.get('new_punches') or 0),
                           'cloud_synced':result.get('cloud_synced', (not CLOUD_ENABLED or not result.get('changed'))),
                           'message':result.get('message') or result.get('cloud_warning') or ''}
            device_results.append(device_result)
            append_monitor_log(f"MDB read — {dev['name']}", 'Success' if result.get('success') else 'Failed',
                               records=int(result.get('new_punches') or 0),
                               details=result.get('message') or ('New punches: '+str(result.get('new_punches') or 0)),
                               trigger=trigger)
            if CLOUD_ENABLED and result.get('changed'):
                append_monitor_log(f"Supabase source sync — {dev['name']}",
                                   'Success' if result.get('cloud_synced') else 'Pending / Failed',
                                   records=int(result.get('new_punches') or 0),
                                   details=result.get('cloud_warning') or 'Source attendance changes are handled by the cloud projection.',
                                   trigger=trigger)
            if not result.get('success'):
                warnings.append(f"{dev['name']}: {result.get('message','MDB sync failed')}")
            if CLOUD_ENABLED and result.get('changed') and result.get('cloud_synced') is False:
                warnings.append(f"{dev['name']}: source upload to Supabase is pending: {result.get('cloud_warning','upload failed')}")

        auto_rule=apply_auto_biometric_exceptions(today_iso())
        if auto_rule.get('warnings'):
            warnings.extend(x.get('error','Automatic biometric rule warning') for x in auto_rule['warnings'])
        cloud_ready=True
        if CLOUD_ENABLED:
            try:
                refresh_cloud_projection(force=True)
                append_monitor_log('Supabase projection refresh', 'Success', details='Cloud projection refreshed before Redis snapshot.', trigger=trigger)
            except Exception as exc:
                cloud_ready=False
                warnings.append('Supabase refresh: '+str(exc)[:200])
                append_monitor_log('Supabase projection refresh', 'Failed', details=str(exc)[:400], trigger=trigger)
            if cloud_source_upload_pending():
                cloud_ready=False
                warnings.append('Supabase source upload is still pending; Redis refresh deferred.')
        if redis_cache.enabled and cloud_ready:
            cache_result=refresh_redis_snapshot()
        else:
            cache_result={'success':False,'reason':'Redis refresh deferred until source data is confirmed in Supabase' if CLOUD_ENABLED and not cloud_ready else 'Redis disabled'}
        append_monitor_log('Redis snapshot refresh', 'Success' if cache_result.get('success') else 'Skipped / Failed',
                           records=sum((cache_result.get('counts') or {}).values()) if cache_result.get('success') else None,
                           details=cache_result.get('reason') or 'Snapshot rebuilt from the current AttendPro read projection.',
                           trigger=trigger)
        if redis_cache.enabled and cloud_ready and not cache_result.get('success'):
            warnings.append('Redis refresh: '+str(cache_result.get('reason','failed')))
        finished=stamp()
        sync_failed=any(x.get('success') is False for x in device_results if 'success' in x)
        cloud_failed=any(x.get('cloud_synced') is False for x in device_results)
        cache_failed=bool(redis_cache.enabled and cloud_ready and not cache_result.get('success'))
        summary={'success':not (sync_failed or cloud_failed or not cloud_ready or cache_failed),
                 'trigger':trigger,'started_at':started,'finished_at':finished,
                 'interval_seconds':scheduler_interval_seconds(),'devices_checked':checked,
                 'device_results':device_results,'automatic_biometric_rule':auto_rule,
                 'redis_cache_refreshed':bool(cache_result.get('success')),
                 'redis_snapshot':cache_result.get('counts') or {},'warnings':warnings,
                 'original_mdb_write_enabled':False}
        save_scheduler_state(last_finished=finished,last_success=summary['success'],
                             last_error='; '.join(warnings)[:900],last_result=summary)
        append_monitor_log('Scheduler completed', 'Success' if summary['success'] else 'Warning / Failed',
                           records=sum((cache_result.get('counts') or {}).values()) if cache_result.get('success') else None,
                           details='; '.join(warnings)[:450] or 'MDB, Supabase and Redis cycle completed.',
                           trigger=trigger)
        return summary
    except Exception as exc:
        finished=stamp()
        error=f'{type(exc).__name__}: {exc}'[:900]
        save_scheduler_state(last_finished=finished,last_success=False,last_error=error,
                             last_result={'success':False,'trigger':trigger,'error':error,
                                          'original_mdb_write_enabled':False})
        append_monitor_log('Scheduler failed', 'Failed', details=error, trigger=trigger)
        return {'success':False,'message':error}
    finally:
        if distributed_lock is True:
            redis_cache.release_lock(SCHEDULER_LOCK_KEY,token)
        HOURLY_JOB_LOCK.release()


async def hourly_scheduler_loop():
    interval=scheduler_interval_seconds()
    while True:
        with connection() as db:
            last=db.execute("SELECT value FROM settings WHERE key='scheduler_last_finished'").fetchone()
        delay=interval
        if last and last[0]:
            try:
                elapsed=(local_now()-datetime.fromisoformat(last[0])).total_seconds()
                delay=max(0,interval-elapsed)
            except (ValueError,TypeError):
                delay=interval
        next_run=local_now()+timedelta(seconds=delay)
        save_scheduler_state(next_run=next_run.isoformat(timespec='seconds'))
        if delay:
            await asyncio.sleep(delay)
        try:
            await asyncio.to_thread(run_hourly_sync_cycle,False,'scheduler')
        except Exception as exc:
            print('Hourly scheduler warning:',str(exc)[:250])

@app.post('/api/database/test')
async def test_database(request:Request):
    require_roles(request,'super_admin')
    with connection() as db:ident=active_device_id(db)
    return await test_device(ident)

@app.post('/api/database/sync')
async def sync_database(request:Request,force:bool=True):
    require_roles(request,'super_admin')
    with connection() as db:ident=active_device_id(db)
    return await asyncio.to_thread(run_access_sync,force,ident)

@app.get('/api/database/status')
def database_status():
    with connection() as db:
        ident=active_device_id(db)
        return {'database':device_status(db,ident),'path':setting(db,'access_path'),
            'poll_interval_seconds':int(setting(db,'access_interval','90')),'devices':all_devices(db)}

if __name__=='__main__':
 import uvicorn
 uvicorn.run('app:app',host='127.0.0.1',port=8000,reload=False)
