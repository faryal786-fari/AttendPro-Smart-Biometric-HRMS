#!/usr/bin/env python3
"""Explicit, idempotent migration from bundled SQLite snapshot to Supabase.
No MDB path is opened. Nothing is ever written to att2000.mdb.
"""
import argparse,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from cloud_service import CLOUD_ENABLED,CloudError
import app
from cloud_projection import prepare_raw_tables,export_source_rows,push_sources

def main():
 p=argparse.ArgumentParser()
 p.add_argument('--upload',action='store_true',help='Actually send the source snapshot to Supabase')
 args=p.parse_args()
 if not CLOUD_ENABLED:sys.exit('Set SUPABASE_ENABLED=1 first')
 app.init_db()
 with app.connection() as db:
  prepare_raw_tables(db)
  legacy=db.execute("SELECT COUNT(*) FROM daily WHERE source='local_edit'").fetchone()[0]
  if legacy:
   sys.exit(f'{legacy} local manual edits found. Review/migrate them separately before continuing, to avoid losing correction history.')
  data=export_source_rows(db)
  print('Source snapshot:',json.dumps({k:len(v) for k,v in data.items()},indent=2))
  print('Original MDB is untouched; no source access is needed for this script.')
  if not args.upload:
   print('Dry run complete. Repeat with --upload to send the snapshot to Supabase.')
   return
  try:
   result=push_sources(db)
   db.execute("INSERT OR REPLACE INTO cloud_replication_state(key,value) VALUES ('pending','0')")
  except CloudError as e:sys.exit('Upload failed, retry safely: '+str(e))
 print('Upload finished:',result)
 print('In Supabase Table Editor, verify counts for employees, source_daily and raw_punches.')
if __name__=='__main__':main()
