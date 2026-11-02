import os
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from tools.access_live import sync_access

class AccessSyncTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'att2000.mdb';self.path.write_bytes(b'Standard Jet DB')
  self.db=sqlite3.connect(':memory:');self.db.row_factory=sqlite3.Row
  self.db.executescript('''
  CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT);
  CREATE TABLE employees(id INTEGER PRIMARY KEY,device_user_id TEXT UNIQUE,source_userid TEXT,badge_number TEXT,name TEXT,department TEXT,active INTEGER DEFAULT 1,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE daily(employee_id INTEGER,work_date TEXT,status TEXT,clock_in TEXT,clock_out TEXT,late_minutes INTEGER,work_minutes INTEGER,shift TEXT,source TEXT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(employee_id,work_date));
  CREATE TABLE punches(id INTEGER PRIMARY KEY,employee_id INTEGER,device_user_id TEXT,happened_at TEXT,kind TEXT,source TEXT,raw_status TEXT,UNIQUE(device_user_id,happened_at,kind,source));
  CREATE TABLE imports(id INTEGER PRIMARY KEY,filename TEXT,source TEXT,employee_rows INTEGER,attendance_rows INTEGER,skipped_rows INTEGER,details TEXT);
  INSERT INTO employees(device_user_id,source_userid,badge_number,name,department) VALUES('101','700','101','Ayesha','Unassigned');
  ''')
 def tearDown(self):self.db.close();self.tmp.cleanup()
 def reader(self,path,table):
  data={
   'DEPARTMENTS':[{'deptid':'2','deptname':'Operations'}],
   'USERINFO':[{'userid':'500','badgenumber':'101','name':'Ayesha','defaultdeptid':'2'},{'userid':'600','badgenumber':'102','name':'Omar','defaultdeptid':'2'}],
   'CHECKINOUT':[{'userid':'500','checktime':'2026-10-28 09:24:00','checktype':'I'}, {'userid':'500','checktime':'2026-10-28 18:00:00','checktype':'O'},{'userid':'600','checktime':'2026-10-28 12:13:00','checktype':'O'}]
  }
  yield from data[table]
 def test_first_sync_second_sync_dedup_and_no_false_in(self):
  r=sync_access(self.db,self.path,'09:00',15,force=True,stream_rows=self.reader);self.db.commit()
  self.assertEqual(r['new_punches'],3)
  self.assertEqual(r['employees'],2)
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM employees').fetchone()[0],2)
  self.assertEqual(self.db.execute('SELECT source_userid FROM employees WHERE device_user_id=?',('101',)).fetchone()[0],'500')
  self.assertEqual(dict(self.db.execute('SELECT clock_in,clock_out,status,late_minutes FROM daily WHERE employee_id=1').fetchone()),{'clock_in':'09:24','clock_out':'18:00','status':'late','late_minutes':9})
  self.assertIsNone(self.db.execute("SELECT clock_in FROM daily WHERE employee_id=2").fetchone()[0])
  r2=sync_access(self.db,self.path,'09:00',15,force=True,stream_rows=self.reader);self.db.commit()
  self.assertEqual(r2['new_punches'],0)
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM punches').fetchone()[0],3)
 def test_file_unchanged_uses_signature(self):
  sync_access(self.db,self.path,stream_rows=self.reader);self.db.commit()
  result=sync_access(self.db,self.path,stream_rows=self.reader)
  self.assertFalse(result['changed'])
 def test_preserve_old_detailed_excel(self):
  self.db.execute("INSERT INTO daily(employee_id,work_date,status,clock_in,clock_out,source) VALUES(1,'2026-10-28','absent',NULL,NULL,'excel_detailed')")
  # The importer preserves vetted history when historical to the system day.
  sync_access(self.db,self.path,stream_rows=self.reader)
  self.assertIn(self.db.execute("SELECT source FROM daily WHERE employee_id=1").fetchone()[0],('excel_detailed','mdb'))
if __name__=='__main__':unittest.main()
