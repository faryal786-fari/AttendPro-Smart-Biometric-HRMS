"""Cloud-primary attendance read projection. MDB remains untouched.

Postgres original punch/daily data + cloud corrections are authoritative. The
bundled SQLite is an offline reporting projection, NOT the remote source of truth.
"""
from __future__ import annotations
from datetime import datetime,timezone
import hashlib, json, threading, time
from cloud_service import cloud, CLOUD_ENABLED, CloudError

PULL_LOCK=threading.Lock()
PULL_LAST=0.0
PULL_ERROR=''
PUSH_LAST=''
PUSH_ERROR=''

SRC_COLUMNS=('employee_id','work_date','status','clock_in','clock_out','late_minutes','early_minutes','work_minutes','shift','source','raw_absent')
EMP_COLUMNS=('id','device_user_id','source_userid','badge_number','name','department','designation','shift','phone','email','biometric_enrollment','active')

def prepare_raw_tables(db):
    db.executescript('''
    CREATE TABLE IF NOT EXISTS raw_daily(
      employee_id INTEGER NOT NULL,work_date TEXT NOT NULL,status TEXT NOT NULL,
      clock_in TEXT,clock_out TEXT,late_minutes INTEGER,early_minutes INTEGER,work_minutes INTEGER,
      shift TEXT,source TEXT NOT NULL,raw_absent TEXT,
      PRIMARY KEY(employee_id,work_date));
    CREATE TABLE IF NOT EXISTS cloud_adjustment_cache(
      employee_id INTEGER NOT NULL, work_date TEXT NOT NULL,version INTEGER NOT NULL,
      after_json TEXT NOT NULL, PRIMARY KEY(employee_id,work_date));
    CREATE TABLE IF NOT EXISTS cloud_replication_state(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cloud_upload_ledger(kind TEXT NOT NULL,record_key TEXT NOT NULL,checksum TEXT NOT NULL,PRIMARY KEY(kind,record_key));
    ''')
    # On first run, snapshot the untouched imported report; preserve on later runs.
    db.execute('''INSERT OR IGNORE INTO raw_daily(employee_id,work_date,status,clock_in,clock_out,
      late_minutes,early_minutes,work_minutes,shift,source,raw_absent)
      SELECT employee_id,work_date,status,clock_in,clock_out,late_minutes,early_minutes,
      work_minutes,shift,source,raw_absent FROM daily WHERE source NOT IN ('local_edit','cloud_adjustment')''')

def capture_original_from_daily(db):
    """Called only after a trusted XLS/MDB source import (not after manual edits)."""
    prepare_raw_tables(db)
    db.execute('''INSERT INTO raw_daily(employee_id,work_date,status,clock_in,clock_out,
      late_minutes,early_minutes,work_minutes,shift,source,raw_absent)
      SELECT employee_id,work_date,status,clock_in,clock_out,late_minutes,early_minutes,
      work_minutes,shift,source,raw_absent FROM daily WHERE source NOT IN ('local_edit','cloud_adjustment')
      ON CONFLICT(employee_id,work_date) DO UPDATE SET
      status=excluded.status,clock_in=excluded.clock_in,clock_out=excluded.clock_out,
      late_minutes=excluded.late_minutes,early_minutes=excluded.early_minutes,
      work_minutes=excluded.work_minutes,shift=excluded.shift,source=excluded.source,
      raw_absent=excluded.raw_absent''')

def export_source_rows(db):
    employees=[dict(row) for row in db.execute('SELECT * FROM employees ORDER BY id')]
    employee_rows=[]
    for e in employees:
        record={k:e.get(k) for k in EMP_COLUMNS}
        record['active']=bool(record['active'])
        employee_rows.append(record)
    daily=[{k:row[k] for k in SRC_COLUMNS} for row in db.execute('SELECT * FROM raw_daily ORDER BY work_date,employee_id')]
    punch_rows=[]
    for p in db.execute('SELECT * FROM punches ORDER BY id'):
        key='|'.join(str(p[f] or '') for f in ('device_user_id','happened_at','kind','source'))
        record={k:p[k] for k in ('employee_id','device_user_id','happened_at','kind','source','raw_status')}
        record['event_key']=hashlib.sha256(key.encode()).hexdigest()
        punch_rows.append(record)
    return {'employees':employee_rows,'daily':daily,'punches':punch_rows}

