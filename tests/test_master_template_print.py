from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "static" / "index.html").read_text()

def test_print_uses_only_master_template_area():
    css = HTML[HTML.index("/* MASTER REPORT PRINT:"):HTML.index("/* RESPONSIVE */")]
    assert "body *{visibility:hidden!important}" in css
    assert "#printLayout,#printLayout *{visibility:visible!important}" in css
    assert ".screen{display:block!important}" not in css

def test_master_template_print_contains_both_supplied_sheets():
    assert 'id="printTemplateRoot"' in HTML
    assert "Police Training Collage" in HTML
    assert "Biometric Absent" in HTML
    assert "Biometric Late Arrivals" in HTML
    assert "AC-No." in HTML
    assert "Clock In" in HTML
    assert "Department" in HTML
    assert "function printMasterAttendanceReport()" in HTML

def test_report_print_buttons_do_not_print_the_whole_dashboard():
    assert 'onclick="window.print()"' not in HTML
    assert "async function printApReport()" in HTML
    assert "printMasterAttendanceReport();" in HTML

def test_filtered_source_rows_are_used_for_print_and_template_export():
    assert "let currentReportSourceRows = [];" in HTML
    assert "currentReportSourceRows = sourceRows.map(r=>({...r}));" in HTML
    assert "currentReportSourceRows&&currentReportSourceRows.length?currentReportSourceRows:rows" in HTML

def test_build_version_bumped_for_deployment_cache():
    assert 'window.ATTENDPRO_BUILD = "2026-11-04-system-screens-visible-fix";' in HTML
