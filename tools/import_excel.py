"""Usage: python tools/import_excel.py /path/to/report.xls [more_reports.xls]"""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from app import connection,init_db
from tools.importers import import_spreadsheet
if __name__=='__main__':
 if len(sys.argv)<2:raise SystemExit('Usage: python tools/import_excel.py report.xls [other.xls]')
 init_db()
 with connection() as db:
  for file in sys.argv[1:]:
   p=Path(file)
   print(import_spreadsheet(db,p.read_bytes(),p.name))