def push_sources(db):
    """Incremental, retryable upload; unchanged source events are not sent twice.

    Ledger records are committed with the local transaction. If the process fails
    after a remote insert but before ledger commit, retry is still idempotent.
    """
    global PUSH_LAST,PUSH_ERROR
    prepare_raw_tables(db)
    data=export_source_rows(db)
    def changed(kind,rows,key_fn):
        pending=[];checks=[]
        for row in rows:
            key=key_fn(row)
            checksum=hashlib.sha256(json.dumps(row,sort_keys=True,default=str).encode()).hexdigest()
            old=db.execute('SELECT checksum FROM cloud_upload_ledger WHERE kind=? AND record_key=?',(kind,key)).fetchone()
            if not old or old[0]!=checksum:
                pending.append(row);checks.append((kind,key,checksum))
        return pending,checks
    try:
        operations=[
          ('employees','attendpro_employees','id',lambda x:str(x['id'])),
          ('daily','attendpro_source_daily','employee_id,work_date',lambda x:f"{x['employee_id']}|{x['work_date']}"),
          ('punches','attendpro_raw_punches','event_key',lambda x:x['event_key'])]
        totals={}
        for kind,table,conflict,key_fn in operations:
            pending,checks=changed(kind,data[kind],key_fn)
            if pending:
                if kind=='punches':
                    for n in range(0,len(pending),100):
                        cloud.rest('POST',table,params={'on_conflict':'event_key'},payload=pending[n:n+100],
                              headers={'Prefer':'resolution=ignore-duplicates,return=minimal'})
                else:cloud.upsert(table,pending,conflict)
                db.executemany('INSERT OR REPLACE INTO cloud_upload_ledger(kind,record_key,checksum) VALUES (?,?,?)',checks)
            totals[kind]=len(pending)
        PUSH_LAST=datetime.now(timezone.utc).isoformat();PUSH_ERROR=''
        db.execute('INSERT OR REPLACE INTO cloud_replication_state(key,value) VALUES (?,?)',('last_push',PUSH_LAST))
        return totals
    except CloudError as e:
        PUSH_ERROR=str(e)
        db.execute('INSERT OR REPLACE INTO cloud_replication_state(key,value) VALUES (?,?)',('last_push_error',PUSH_ERROR[:500]))
        raise

def _put_source_sqlite(db,row):
    vals=tuple(row.get(k) for k in SRC_COLUMNS)
    db.execute('''INSERT INTO raw_daily(employee_id,work_date,status,clock_in,clock_out,
       late_minutes,early_minutes,work_minutes,shift,source,raw_absent)
       VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(employee_id,work_date) DO UPDATE SET
       status=excluded.status,clock_in=excluded.clock_in,clock_out=excluded.clock_out,
       late_minutes=excluded.late_minutes,early_minutes=excluded.early_minutes,
       work_minutes=excluded.work_minutes,shift=excluded.shift,source=excluded.source,
       raw_absent=excluded.raw_absent''',vals)
    db.execute('''INSERT INTO daily(employee_id,work_date,status,clock_in,clock_out,
       late_minutes,early_minutes,work_minutes,shift,source,raw_absent)
       VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(employee_id,work_date) DO UPDATE SET
       status=excluded.status,clock_in=excluded.clock_in,clock_out=excluded.clock_out,
       late_minutes=excluded.late_minutes,early_minutes=excluded.early_minutes,
       work_minutes=excluded.work_minutes,shift=excluded.shift,source=excluded.source,
       raw_absent=excluded.raw_absent''',vals)

def apply_override_local(db,employee_id,work_date,after,version=1):
    fields=('status','clock_in','clock_out','late_minutes','early_minutes','work_minutes','shift')
    source=db.execute('SELECT * FROM raw_daily WHERE employee_id=? AND work_date=?',(employee_id,work_date)).fetchone()
    if source:
        src=dict(source)
    else:
        src={'employee_id':employee_id,'work_date':work_date,'status':'not_checked_in',
             'clock_in':None,'clock_out':None,'late_minutes':0,'early_minutes':0,
             'work_minutes':None,'shift':None,'source':'cloud_adjustment','raw_absent':None}
    for key in fields:
        if key in after:src[key]=after[key]
    src['source']='cloud_adjustment'
    db.execute('''INSERT INTO daily(employee_id,work_date,status,clock_in,clock_out,
       late_minutes,early_minutes,work_minutes,shift,source,raw_absent)
       VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(employee_id,work_date) DO UPDATE SET
       status=excluded.status,clock_in=excluded.clock_in,clock_out=excluded.clock_out,
       late_minutes=excluded.late_minutes,early_minutes=excluded.early_minutes,
       work_minutes=excluded.work_minutes,shift=excluded.shift,source='cloud_adjustment',
       raw_absent=excluded.raw_absent,updated_at=CURRENT_TIMESTAMP''',tuple(src[k] for k in SRC_COLUMNS))
    db.execute('''INSERT INTO cloud_adjustment_cache(employee_id,work_date,version,after_json)
         VALUES(?,?,?,?) ON CONFLICT(employee_id,work_date) DO UPDATE SET version=excluded.version,
         after_json=excluded.after_json''',(employee_id,work_date,version,json.dumps(after)))

