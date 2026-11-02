"""Discrepancy / biometric review regression tests using a temporary database."""
import os,sys,shutil,tempfile,sqlite3
from pathlib import Path
from fastapi.testclient import TestClient
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))

class TestDiscrepancies:
 def setup_method(self):
  self.temp=tempfile.TemporaryDirectory()
  shutil.copy2(ROOT/'data'/'attendance.sqlite3',Path(self.temp.name)/'attendance.sqlite3')
  os.environ['ATTENDANCE_DATA_DIR']=self.temp.name
  import importlib,app
  self.mod=importlib.reload(app)
  self.client=TestClient(self.mod.app)
  self.client.__enter__()
  assert self.client.post('/api/auth/login',json={'username':'admin','password':'admin123'}).status_code==200
 def teardown_method(self):
  self.client.__exit__(None,None,None);self.temp.cleanup()
  os.environ.pop('ATTENDANCE_DATA_DIR',None)
 def test_missing_checkouts_from_real_excel_and_history_filter(self):
  r=self.client.get('/api/discrepancies').json()
  assert r['from']=='2026-10-26' and r['to']=='2026-10-26'
  assert r['summary']['missing_check_out']==76
  assert r['summary']['missing_check_in']==7
  assert r['summary']['open']>=83
  filtered=self.client.get('/api/discrepancies',params={'issue':'missing_check_in'}).json()
  assert filtered['total']==7
  assert all(x['issue_type']=='missing_check_in' for x in filtered['items'])
 def test_review_audit_and_preserve_original_punches(self):
  r=self.client.get('/api/discrepancies',params={'issue':'missing_check_out'}).json()['items'][0]
  emp=r['employee_id'];day=r['work_date'];before=r['status']
  wrong=self.client.post('/api/discrepancies/resolve',json={'employee_id':emp,'work_date':day,'issue_type':r['issue_type'],'resolution':'on_leave','note':''})
  assert wrong.status_code==400
  good=self.client.post('/api/discrepancies/resolve',json={'employee_id':emp,'work_date':day,'issue_type':r['issue_type'],'resolution':'reviewed','note':'Awaiting signed checkout record'})
  assert good.status_code==200,good.text
  resolved=self.client.get('/api/discrepancies',params={'issue':'missing_check_out','state':'resolved'}).json()['items']
  assert any(x['employee_id']==emp and x['resolution']=='reviewed' for x in resolved)
  with sqlite3.connect(Path(self.temp.name)/'attendance.sqlite3') as db:
   assert db.execute('SELECT status FROM daily WHERE employee_id=? AND work_date=?',(emp,day)).fetchone()[0]==before
   assert db.execute('SELECT COUNT(*) FROM discrepancy_reviews WHERE employee_id=?',(emp,)).fetchone()[0]==1
 def test_historical_not_configured_record_is_not_retroactively_changed(self):
  r=self.client.get('/api/discrepancies',params={'issue':'missing_check_out'}).json()['items'][0]
  emp=r['employee_id'];day=r['work_date']
  with sqlite3.connect(Path(self.temp.name)/'attendance.sqlite3') as db:
   old=db.execute('SELECT status FROM daily WHERE employee_id=? AND work_date=?',(emp,day)).fetchone()[0]
  upd=self.client.put('/api/discrepancies/biometric-status',json={'employee_id':emp,'status':'not_configured','note':'Checked device enrollment'})
  assert upd.status_code==200
  flagged=self.client.get('/api/discrepancies',params={'issue':'biometric_not_configured'}).json()['items']
  assert any(x['employee_id']==emp for x in flagged)
  with sqlite3.connect(Path(self.temp.name)/'attendance.sqlite3') as db:
   assert db.execute('SELECT status FROM daily WHERE employee_id=? AND work_date=?',(emp,day)).fetchone()[0]==old
   assert db.execute('SELECT COUNT(*) FROM biometric_status_changes WHERE employee_id=?',(emp,)).fetchone()[0]==1

 def test_confirmed_not_configured_mdb_checkin_is_auto_marked_on_leave(self):
  day=self.mod.today_iso()
  with sqlite3.connect(Path(self.temp.name)/'attendance.sqlite3') as db:
   emp=db.execute('SELECT COALESCE(MAX(id),0)+1 FROM employees').fetchone()[0]
   db.execute("INSERT INTO employees(id,device_user_id,source_userid,badge_number,name,department,active,biometric_enrollment) VALUES(?,?,?,?,?,?,1,'not_configured')",
              (emp,f'auto-rule-{emp}',None,f'AUTO-{emp}','Auto Rule Test','Operations'))
   db.execute("INSERT INTO raw_daily(employee_id,work_date,status,clock_in,clock_out,late_minutes,early_minutes,work_minutes,shift,source) VALUES(?,?, 'present','09:00',NULL,0,0,NULL,'09:00','mdb')",
              (emp,day))
   db.execute("INSERT INTO daily(employee_id,work_date,status,clock_in,clock_out,late_minutes,early_minutes,work_minutes,shift,source) VALUES(?,?, 'present','09:00',NULL,0,0,NULL,'09:00','mdb')",
              (emp,day))
   db.execute("INSERT INTO punches(employee_id,device_user_id,happened_at,kind,source,raw_status) VALUES(?,?,?,'IN','mdb:1','I')",
              (emp,f'auto-rule-{emp}',day+' 09:00:00'))
  result=self.mod.apply_auto_biometric_exceptions(day,emp)
  assert result['applied']==1
  with sqlite3.connect(Path(self.temp.name)/'attendance.sqlite3') as db:
   effective=db.execute('SELECT status,source FROM daily WHERE employee_id=? AND work_date=?',(emp,day)).fetchone()
   original=db.execute('SELECT status FROM raw_daily WHERE employee_id=? AND work_date=?',(emp,day)).fetchone()
   reviews=db.execute('SELECT issue_type,resolution,reviewed_by FROM discrepancy_reviews WHERE employee_id=? AND work_date=? ORDER BY issue_type',(emp,day)).fetchall()
  assert effective==('on_leave','auto_rule')
  assert original==('present',)
  assert {r[0] for r in reviews}=={'biometric_not_configured','leave_with_punch'}
  assert all(r[1]=='on_leave' and r[2]=='AttendPro Scheduler' for r in reviews)


 def test_unknown_biometric_enrollment_does_not_auto_mark_leave(self):
  day=self.mod.today_iso()
  with sqlite3.connect(Path(self.temp.name)/'attendance.sqlite3') as db:
   emp=db.execute('SELECT COALESCE(MAX(id),0)+1 FROM employees').fetchone()[0]
   db.execute("INSERT INTO employees(id,device_user_id,name,department,active,biometric_enrollment) VALUES(?,?,?,'Operations',1,'unknown')",
              (emp,f'unknown-rule-{emp}','Unknown Rule Test'))
   for table in ('raw_daily','daily'):
    db.execute(f"INSERT INTO {table}(employee_id,work_date,status,clock_in,source) VALUES(?,?, 'present','09:00','mdb')",(emp,day))
   db.execute("INSERT INTO punches(employee_id,device_user_id,happened_at,kind,source,raw_status) VALUES(?,?,?,'IN','mdb:1','I')",
              (emp,f'unknown-rule-{emp}',day+' 09:00:00'))
  result=self.mod.apply_auto_biometric_exceptions(day,emp)
  assert result['applied']==0
  with sqlite3.connect(Path(self.temp.name)/'attendance.sqlite3') as db:
   assert db.execute('SELECT status FROM daily WHERE employee_id=? AND work_date=?',(emp,day)).fetchone()[0]=='present'

 def test_automatic_rule_never_overwrites_a_human_correction(self):
  day=self.mod.today_iso()
  with sqlite3.connect(Path(self.temp.name)/'attendance.sqlite3') as db:
   emp=db.execute('SELECT COALESCE(MAX(id),0)+1 FROM employees').fetchone()[0]
   db.execute("INSERT INTO employees(id,device_user_id,name,department,active,biometric_enrollment) VALUES(?,?,?,'Operations',1,'not_configured')",
              (emp,f'human-rule-{emp}','Human Correction Test'))
   db.execute("INSERT INTO raw_daily(employee_id,work_date,status,clock_in,source) VALUES(?,?, 'present','09:00','mdb')",(emp,day))
   db.execute("INSERT INTO daily(employee_id,work_date,status,clock_in,source) VALUES(?,?, 'late','09:25','local_edit')",(emp,day))
   db.execute("INSERT INTO punches(employee_id,device_user_id,happened_at,kind,source,raw_status) VALUES(?,?,?,'IN','mdb:1','I')",
              (emp,f'human-rule-{emp}',day+' 09:00:00'))
  result=self.mod.apply_auto_biometric_exceptions(day,emp)
  assert result['applied']==0
  with sqlite3.connect(Path(self.temp.name)/'attendance.sqlite3') as db:
   assert db.execute('SELECT status,source FROM daily WHERE employee_id=? AND work_date=?',(emp,day)).fetchone()==('late','local_edit')

 def test_supervisor_can_resolve_view_only_cannot(self):
  row=self.client.get('/api/discrepancies').json()['items'][0]
  assert self.client.post('/api/users',json={'display_name':'Only','username':'only1','role':'view_only','password':'securepass123'}).status_code==200
  only=TestClient(self.mod.app);only.__enter__()
  try:
   assert only.post('/api/auth/login',json={'username':'only1','password':'securepass123'}).status_code==200
   assert only.get('/api/discrepancies').status_code==200
   assert only.post('/api/discrepancies/resolve',json={'employee_id':row['employee_id'],'work_date':row['work_date'],'issue_type':row['issue_type'],'resolution':'reviewed','note':'Checked'}).status_code==403
   assert only.put('/api/discrepancies/biometric-status',json={'employee_id':row['employee_id'],'status':'configured'}).status_code==403
  finally:only.__exit__(None,None,None)
