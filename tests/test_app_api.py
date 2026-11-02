"""API smoke tests against a temporary copy of the included historical database."""
import os,sys,shutil,tempfile
from pathlib import Path
from fastapi.testclient import TestClient
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))

class TestApi:
 def setup_method(self):
  self.temp=tempfile.TemporaryDirectory()
  shutil.copy2(ROOT/'data'/'attendance.sqlite3',Path(self.temp.name)/'attendance.sqlite3')
  os.environ['ATTENDANCE_DATA_DIR']=self.temp.name
  # Import/reload AFTER setting the DB root, so tests do not edit packaged sample.
  import importlib,app
  self.app=importlib.reload(app)
  self.client=TestClient(self.app.app)
  self.client.__enter__()
  login=self.client.post('/api/auth/login',json={'username':'admin','password':'admin123'})
  assert login.status_code==200
 def teardown_method(self):
  self.client.__exit__(None,None,None)
  self.temp.cleanup()
  os.environ.pop('ATTENDANCE_DATA_DIR',None)
 def test_dashboard_real_import(self):
  r=self.client.get('/api/dashboard?date=2026-10-26')
  assert r.status_code==200
  m=r.json()['metrics']
  assert [m['total'],m['present'],m['absent'],m['late']]==[731,374,357,323]
  assert self.client.get('/api/attendance',params={'date':'2026-10-26','status':'absent'}).json()['total']==357
 def test_source_settings(self):
  r=self.client.put('/api/settings',json={'access_path':'/home/faryal/example/att2000.mdb','access_auto':False,'access_interval':90})
  assert r.status_code==200
  assert r.json()['access_path']=='/home/faryal/example/att2000.mdb'
  r=self.client.post('/api/database/test').json()
  assert not r['success']
  assert self.client.get('/api/database/status').status_code==200

 def test_monitor_activity_logs_endpoint(self):
  r=self.client.get('/api/monitor/logs?limit=10')
  assert r.status_code==200
  assert isinstance(r.json()['items'],list)

 def test_history_endpoint(self):
  r=self.client.get('/api/attendance/history',params={'from':'2026-10-26','to':'2026-10-26'})
  assert r.status_code==200
  assert r.json()['total']==731
 def test_history_endpoint_defaults_to_latest_stored_date(self):
  r=self.client.get('/api/attendance/history')
  assert r.status_code==200
  assert r.json()['from']=='2026-10-26'
  assert r.json()['to']=='2026-10-26'
  assert r.json()['total']==731

 def test_exact_prototype_and_backend_hooks(self):
  page=self.client.get('/').text
  assert 'AttendPro' in page
  assert 'id="themeToggle"' in page
  assert 'Redis Cache &amp; Scheduler Monitor' in page
  assert "/api/cache/status" in page and "/api/monitor/logs?limit=30" in page
  assert 'id="accessPath"' in page
  assert '/api/attendance/history' in page
 def test_homepage_disables_stale_browser_cache(self):
  response=self.client.get('/')
  assert response.status_code==200
  assert 'no-store' in response.headers.get('cache-control','')
  assert response.headers.get('pragma')=='no-cache'

 def test_static_and_theme_elements(self):
  assert self.client.get('/').status_code==200
  assert 'themeToggle' in self.client.get('/').text
  assert 'accessPath' in self.client.get('/').text
  assert self.client.get('/api/health').status_code==200
 def test_unknown_not_confirmed_absent(self):
  r=self.client.get('/api/dashboard?date=2026-10-28').json()['metrics']
  assert r['present']==0 and r['absent']==0 and r['unknown']==731
 def test_multi_device_user_roles_and_report_export(self):
  devices=self.client.get('/api/devices').json()
  assert len(devices['items'])>=1
  created=self.client.post('/api/devices',json={'name':'Side Gate','model':'ZKTeco uFace 800','serial_number':'SG-01','mdb_path':'','sync_interval':90})
  assert created.status_code==200
  assert len(created.json()['devices']['items'])>=2
  user=self.client.post('/api/users',json={'display_name':'Supervisor Test','username':'supervisor1','role':'supervisor','password':'supervisor123'})
  assert user.status_code==200
  xlsx=self.client.post('/api/reports/excel',json={'from':'2026-10-26','to':'2026-10-26','rows':[{'id':'600','name':'Test Person','date':'2026-10-26','timetable':'09:00','cin':'08:45','cout':'16:00','dept':'IT LAB','status':'Present'}]})
  assert xlsx.status_code==200
  assert xlsx.headers['content-type'].startswith('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
 def test_supervisor_can_edit_local_attendance_but_not_devices(self):
  # Find a known employee, then use a second client/session for the supervisor.
  emp=self.client.get('/api/employees',params={'page':1,'per_page':1}).json()['items'][0]
  supervisor=TestClient(self.app.app)
  supervisor.__enter__()
  try:
   login=supervisor.post('/api/auth/login',json={'username':'admin','password':'admin123'})
   assert login.status_code==200
   # Admin can create the supervisor in the shared test database.
   created=self.client.post('/api/users',json={'display_name':'Supervisor','username':'supervisor2','role':'supervisor','password':'supervisor123'})
   assert created.status_code==200
   supervisor.post('/api/auth/logout')
   login=supervisor.post('/api/auth/login',json={'username':'supervisor2','password':'supervisor123'})
   assert login.status_code==200
   denied=supervisor.post('/api/devices',json={'name':'No Access','mdb_path':''})
   assert denied.status_code==403
   edit=supervisor.put('/api/attendance/edit',json={'employee_id':emp['id'],'work_date':'2026-10-26','clock_in':'08:30','clock_out':'16:00','shift':'09:00','status':'present','action':'update'})
   assert edit.status_code==200
   assert 'Original MDB' in edit.json()['message']
  finally:
   supervisor.__exit__(None,None,None)

 def test_admin_can_add_employee_to_local_database_and_view_profile(self):
  created=self.client.post('/api/employees',json={'name':'ZZZ Sample New Staff','badge_number':'MANUAL-902','department':'Accounts','designation':'Assistant','shift':'Morning'})
  assert created.status_code==200,created.text
  e=created.json()['employee']
  assert e['name']=='ZZZ Sample New Staff'
  assert e['device_user_id'].startswith('manual-')
  assert e['department']=='Accounts' and e['designation']=='Assistant'
  detail=self.client.get('/api/employee/'+str(e['id']))
  assert detail.status_code==200 and detail.json()['employee']['name']==e['name']
  assert self.client.post('/api/employees',json={'name':'Another Person','badge_number':'MANUAL-902'}).status_code==409
  assert self.client.get('/api/dashboard?date=2026-10-26').json()['metrics']['total']==732