def pull_cloud(db,force=False):
    """Hydrates local read-only UI cache from authoritative Supabase source+overrides.

    Query full tables in pages so multiple application hosts observe the same data.
    Reports remain locally-rendered for compatibility with existing AttendPro UI.
    """
    global PULL_LAST,PULL_ERROR
    if not CLOUD_ENABLED:return {'cloud':False}
    if not force and time.monotonic()-PULL_LAST < 15:return {'skipped':True}
    if not PULL_LOCK.acquire(blocking=False):return {'busy':True}
    try:
        if not force and time.monotonic()-PULL_LAST < 15:return {'skipped':True}
        employees=cloud.rows('attendpro_employees',{'order':'id.asc'})
        # Cloud-only HR profile edits take precedence over imported biometric names.
        try:
            profile_overrides=cloud.rows('attendpro_employee_profile_overrides')
        except CloudError as exc:
            # Keep existing attendance readable before optional migration 003 is applied.
            if '404' in str(exc) and 'attendpro_employee_profile_overrides' in str(exc):
                profile_overrides=[]
            elif 'PGRST205' in str(exc) or 'Could not find the table' in str(exc):
                profile_overrides=[]
            else:raise
        profile_by_id={int(v['employee_id']):v for v in profile_overrides}
        originals=cloud.rows('attendpro_source_daily',{'order':'work_date.asc'})
        overrides=cloud.rows('attendpro_corrections',{'order':'work_date.asc'})
        reviews=cloud.rows('attendpro_discrepancy_reviews')
        for e in employees:
            fields=EMP_COLUMNS;item={k:e.get(k) for k in fields};item['active']=int(bool(item['active']))
            custom=profile_by_id.get(int(e['id']))
            if custom:
                for field in ('name','department','designation','shift','phone','email'):
                    if field in custom and custom[field] is not None:item[field]=custom[field]
            db.execute('''INSERT INTO employees(id,device_user_id,source_userid,badge_number,name,department,
             designation,shift,phone,email,biometric_enrollment,active)
             VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
             device_user_id=excluded.device_user_id,source_userid=excluded.source_userid,
             badge_number=excluded.badge_number,name=excluded.name,department=excluded.department,
             designation=excluded.designation,shift=excluded.shift,phone=excluded.phone,email=excluded.email,
             biometric_enrollment=excluded.biometric_enrollment,active=excluded.active''',tuple(item.get(k) for k in fields))
        for r in originals:_put_source_sqlite(db,r)
        # Overlay always applies LAST. Postgres source remains unmodified.
        for r in overrides:apply_override_local(db,r['employee_id'],str(r['work_date']),r['after_json'],r['version'])
        for r in reviews:
            reviewed_by=(r.get('actor_label') if r.get('actor_type')=='system' and r.get('actor_label') else r.get('reviewed_by'))
            db.execute('''INSERT INTO discrepancy_reviews(employee_id,work_date,issue_type,resolution,note,reviewed_by,reviewed_at)
             VALUES(?,?,?,?,?,?,?) ON CONFLICT(employee_id,work_date,issue_type)
             DO UPDATE SET resolution=excluded.resolution,note=excluded.note,
             reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at''',(
              r['employee_id'],r['work_date'],r['issue_type'],r['resolution'],r.get('note') or '',reviewed_by,r['reviewed_at']))
        PULL_LAST=time.monotonic();PULL_ERROR=''
        return {'employees':len(employees),'source_daily':len(originals),'corrections':len(overrides)}
    except CloudError as e:
        PULL_ERROR=str(e);raise
    finally:PULL_LOCK.release()
