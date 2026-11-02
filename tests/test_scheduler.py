import os,sys,shutil,tempfile
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))

class TestHourlyScheduler:
 def setup_method(self):
  self.temp=tempfile.TemporaryDirectory()
  shutil.copy2(ROOT/'data'/'attendance.sqlite3',Path(self.temp.name)/'attendance.sqlite3')
  os.environ['ATTENDANCE_DATA_DIR']=self.temp.name
  import importlib,app
  self.mod=importlib.reload(app)
  self.client=TestClient(self.mod.app)
  self.client.__enter__()
  self.client.post('/api/auth/login',json={'username':'admin','password':'admin123'})
 def teardown_method(self):
  self.client.__exit__(None,None,None)
  self.temp.cleanup()
  os.environ.pop('ATTENDANCE_DATA_DIR',None)

 def test_scheduler_interval_has_one_hour_minimum(self):
  with patch.dict(os.environ,{'ATTENDPRO_MDB_SCHEDULER_INTERVAL_SECONDS':'30'}):
   assert self.mod.scheduler_interval_seconds()==3600

 def test_hourly_job_scans_enabled_devices_and_refreshes_status(self):
  with self.mod.connection() as db:
   cur=db.execute("INSERT INTO devices(name,model,serial_number,mdb_path,auto_sync,sync_interval,status) VALUES(?,?,?,?,1,90,'tested')",
                   ('Test MDB','ZKTeco uFace 800','TEST-01','/tmp/test-att2000.mdb'))
   device_id=cur.lastrowid
  self.mod.HOURLY_SCHEDULER_ENABLED=True
  self.mod.redis_cache.enabled=False
  with patch.object(self.mod,'run_access_sync',return_value={
      'success':True,'changed':True,'new_punches':2,'message':'2 new punches'}
  ) as sync, patch.object(self.mod,'apply_auto_biometric_exceptions',return_value={'enabled':True,'applied':0,'items':[]}), patch.object(self.mod,'refresh_redis_snapshot',return_value={'success':False,'reason':'Redis disabled'}):
   result=self.mod.run_hourly_sync_cycle(force=False,trigger='test')
  assert result['success'] is True
  assert result['devices_checked']==1
  assert result['interval_seconds']==3600
  assert result['original_mdb_write_enabled'] is False
  sync.assert_called_once_with(False,device_id)
  status=self.client.get('/api/scheduler/status').json()
  assert status['last_finished']
  assert status['last_success']=='True'
  logs=self.client.get('/api/monitor/logs?limit=20').json()['items']
  actions=[item['action'] for item in logs]
  assert 'Scheduler started' in actions
  assert 'MDB read — Test MDB' in actions
  assert 'Redis snapshot refresh' in actions
  assert 'Scheduler completed' in actions
