from pathlib import Path
from frontend_source import load_frontend_source
H=load_frontend_source()[4]
def test_expandable_controls():
    for t in ['id="sidebarResizer"','id="sidebarToggle"','id="workspaceToggle"','function toggleSidebar()', 'function toggleWorkspace()', 'function initSidebarResizer()', 'body.sidebar-hidden .main']:
        assert t in H

def test_original_employee_profile_and_chart():
    for t in ['id="empTbody"','emp-profile-row','id="screen-records"','id="screen-employees"','donut-wrap']:
        assert t in H
