"""Editable Excel report builder based on the supplied Police Training College report template.

Only creates a downloadable workbook. It never writes report edits back to the attendance DB or MDB.
"""
from __future__ import annotations
from copy import copy
from datetime import datetime
from io import BytesIO
from pathlib import Path
from openpyxl import load_workbook
from openpyxl.styles import Alignment

HEADERS = ['No.', 'Name', 'Date', 'Timetable', 'Clock In', 'Clock Out', 'Department', 'Status']


def _text(value):
    if value is None: return ''
    if isinstance(value, str): return value.strip()
    return str(value)


def _clock(value):
    value = _text(value)
    if not value or value in ('—', '-', 'Pending', 'None'): return None
    if len(value) >= 16 and value[10] in (' ', 'T'): return value[11:16]
    return value[:5]


def _normalise(row, idx, default_date):
    status = _text(row.get('status') or 'present').lower().replace(' ', '_')
    cin = _clock(row.get('clock_in') or row.get('cin'))
    cout = _clock(row.get('clock_out') or row.get('cout'))
    date_value = _text(row.get('work_date') or row.get('date') or default_date)
    try:
        if '-' in date_value and len(date_value) >= 10:
            dt = datetime.strptime(date_value[:10], '%Y-%m-%d')
            date_value = dt.strftime('%m/%d/%Y')
    except ValueError:
        pass
    badge = row.get('badge_number') or row.get('id') or row.get('device_user_id') or row.get('employee_id') or ''
    name = _text(row.get('name'))
    dept = _text(row.get('department') or row.get('dept') or 'Unassigned')
    timetable = _text(row.get('shift') or row.get('timetable') or '')
    absent_value = _text(row.get('absent'))
    if status in ('absent', 'missing_check_in', 'not_checked_in') or absent_value.lower() in ('true', 'yes', '1'):
        absent = 'True' if status == 'absent' or absent_value.lower() in ('true', 'yes', '1') else ''
    else:
        absent = ''
    return {
        'no': idx, 'badge_number': _text(badge), 'name': name, 'work_date': date_value,
        'shift': timetable, 'clock_in': cin or '', 'clock_out': cout or '', 'absent': absent,
        'department': dept, 'status': status, 'late_minutes': row.get('late_minutes') or 0,
        'early_minutes': row.get('early_minutes') or 0,
    }


def _copy_row_style(ws, source_row, target_row, columns=8):
    if source_row > ws.max_row: source_row = ws.max_row
    for col in range(1, columns + 1):
        src = ws.cell(source_row, col); dst = ws.cell(target_row, col)
        if src.has_style: dst._style = copy(src._style)
        if src.number_format: dst.number_format = src.number_format
        if src.alignment: dst.alignment = copy(src.alignment)
        if src.protection: dst.protection = copy(src.protection)


