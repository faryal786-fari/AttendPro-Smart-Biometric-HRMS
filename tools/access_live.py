"""Read-only ZKTeco Access (att2000.mdb) bridge.

MDB remains the client software's database. The dashboard maintains its own SQLite
read model. Requires the mdbtools command line utilities on Ubuntu.
"""
from __future__ import annotations
import csv
import os
import shutil
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from .importers import as_id, key, safe_datetime

EXPECTED_TABLES = {'USERINFO','CHECKINOUT','DEPARTMENTS'}

class SourceError(RuntimeError):
    pass

def verify_source(mdb_path):
    path=Path(os.path.expanduser(str(mdb_path or '')))
    if not mdb_path:
        raise SourceError('Pehle live att2000.mdb ka full path set karein.')
    if path.suffix.lower() != '.mdb':
        raise SourceError('File path .mdb format ka hona chahiye.')
    if not path.is_file():
        raise SourceError(f'Database file nahi mili: {path}')
    if not os.access(path,os.R_OK):
        raise SourceError('Database file par read permission nahi hai.')
    if not shutil.which('mdb-tables') or not shutil.which('mdb-export'):
        raise SourceError('mdbtools missing. Ubuntu par: sudo apt install mdbtools')
    result=subprocess.run(['mdb-tables','-1',str(path)],capture_output=True,text=True,timeout=40)
    if result.returncode:
        raise SourceError('MDB open nahi ho rahi: '+result.stderr.strip()[:220])
    present={x.strip().upper() for x in result.stdout.splitlines() if x.strip()}
    missing=EXPECTED_TABLES-present
    if missing:
        raise SourceError('Required tables missing: '+', '.join(sorted(missing)))
    st=path.stat()
    return {'ok':True,'path':str(path),'size_bytes':st.st_size,'modified_at':datetime.fromtimestamp(st.st_mtime).isoformat(timespec='seconds'),'tables':sorted(present & EXPECTED_TABLES)}

