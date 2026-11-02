"""Offline contract tests; no Supabase account or private key needed."""
import importlib,os,shutil,sys,tempfile
from pathlib import Path
import pytest, httpx
from fastapi.testclient import TestClient
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))


def test_auth_key_header_is_apikey_not_bearer():
 from cloud_service import CloudService,Settings
 seen=[]
 def handler(req):
  seen.append(req)
  return httpx.Response(200,json=[])
 c=CloudService(Settings('https://example.supabase.co','sb_publishable_public','sb_secret_private'),httpx.MockTransport(handler))
 assert c.rows('attendpro_employees')==[]
 assert seen[0].headers['apikey']=='sb_secret_private'
 assert 'authorization' not in seen[0].headers  # NEW API keys aren't JWTs


def test_sql_has_backend_only_rls_and_atomic_correction():
 sql=(ROOT/'supabase'/'001_attendpro_schema.sql').read_text()
 assert 'ENABLE ROW LEVEL SECURITY' in sql
 assert 'REVOKE ALL ON TABLE' in sql
 assert 'REVOKE ALL ON FUNCTION public.attendpro_save_correction' in sql
 assert 'INSERT INTO public.attendpro_correction_audit' in sql
 assert 'SECURITY DEFINER' in sql


class FakeCloud:
 def __init__(self,fail=False):self.fail=fail;self.calls=[]
 def save_adjustment(self,employee_id,day,after,actor,action,reason,expected_version=None):
  self.calls.append((employee_id,day,dict(after),actor,action,reason,expected_version))
  if self.fail:
   from cloud_service import CloudError
   raise CloudError('Simulated outage')
  return {'version':expected_version+1,'after_json':after}


class TestSaveCorrection:
 def setup_method(self):
  self.tmp=tempfile.TemporaryDirectory()
  shutil.copy(ROOT/'data'/'attendance.sqlite3',Path(self.tmp.name)/'attendance.sqlite3')
  os.environ['ATTENDANCE_DATA_DIR']=self.tmp.name
  import app
  self.mod=importlib.reload(app)
  self.mod.init_db()
  self.original_cloud=self.mod.cloud;self.original_flag=self.mod.CLOUD_ENABLED
  self.mod.CLOUD_ENABLED=True
  with self.mod.connection() as db:
   row=db.execute('SELECT * FROM daily WHERE clock_in IS NOT NULL AND work_date=? LIMIT 1',('2026-10-26',)).fetchone()
   self.id=int(row['employee_id']);self.day=row['work_date']
   self.old=dict(row)

 def teardown_method(self):
  self.mod.CLOUD_ENABLED=self.original_flag;self.mod.cloud=self.original_cloud
  self.tmp.cleanup();os.environ.pop('ATTENDANCE_DATA_DIR',None)

 def test_remote_first_and_raw_original_preserved(self):
  self.mod.cloud=FakeCloud()
  result=self.mod.cloud_edit_attendance({'auth_id':'fake-uuid','email':'test@example.com'},
     {'clock_in':'08:30','clock_out':'17:10','shift':'09:00','status':'present','reason':'Approved signed form'},
     self.id,self.day,'update')
  assert result['success'] and len(self.mod.cloud.calls)==1
  with self.mod.connection() as db:
   original=db.execute('SELECT * FROM raw_daily WHERE employee_id=? AND work_date=?',(self.id,self.day)).fetchone()
   changed=db.execute('SELECT * FROM daily WHERE employee_id=? AND work_date=?',(self.id,self.day)).fetchone()
   assert original['clock_out']==self.old['clock_out']
   assert changed['clock_out']=='17:10'
   assert changed['source']=='cloud_adjustment'
   assert db.execute('SELECT COUNT(*) FROM attendance_changes WHERE employee_id=? AND work_date=?',(self.id,self.day)).fetchone()[0]>=1

 def test_cloud_outage_does_not_modify_local_effective_attendance(self):
  self.mod.cloud=FakeCloud(fail=True)
  from fastapi import HTTPException
  with pytest.raises(HTTPException) as err:
   self.mod.cloud_edit_attendance({'auth_id':'test-uuid','email':'test@example.com'},
    {'clock_in':'08:30','clock_out':'17:10','shift':'09:00','status':'present','reason':'Approved correction'},
    self.id,self.day,'update')
  assert err.value.status_code==503
  with self.mod.connection() as db:
   still=db.execute('SELECT * FROM daily WHERE employee_id=? AND work_date=?',(self.id,self.day)).fetchone()
   assert still['clock_out']==self.old['clock_out']
   assert not db.execute('SELECT 1 FROM cloud_adjustment_cache WHERE employee_id=? AND work_date=?',(self.id,self.day)).fetchone()

 def test_reason_required(self):
  self.mod.cloud=FakeCloud()
  from fastapi import HTTPException
  with pytest.raises(HTTPException):
   self.mod.cloud_edit_attendance({'auth_id':'test'},
     {'clock_in':'10:00','clock_out':'17:00','reason':'x'},self.id,self.day,'update')
  assert not self.mod.cloud.calls


def test_supabase_auth_role_gate_on_real_fastapi_routes(monkeypatch):
 """Simulates real Auth token (no network) and verifies server-side RBAC."""
 from fastapi.testclient import TestClient
 import app
 temp=tempfile.TemporaryDirectory()
 try:
  shutil.copy(ROOT/'data'/'attendance.sqlite3',Path(temp.name)/'attendance.sqlite3')
  monkeypatch.setenv('ATTENDANCE_DATA_DIR',temp.name)
  mod=importlib.reload(app)
  mod.init_db()
  class AuthCloud(FakeCloud):
   role='view_only'
   def login(self,email,password):
    assert email=='user@company.com' and password=='valid-password'
    return {'access_token':'valid-token','refresh_token':'valid-refresh','expires_in':3600}
   def identity(self,access_token,force=False):
    if access_token!='valid-token':return None
    return {'id':'uuid','auth_id':'uuid','username':'user@company.com',
      'email':'user@company.com','display_name':'Company User','role':self.role}
  fake=AuthCloud()
  monkeypatch.setattr(mod,'cloud',fake)
  monkeypatch.setattr(mod,'CLOUD_ENABLED',True)
  monkeypatch.setattr(mod,'refresh_cloud_projection',lambda:None)
  with TestClient(mod.app) as client:
   status=client.get('/api/auth/status').json()
   assert status['mode']=='supabase' and not status['authenticated']
   login=client.post('/api/auth/login',json={'username':'user@company.com','password':'valid-password'})
   assert login.status_code==200
   assert 'httponly' in login.headers['set-cookie'].lower()
   emp=client.get('/api/employees',params={'per_page':1}).json()['items'][0]
   edit={'employee_id':emp['id'],'work_date':'2026-10-26','clock_in':'09:00','clock_out':'17:00',
          'status':'present','shift':'09:00','reason':'Approved correction'}
   assert client.put('/api/attendance/edit',json=edit).status_code==403
   fake.role='supervisor'
   resp=client.put('/api/attendance/edit',json=edit)
   assert resp.status_code==200,resp.text
   assert len(fake.calls)==1
   assert client.get('/api/cloud/status').json()['enabled']
 finally:
  importlib.reload(app)
  temp.cleanup()