def _build_summary_sheet(ws, records, from_date, to_date):
    # Keep original template styling, but rebuild the variable-length sections so
    # every matching employee appears rather than truncating at the old sample rows.
    base = {}
    for row_no in (1, 3, 4, 5, 14):
        base[row_no] = [copy(ws.cell(row_no, c)._style) for c in range(1, 9)]
    widths = {k: v.width for k, v in ws.column_dimensions.items() if v.width is not None}
    for merged in list(ws.merged_cells.ranges): ws.unmerge_cells(str(merged))
    ws.delete_rows(1, ws.max_row)
    for col, width in widths.items(): ws.column_dimensions[col].width = width
    ws.sheet_view.showGridLines = False
    ws.freeze_panes = 'A4'
    def apply_style(row_no, source_style_row):
        for col in range(1, 9):
            ws.cell(row_no, col)._style = copy(base[source_style_row][col-1])
    ws['A1'] = 'Police Training Collage'
    ws['C1'] = f'Biometric Attendance {from_date}' if from_date == to_date else f'Biometric Attendance {from_date} to {to_date}'
    ws['G1'] = 'Lahore'
    apply_style(1, 1)
    ws.merge_cells('A1:B2'); ws.merge_cells('C1:F2'); ws.merge_cells('G1:H2')
    ws.row_dimensions[1].height = 25
    ws.row_dimensions[2].height = 10

    sections = [
        ('Biometric Absent Morning', [r for r in records if r['status'] == 'absent']),
        ('Biometric Late Arrivals', [r for r in records if r['status'] == 'late']),
        ('Early Departure', [r for r in records if int(r.get('early_minutes') or 0) > 0]),
        ('Biometric Not Check In', [r for r in records if not r['clock_in'] and bool(r['clock_out'])]),
        ('Biometric Not Check Out', [r for r in records if bool(r['clock_in']) and not r['clock_out']]),
    ]
    row = 3
    for title, items in sections:
        ws.cell(row, 1, title)
        apply_style(row, 3)
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
        ws.row_dimensions[row].height = 22
        row += 1
        for col, value in enumerate(HEADERS, 1):
            ws.cell(row, col, value)
        apply_style(row, 4)
        ws.row_dimensions[row].height = 20
        row += 1
        if not items:
            apply_style(row, 5)
            ws.cell(row, 1, 1); ws.cell(row, 2, 'NILL')
            row += 1
        else:
            for idx, item in enumerate(items, 1):
                apply_style(row, 14)
                vals = [idx, item['name'] or item['badge_number'], item['work_date'], item['shift'],
                        item['clock_in'], item['clock_out'], item['department'], item['status'].replace('_',' ').title()]
                for col, value in enumerate(vals, 1): ws.cell(row, col, value)
                row += 1
        row += 1
    ws.cell(row, 5, 'Incharge BioMetric\nPolice Training Collage Lahore')
    ws.cell(row, 5).alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    ws.merge_cells(start_row=row, start_column=5, end_row=row+2, end_column=8)
    ws.row_dimensions[row].height = 26
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.print_title_rows = '1:1'


def build_report_xlsx(template_path: str | Path, rows: list[dict], from_date: str, to_date: str) -> bytes:
    template_path = Path(template_path)
    if not template_path.is_file(): raise FileNotFoundError(f'Report template missing: {template_path}')
    records = [_normalise(r, i, from_date) for i, r in enumerate(rows, 1)]
    wb = load_workbook(template_path)
    summary = wb['Absent+ Late '] if 'Absent+ Late ' in wb.sheetnames else wb.worksheets[0]
    data_ws = wb['Sheet1'] if 'Sheet1' in wb.sheetnames else wb.create_sheet('Attendance Data')
    _build_summary_sheet(summary, records, from_date, to_date)

    # Main attendance data uses the supplied Excel template's original eight columns.
    header_style = [copy(data_ws.cell(1, c)._style) for c in range(1, 9)]
    sample_style = [copy(data_ws.cell(2, c)._style) for c in range(1, 9)] if data_ws.max_row >= 2 else header_style
    widths = {k: v.width for k, v in data_ws.column_dimensions.items() if v.width is not None}
    if data_ws.max_row > 1: data_ws.delete_rows(2, data_ws.max_row - 1)
    headers = ['AC-No.', 'Name', 'Date', 'Timetable', 'Clock In', 'Clock Out', 'Absent', 'Department']
    for col, label in enumerate(headers, 1):
        data_ws.cell(1, col, label); data_ws.cell(1, col)._style = copy(header_style[col-1])
    for col, width in widths.items(): data_ws.column_dimensions[col].width = width
    for row_num, item in enumerate(records, 2):
        vals = [item['badge_number'], item['name'], item['work_date'], item['shift'], item['clock_in'] or None,
                item['clock_out'] or None, item['absent'] or None, item['department']]
        for col, value in enumerate(vals, 1):
            cell = data_ws.cell(row_num, col, value)
            if sample_style[col-1]: cell._style = copy(sample_style[col-1])
    data_ws.freeze_panes = 'A2'
    data_ws.auto_filter.ref = f'A1:H{max(1,len(records)+1)}'
    data_ws.sheet_view.showGridLines = False
    data_ws.sheet_properties.pageSetUpPr.fitToPage = True
    data_ws.page_setup.fitToWidth = 1
    data_ws.page_setup.fitToHeight = 0
    data_ws.print_title_rows = '1:1'
    out = BytesIO(); wb.save(out); return out.getvalue()