def _stream_rows(path,table):
    """Subprocess reads data sequentially, without loading the whole MDB in RAM."""
    proc=subprocess.Popen(['mdb-export','-D','%Y-%m-%d %H:%M:%S',str(path),table],
            stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8',errors='replace')
    # Keep stderr small and avoid background write to original MDB.
    try:
        for row in csv.DictReader(proc.stdout):
            yield {key(k):v for k,v in row.items() if k is not None}
        proc.stdout.close()
        code=proc.wait(timeout=35)
        error=proc.stderr.read(400) if proc.stderr else ''
        if code:
            raise SourceError(f'Cannot read {table}: {error[:250] or "mdb-export failed"}')
    finally:
        if proc.poll() is None:
            proc.kill();proc.wait()
        if proc.stdout:proc.stdout.close()
        if proc.stderr:proc.stderr.close()

def sync_access(db, path, office_start='09:00', grace_minutes=15, force=False, stream_rows=None,
                source_tag='mdb', signature_key='access_signature'):
    """Atomic import. Returns counts. Never modifies or opens MDB for writing.

    stream_rows can be injected in offline unit tests; production always uses mdbtools.
    """
    reader=stream_rows or _stream_rows
    source=Path(path)
    if stream_rows is None:verify_source(path)
    st=source.stat()
    signature=f'{st.st_size}:{st.st_mtime_ns}'
    previous=db.execute("SELECT value FROM settings WHERE key=?",(signature_key,)).fetchone()
    previous=previous[0] if previous else ''
    if not force and previous==signature:
        return {'success':True,'changed':False,'employees':0,'new_punches':0,'unmatched':0,'updated_days':0,'message':'Database file unchanged; no new records.'}

    departments={}
    for row in reader(source,'DEPARTMENTS'):
        departments[as_id(row.get('deptid'))]=str(row.get('deptname') or 'Unassigned').strip()

    source_lookup={};people=0;unmatched=0;new=0;scanned=0;updated=set();collisions=0
    for row in reader(source,'USERINFO'):
        user_id=as_id(row.get('userid'))
        badge=as_id(row.get('badgenumber'))
        if not user_id:
            continue
        name=str(row.get('name') or '').strip() or f'User {user_id}'
        dep=departments.get(as_id(row.get('defaultdeptid')),'Unassigned')
        employee_key=badge or f'MDB-USERID-{user_id}'
        # Never overwrite an employee record based on USERID alone: old Excel Emp No.
        # is NOT guaranteed to be USERINFO.USERID. Match by badge where possible.
        existing=db.execute('SELECT id,source_userid,name FROM employees WHERE device_user_id=?',(employee_key,)).fetchone()
        if existing:
            eid=existing['id']
            owner=db.execute('SELECT id FROM employees WHERE source_userid=? AND id!=?',(user_id,eid)).fetchone()
            if owner:collisions+=1
            else:
                db.execute("UPDATE employees SET source_userid=?,department=CASE WHEN department='Unassigned' THEN ? ELSE department END,updated_at=CURRENT_TIMESTAMP WHERE id=?",(user_id,dep,eid))
        else:
            # Prior legacy Excel source IDs may overlap the actual Access USERID.
            owner=db.execute('SELECT id FROM employees WHERE source_userid=?',(user_id,)).fetchone()
            stored_id=user_id if not owner else None
            if owner:collisions+=1
            cur=db.execute('INSERT INTO employees(device_user_id,source_userid,badge_number,name,department) VALUES (?,?,?,?,?)',
                (employee_key,stored_id,badge or employee_key,name,dep))
            eid=cur.lastrowid
        source_lookup[user_id]=(eid,employee_key)
        people+=1

    for row in reader(source,'CHECKINOUT'):
        user_id=as_id(row.get('userid'))
        parsed=safe_datetime(row.get('checktime'))
        if not user_id or not parsed:continue
        scanned+=1
        ty=str(row.get('checktype') or '').strip().upper()
        kind={'I':'IN','O':'OUT','0':'IN','1':'OUT'}.get(ty,'CHECK')
        ref=source_lookup.get(user_id)
        if ref:eid,badge=ref
        else:eid,badge=None,'MDB-USERID-'+user_id
        dt=parsed.isoformat(timespec='seconds')
        result=db.execute('''INSERT OR IGNORE INTO punches(employee_id,device_user_id,happened_at,kind,source,raw_status)
            VALUES(?,?,?,?,?,?)''',(eid,badge,dt,kind,source_tag,ty))
        if result.rowcount:
            new+=1
            if eid:updated.add((eid,parsed.date().isoformat()))
            else:unmatched+=1

    due_start=datetime.strptime(office_start,'%H:%M').time()
    for eid,day in updated:
        # Preserve previously verified detailed Excel report summaries on historical
        # days, but still store all MDB raw punches independently.
        prior=db.execute('SELECT source FROM daily WHERE employee_id=? AND work_date=?',(eid,day)).fetchone()
        if prior and (prior[0]=='local_edit' or (prior[0]=='excel_detailed' and day<datetime.now().date().isoformat())):continue
        # Aggregate punches from all configured MDB devices for a shared employee/day.
        records=db.execute("SELECT happened_at,kind FROM punches WHERE employee_id=? AND (source='mdb' OR source LIKE 'mdb:%') AND substr(happened_at,1,10)=? ORDER BY happened_at",(eid,day)).fetchall()
        if not records:continue
        ins=[r[0] for r in records if r[1]=='IN']
        outs=[r[0] for r in records if r[1]=='OUT']
        first=ins[0] if ins else (records[0][0] if not outs else None)
        # An OUT-only punch proves presence, but not a valid IN timestamp.
        last=outs[-1] if outs else None
        start_dt=datetime.fromisoformat(first) if first else None
        end_dt=datetime.fromisoformat(last) if last else None
        work=int((end_dt-start_dt).total_seconds()//60) if start_dt and end_dt and end_dt>start_dt else None
        due=datetime.combine(datetime.fromisoformat(day).date(),due_start)+timedelta(minutes=int(grace_minutes))
        late=int((start_dt-due).total_seconds()//60) if start_dt and start_dt>due else 0
        status='late' if late>0 else 'present'
        db.execute('''INSERT INTO daily(employee_id,work_date,status,clock_in,clock_out,late_minutes,work_minutes,shift,source)
           VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(employee_id,work_date) DO UPDATE SET
           status=excluded.status,clock_in=excluded.clock_in,clock_out=excluded.clock_out,
           late_minutes=excluded.late_minutes,work_minutes=excluded.work_minutes,
           source='mdb',updated_at=CURRENT_TIMESTAMP''',
           (eid,day,status,first[11:16] if first else None,last[11:16] if last else None,late,work,office_start,'mdb'))

    # If the source was being written while importing, report it and try again on
    # next poll rather than claiming all records were captured.
    st_after=source.stat()
    stable=(st_after.st_size==st.st_size and st_after.st_mtime_ns==st.st_mtime_ns)
    if stable:
        db.execute('INSERT OR REPLACE INTO settings(key,value) VALUES (?,?)',(signature_key,signature))
    db.execute('INSERT INTO imports(filename,source,employee_rows,attendance_rows,skipped_rows,details) VALUES (?,?,?,?,?,?)',
        (source.name,'mdb_live',people,new,unmatched,f'Scanned {scanned} punches; stable={stable}; id_collisions={collisions}'))
    return {'success':True,'changed':True,'employees':people,'scanned_punches':scanned,'new_punches':new,
            'unmatched':unmatched,'id_collisions':collisions,'updated_days':len(updated),
            'stable_snapshot':stable,
            'message':f'{new} naye punches read hue. {people} employees dekhe. '+('File sync ke waqt update hui; agla poll dobara check karega.' if not stable else 'Sync complete.')}
