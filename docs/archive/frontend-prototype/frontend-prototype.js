
// ── DATA ──────────────────────────────────────────────────────────────────
// Employee profile state initialized BEFORE the prototype's initial render.
let employeeSortKey='name', employeeSortDirection=1;
let expandedEmployeeId=null, employeeProfileCache=new Map();
const COLORS=['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#0ea5e9','#f97316','#14b8a6'];
const DEPTS=['Engineering','Finance','HR','Operations','Sales','IT Support'];
const SHIFTS=['Morning (08:00)','General (09:00)','Evening (14:00)'];
const STATUSES=['Present','Present','Present','Present','Late','Late','Absent','On Leave','Early Arrival'];
const NAMES=['Ahmed Raza','Sana Aslam','Bilal Hussain','Fatima Zahra','Umar Farooq','Nadia Pervez','Khalid Mirza','Zara Sheikh','Tahir Khan','Ayesha Noor','Hamid Ali','Sara Qureshi','Imran Baig','Maryam Khan','Faisal Mehmood','Rabia Malik','Asif Iqbal','Hira Butt','Junaid Ahmad','Saba Javed','Waheed Rana','Amna Tariq','Saad Nawaz','Layla Hassan','Omar Sheikh','Rida Javed','Danish Ali','Mehak Shahid'];
const DESIG=['Software Engineer','Senior Developer','HR Specialist','Finance Manager','Sales Executive','IT Support Lead','Operations Head','Accountant','HR Manager','UI/UX Designer','DevOps Engineer','QA Engineer'];
const PHONES=['+92-300-1234567','+92-321-7654321','+92-333-9876543','+92-311-2345678','+92-345-6789012'];

function rnd(arr){return arr[Math.floor(Math.random()*arr.length)]}
function rndInt(a,b){return Math.floor(Math.random()*(b-a+1))+a}
function initials(n){return n.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}
function today(){return new Date().toISOString().split('T')[0]}
function fmtTime(h,m){return`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`}

const employees=NAMES.map((name,i)=>({
  id:`AC-${String(i+1001).padStart(4,'0')}`,
  name,dept:DEPTS[i%DEPTS.length],
  designation:DESIG[i%DESIG.length],
  shift:SHIFTS[i%SHIFTS.length],
  status:i<25?'Active':'Inactive',
  phone:PHONES[i%PHONES.length],
  email:`${name.toLowerCase().replace(' ','.')}@alrehman.com`,
  color:COLORS[i%COLORS.length]
}));

function genCin(sched,status){
  if(status==='Absent'||status==='On Leave')return'—';
  const[h,m]=sched.split(':').map(Number);
  if(status==='Late'){const late=rndInt(5,35);const tot=h*60+m+late;return fmtTime(Math.floor(tot/60),tot%60)}
  if(status==='Early Arrival'){const early=rndInt(5,25);const tot=h*60+m-early;return fmtTime(Math.floor(tot/60),tot%60)}
  const off=rndInt(-5,5);const tot=h*60+m+off;return fmtTime(Math.floor(tot/60),tot%60)
}
function genCout(cin,status){
  if(cin==='—')return'—';
  const[h,m]=cin.split(':').map(Number);const hrs=rndInt(420,510);const tot=h*60+m+hrs;
  return Math.random()>.15?fmtTime(Math.floor(tot/60)%24,tot%60):'Pending'
}
function lateMin(sched,actual,status){
  if(actual==='—'||actual==='Pending')return'—';
  if(status==='Late'){const[sh,sm]=sched.split(':').map(Number);const[ah,am]=actual.split(':').map(Number);const d=ah*60+am-sh*60-sm;return`+${d} min`}
  if(status==='Early Arrival'){const[sh,sm]=sched.split(':').map(Number);const[ah,am]=actual.split(':').map(Number);const d=sh*60+sm-ah*60-am;return`-${d} min`}
  return'On time'
}

const liveData=employees.map(e=>{
  const sIn=e.shift.includes('08')?'08:00':e.shift.includes('09')?'09:00':'14:00';
  const sOut=e.shift.includes('08')?'17:00':e.shift.includes('09')?'18:00':'23:00';
  const status=rnd(STATUSES);
  const cin=genCin(sIn,status);
  const cout=genCout(cin,status);
  return{...e,schedIn:sIn,schedOut:sOut,status,cin,cout,lateStr:lateMin(sIn,cin,status)}
});

// Records data
const recData=[];
for(let d=0;d<7;d++){
  const dt=new Date();dt.setDate(dt.getDate()-d);
  const ds=dt.toISOString().split('T')[0];
  employees.slice(0,20).forEach(e=>{
    const status=rnd(STATUSES);
    const sIn=e.shift.includes('08')?'08:00':e.shift.includes('09')?'09:00':'14:00';
    const cin=genCin(sIn,status);
    const cout=genCout(cin,status);
    let late=0,wh='—';
    if(cin!=='—'&&cout!=='Pending'&&cout!=='—'){
      const[ch,cm]=cin.split(':').map(Number);
      const[oh,om]=cout.split(':').map(Number);
      const totalMin=oh*60+om-ch*60-cm;
      wh=`${Math.floor(totalMin/60)}h ${totalMin%60}m`;
      if(status==='Late'){const[sh,sm]=sIn.split(':').map(Number);late=ch*60+cm-sh*60-sm}
    }
    recData.push({date:ds,id:e.id,name:e.name,dept:e.dept,schedIn:sIn,schedOut:e.shift.includes('08')?'17:00':e.shift.includes('09')?'18:00':'23:00',cin,cout,wh,late:late?`${late} min`:'—',earlyDep:'—',ot:'—',status})
  })
}

// ── UTILS ──────────────────────────────────────────────────────────────────
function statusBadge(s){
  const m={'Present':'b-green','Late':'b-amber','Absent':'b-red','On Leave':'b-purple','Early Arrival':'b-blue','Pending Check-out':'b-gray','Missing Check-in':'b-red'};
  return`<span class="badge ${m[s]||'b-gray'}">${s}</span>`
}
function avEl(e,size=30){return`<div class="emp-av" style="width:${size}px;height:${size}px;background:${e.color}">${initials(e.name)}</div>`}


// ── REAL BACKEND INTEGRATION ───────────────────────────────────────────────
// Served page uses same-origin FastAPI. If opened as a local file, use the local server.
const API = window.location.protocol === 'file:' ? 'http://127.0.0.1:8000' : window.location.origin;
let realRefreshTimer = null;
let realLoading = false;
let currentDataDate = '';
let currentDashboard = null;
let recentPunches = [];
let currentSettings = {};
let userSelectedDate = false;
let currentReportRows = [];

async function apiJSON(path, options={}) {
  const response = await fetch(`${API}${path}`, {cache:'no-store', ...options, headers:{'Content-Type':'application/json', ...(options.headers||{})}});
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try { const body = await response.json(); detail = body.detail || body.message || detail; } catch(_) {}
    throw new Error(detail);
  }
  return response.json();
}
async function fetchAllPages(path, params={}) {
  let all=[], page=1, total=Infinity;
  while (all.length < total) {
    const q = new URLSearchParams({...params, page:String(page), per_page:'150'});
    const result = await apiJSON(`${path}?${q.toString()}`);
    const items = Array.isArray(result) ? result : (result.items || []);
    total = Array.isArray(result) ? items.length : (Number(result.total ?? items.length));
    all.push(...items);
    if (!items.length || all.length >= total) break;
    page += 1;
    if (page > 100) break;
  }
  return all;
}
function showTime(v) {
  if (v === null || v === undefined || v === '') return '—';
  const s=String(v);
  if (s.includes('T')) return s.slice(11,16);
  if (s.length >= 16 && s[10] === ' ') return s.slice(11,16);
  return s.slice(0,5);
}
function titleStatus(v) {
  const s=String(v||'').toLowerCase().replaceAll('_',' ');
  if (s==='late') return 'Late';
  if (s==='present') return 'Present';
  if (s==='absent') return 'Absent';
  if (s==='on leave') return 'On Leave';
  if (s==='early' || s==='early arrival') return 'Early Arrival';
  if (s==='missing check-in') return 'Missing Check-in';
  return 'Not Checked In';
}
function mapEmployee(e,i) {
  return {
    dbId:e.id,
    id:String(e.badge_number || e.device_user_id || e.id || ''),
    deviceUserId:String(e.device_user_id || ''),
    sourceUserid:String(e.source_userid || ''),
    name:e.name || 'Unknown Employee',
    dept:e.department || 'Unassigned',
    designation:e.designation || 'Staff',
    shift:e.shift || 'General',
    status:(e.active===0 || e.active===false)?'Inactive':'Active',
    phone:e.phone || '', email:e.email || '', color:COLORS[i%COLORS.length]
  };
}
function makeLiveRows(employeeRows, dailyRows, officeStart='09:00') {
  const byEmp=new Map(dailyRows.map(r=>[String(r.employee_id),r]));
  return employeeRows.map((e,i)=>{
    const d=byEmp.get(String(e.dbId));
    const cin=d?showTime(d.clock_in):'—';
    const cout=d?showTime(d.clock_out):'—';
    let status=d?titleStatus(d.status):'Not Checked In';
    if (d && cin==='—' && cout!=='—' && status==='Present') status='Missing Check-in';
    const rawLate=Number(d?.late_minutes||0), rawEarly=Number(d?.early_minutes||0);
    let lateStr='—';
    if(cin!=='—') lateStr=rawLate>0?`+${rawLate} min`:rawEarly>0?`-${rawEarly} min`:'On time';
    const schedIn=(/^\d{2}:\d{2}$/.test(String(d?.shift||''))?d.shift:officeStart)||'09:00';
    const work=Number(d?.work_minutes||0);
    const wh=work>0?`${Math.floor(work/60)}h ${work%60}m`:'—';
    return {...e, shift:d?.shift||e.shift||'General', schedIn, schedOut:'—', status, cin, cout:cout==='—'&&cin!=='—'?'Pending':cout, lateStr,
      date:d?.work_date||currentDataDate, wh, late:rawLate?`${rawLate} min`:'—', earlyDep:rawEarly?`${rawEarly} min`:'—', ot:'—',
      source:d?.source||'no_attendance_record'};
  });
}
function updateDepartmentOptions(rows) {
  const depts=[...new Set(rows.map(e=>e.dept).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  [['liveDept','All Departments'],['empDept','All Departments'],['recDept','All Departments'],['rptDept','All Departments']].forEach(([id,label])=>{
    const el=document.getElementById(id); if(!el)return;
    const prior=el.value;
    el.innerHTML=`<option value="">${label}</option>`+depts.map(d=>`<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
    if(depts.includes(prior))el.value=prior;
  });
  const shiftEl=document.getElementById('liveShift');
  if(shiftEl){const shifts=[...new Set(liveData.map(r=>r.shift).filter(Boolean))].sort();const prior=shiftEl.value;shiftEl.innerHTML='<option value="">All Shifts</option>'+shifts.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');if(shifts.includes(prior))shiftEl.value=prior;}
}
function escapeHtml(v) { return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function updateKpis(metrics, depts) {
  const early=liveData.filter(r=>r.status==='Early Arrival').length;
  const missingOut=liveData.filter(r=>r.cin!=='—' && (r.cout==='Pending'||r.cout==='—')).length;
  const vals={kpiTotal:metrics.total??employees.length,kpiPresent:metrics.present??0,kpiAbsent:metrics.absent??0,kpiLate:metrics.late??0,
    kpiEarly:early,kpiLeave:'—',kpiMissingIn:metrics.unknown??0,kpiMissingOut:missingOut||metrics.incomplete||0};
  Object.entries(vals).forEach(([id,val])=>{const el=document.getElementById(id);if(el)el.textContent=val;});
  const cards=document.querySelectorAll('#screen-dashboard .kpi-card .kpi-sub');
  const total=Number(metrics.total||0), present=Number(metrics.present||0), absent=Number(metrics.absent||0);
  if(cards[0])cards[0].textContent=`Across ${depts.length} departments`;
  if(cards[1])cards[1].textContent=`${metrics.attendance_percentage??(total?Math.round(present/total*1000)/10:0)}% attendance rate`;
  if(cards[2])cards[2].textContent=`${total?Math.round(absent/total*1000)/10:0}% absence rate`;
  if(cards[3])cards[3].textContent=`${metrics.late||0} reported late arrivals`;
  if(cards[4])cards[4].textContent='Calculated from available attendance records';
  if(cards[5])cards[5].textContent='Leave records are not connected';
  if(cards[6])cards[6].textContent='Employees not yet classified as present/absent';
  if(cards[7])cards[7].textContent='Incomplete check-in/check-out records';
}
function updateDonut() {
  const present=liveData.filter(r=>r.status==='Present'||r.status==='Early Arrival').length;
  const late=liveData.filter(r=>r.status==='Late').length;
  const absent=liveData.filter(r=>r.status==='Absent').length;
  const unknown=liveData.filter(r=>r.status==='Not Checked In'||r.status==='Missing Check-in').length;
  const total=Math.max(1,present+late+absent+unknown);
  const pct=Math.round((present+late)/total*100);
  const center=document.getElementById('donutCenter'); if(center)center.textContent=`${pct}%`;
  [['legendPresent',present],['legendAbsent',absent],['legendLate',late],['legendUnknown',unknown]].forEach(([id,val])=>{const el=document.getElementById(id);if(el)el.textContent=val;});
  const circles=document.querySelectorAll('#screen-dashboard .donut-wrap svg circle');
  if(circles.length>=5){
    const circ=2*Math.PI*40; let offset=0;
    [present,absent,late,unknown].forEach((n,i)=>{const len=circ*n/total;const c=circles[i+1];c.setAttribute('stroke-dasharray',`${len} ${Math.max(0,circ-len)}`);c.setAttribute('stroke-dashoffset',String(-offset));offset+=len;});
  }
}
async function loadSyncHistory() {
  const box=document.getElementById('syncHistoryBox'); if(!box)return;
  try {
    const r=await apiJSON('/api/imports'); const items=r.items||[];
    box.innerHTML=items.length?items.slice(0,6).map(x=>`<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--gray100)"><div><div style="font-weight:600;color:var(--text)">${escapeHtml(x.filename||x.source||'Database sync')}</div><div style="margin-top:2px">${escapeHtml(x.source||'import')} · ${Number(x.attendance_rows||0)} attendance rows</div></div><div style="text-align:right;white-space:nowrap">${escapeHtml(x.imported_at||'')}</div></div>`).join(''):'<div style="text-align:center;padding:24px"><div style="font-size:28px;margin-bottom:8px">📡</div>No sync/import history yet.</div>';
  } catch(e) { box.textContent='Sync history API unavailable.'; }
}
async function loadAccessSettings(showError=false) {
  try {
    currentSettings=await apiJSON('/api/settings');
    const path=document.getElementById('accessPath'); if(path && !path.matches(':focus'))path.value=currentSettings.access_path||'';
    const auto=document.getElementById('accessAuto'); if(auto)auto.checked=!!currentSettings.access_auto;
    const interval=document.getElementById('accessInterval'); if(interval)interval.value=currentSettings.access_interval||90;
    const dev=currentSettings.device||{};
    const badge=document.getElementById('accessStatus'); if(badge)badge.textContent=dev.status==='online'?'MDB connected':dev.status==='error'?'MDB error':dev.status==='missing_file'?'MDB file missing':dev.configured?'Configured — not tested':'Not configured';
    const mdbStatus=document.querySelector('#screen-device .device-card .status-dot');
    if(mdbStatus){mdbStatus.classList.toggle('status-pending',dev.status!=='online');mdbStatus.textContent=dev.status==='online'?'🟢 Access database online':'⏳ '+(dev.status||'Not configured').replaceAll('_',' ');}
    const metricBoxes=document.querySelectorAll('#screen-device .metric-box');
    if(metricBoxes[0]){metricBoxes[0].querySelector('.metric-val').textContent=dev.configured?'MDB':'—';metricBoxes[0].querySelector('.metric-lbl').textContent='Connection Method';metricBoxes[0].lastElementChild.textContent='Read-only Access database';}
    if(metricBoxes[1]){metricBoxes[1].querySelector('.metric-val').textContent=dev.last_sync?showTime(dev.last_sync):'—';metricBoxes[1].querySelector('.metric-lbl').textContent='Last Sync';metricBoxes[1].lastElementChild.textContent=dev.last_sync||'No successful sync yet';}
    if(metricBoxes[2]){metricBoxes[2].querySelector('.metric-val').textContent=dev.last_fetched??'—';metricBoxes[2].querySelector('.metric-lbl').textContent='Events Scanned';metricBoxes[2].lastElementChild.textContent=`New punches saved: ${dev.last_inserted??0}`;}
    await loadSyncHistory();
    return currentSettings;
  } catch(e) { if(showError)alert('Settings load nahi ho sakin: '+e.message); return null; }
}
async function saveAccessSettings(quiet=false) {
  try {
    const body={access_path:document.getElementById('accessPath').value.trim(),access_auto:document.getElementById('accessAuto').checked,access_interval:Number(document.getElementById('accessInterval').value||90)};
    currentSettings=await apiJSON('/api/settings',{method:'PUT',body:JSON.stringify(body)});
    await loadAccessSettings();
    if(!quiet)alert('Database settings save ho gayi hain.');
    return true;
  } catch(e) { alert('Settings save nahi hui: '+e.message); return false; }
}
async function testAccessDB() {
  if(!await saveAccessSettings(true))return;
  try { const r=await apiJSON('/api/database/test',{method:'POST'}); await loadAccessSettings(); alert((r.success?'SUCCESS: ':'ERROR: ')+(r.message||'Test complete')); }
  catch(e){alert('MDB test fail: '+e.message);}
}
async function syncAccessDB() {
  if(!await saveAccessSettings(true))return;
  const btns=document.querySelectorAll('#screen-device button');
  try {
    const r=await apiJSON('/api/database/sync?force=true',{method:'POST'});
    alert((r.success?'Sync complete: ':'Sync failed: ')+(r.message||JSON.stringify(r)));
    await loadAccessSettings(); await loadRealData(true);
  } catch(e){alert('Sync error: '+e.message);}
}
async function showSyncLogs() {
  try { const r=await apiJSON('/api/imports'); const rows=r.items||[]; alert(rows.length?rows.map(x=>`${x.imported_at||''} | ${x.source||''} | ${x.filename||''} | rows: ${x.attendance_rows||0}`).join('\n'):'Abhi sync/import history available nahi.'); }
  catch(e){alert('Logs load nahi huay: '+e.message);}
}
async function loadSelectedDate() { userSelectedDate=true; await loadRealData(true); }
async function loadRealData(forceDate=false) {
  if(realLoading)return;
  realLoading=true;
  try {
    const health=await apiJSON('/api/health');
    const dashboard=await apiJSON('/api/dashboard');
    await loadAccessSettings();
    const employeeRows=await fetchAllPages('/api/employees');
    if(!employeeRows.length)throw new Error('Database mein employee records nahi mile.');
    employees.splice(0,employees.length,...employeeRows.map(mapEmployee));
    currentDataDate=(userSelectedDate && document.getElementById('liveDate').value)?document.getElementById('liveDate').value:(dashboard.date||today());
    if(!userSelectedDate){const dateEl=document.getElementById('liveDate');if(dateEl)dateEl.value=currentDataDate;}
    const selectedDash=(currentDataDate===dashboard.date)?dashboard:await apiJSON('/api/dashboard?date='+encodeURIComponent(currentDataDate));
    currentDashboard=selectedDash;
    const dailyRows=await fetchAllPages('/api/attendance',{date:currentDataDate});
    liveData.splice(0,liveData.length,...makeLiveRows(employees,dailyRows,(currentSettings.office_start||'09:00')));
    recentPunches=selectedDash.recent||[];
    updateDepartmentOptions(employees);
    updateKpis(selectedDash.metrics||{},selectedDash.departments||[]);
    updateDonut();
    buildDashboard(); renderLive(); renderEmployees();
    const badge=document.querySelector('.demo-badge');
    if(badge){
      const dev=selectedDash.device||{};
      if(dev.status==='online') {badge.style.background='#dcfce7';badge.style.borderColor='#86efac';badge.style.color='#166534';badge.textContent=`🟢 Live MDB data · ${currentDataDate}`;}
      else {badge.style.background='#fef3c7';badge.style.borderColor='#fcd34d';badge.style.color='#92400e';badge.textContent=`📚 Stored attendance data · ${currentDataDate}`;}
    }
    const sub=document.querySelector('#screen-dashboard .page-sub'); if(sub)sub.innerHTML=`Attendance overview — <strong>${escapeHtml(currentDataDate)}</strong> · ${devText(selectedDash.device)}`;
    const empSub=document.querySelector('#screen-employees .page-sub');if(empSub)empSub.textContent=`${employees.length} employees from the attendance database`;
    const liveSub=document.querySelector('#screen-live .page-sub');if(liveSub)liveSub.textContent=`Attendance records for ${currentDataDate} · refreshes automatically`;
    await loadHistoryForRange(false);
  } catch(e) {
    const badge=document.querySelector('.demo-badge');
    if(badge){badge.style.background='#fee2e2';badge.style.borderColor='#fecaca';badge.style.color='#991b1b';badge.textContent='⚠ Backend unavailable — sample preview';}
    console.warn('AttendPro backend unavailable:',e.message);
  } finally {
    realLoading=false;
    if(realRefreshTimer)clearTimeout(realRefreshTimer);
    realRefreshTimer=setTimeout(()=>loadRealData(false),15000);
  }
}
function devText(dev){const s=dev?.status||'not configured';return s==='online'?'Access database connected':('database '+s.replaceAll('_',' '));}
async function loadHistoryForRange(render=true) {
  const from=document.getElementById('recFrom')?.value||'';
  const to=document.getElementById('recTo')?.value||'';
  if(!from||!to)return;
  try {
    const q=new URLSearchParams({from,to});
    const result=await apiJSON('/api/attendance/history?'+q.toString());
    recData.splice(0,recData.length,...(result.items||[]).map(r=>{
      const emp=employees.find(e=>String(e.dbId)===String(r.employee_id));
      const cin=showTime(r.clock_in),cout=showTime(r.clock_out),mins=Number(r.work_minutes||0);
      const statusName=titleStatus(r.status);
      return {date:r.work_date,dbId:r.employee_id,employee_id:r.employee_id,id:String(r.badge_number||r.device_user_id||emp?.id||r.employee_id),name:r.name||emp?.name||'Unknown',dept:r.department||emp?.dept||'Unassigned',
        timetable:r.shift||'—',schedIn:/^\d{2}:\d{2}$/.test(String(r.shift||''))?r.shift:'—',schedOut:'—',cin,cout:cout==='—'&&cin!=='—'?'Pending':cout,wh:mins>0?`${Math.floor(mins/60)}h ${mins%60}m`:'—',late:r.late_minutes?`${r.late_minutes} min`:'—',late_minutes:r.late_minutes||0,earlyDep:r.early_minutes?`${r.early_minutes} min`:'—',early_minutes:r.early_minutes||0,ot:'—',status:statusName,absent:statusName==='Absent'?'True':'',source:r.source||''};
    }));
    if(render)renderRecords();
  } catch(e){console.warn('History load failed:',e.message);}
}
function diffMins(t1,t2){const [h1,m1]=t1.split(':').map(Number);const [h2,m2]=t2.split(':').map(Number);return Math.abs((h2*60+m2)-(h1*60+m1));}

// ── CLOCK ──────────────────────────────────────────────────────────────────
function updateClock(){
  const n=new Date();
  document.getElementById('sbTime').textContent=n.toLocaleTimeString('en-US',{hour12:false});
  document.getElementById('sbDate').textContent=n.toLocaleDateString('en-PK',{weekday:'long',day:'numeric',month:'short',year:'numeric'});
  document.getElementById('dashDate').textContent=n.toLocaleDateString('en-PK',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
}
setInterval(updateClock,1000);updateClock();

// ── NAVIGATION ──────────────────────────────────────────────────────────────
function showScreen(name,el){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('screen-'+name).classList.add('active');
  if(el)el.classList.add('active');
  if(name==='live')renderLive();
  if(name==='employees')renderEmployees();
  if(name==='records'){setDefaultDates();renderRecords();}
}
function setLiveFilter(s){document.getElementById('liveStatus').value=s;renderLive()}

// ── LIVE TABLE ──────────────────────────────────────────────────────────────
let livePage=1,liveSort={col:'',dir:1};
function renderLive(){
  const search=(document.getElementById('liveSearch').value||'').toLowerCase();
  const dept=document.getElementById('liveDept').value;
  const shift=document.getElementById('liveShift').value;
  const status=document.getElementById('liveStatus').value;
  let data=liveData.filter(r=>{
    if(search&&!r.name.toLowerCase().includes(search)&&!r.id.toLowerCase().includes(search))return false;
    if(dept&&r.dept!==dept)return false;
    if(shift&&r.shift!==shift)return false;
    if(status&&r.status!==status)return false;
    return true;
  });
  if(liveSort.col){const k=liveSort.col;data.sort((a,b)=>liveSort.dir*String(a[k]).localeCompare(String(b[k])))}
  const pp=15,total=data.length,pages=Math.ceil(total/pp);
  if(livePage>pages)livePage=1;
  const slice=data.slice((livePage-1)*pp,livePage*pp);
  document.getElementById('liveTbody').innerHTML=slice.map(r=>`
    <tr style="cursor:pointer" onclick='openEmpModal(${JSON.stringify(r)})'>
      <td>${avEl(r)}</td><td style="font-family:monospace;font-size:12px">${r.id}</td>
      <td><strong>${r.name}</strong></td><td>${r.dept}</td><td style="font-size:12px">${r.shift}</td>
      <td>${r.schedIn}</td>
      <td style="font-weight:600;color:${r.cin==='—'?'var(--text3)':r.status==='Late'?'var(--red)':r.status==='Early Arrival'?'var(--blue)':'var(--green)'}">${r.cin}</td>
      <td style="font-size:12px;color:${r.lateStr.startsWith('+')?'var(--red)':r.lateStr.startsWith('-')?'var(--blue)':'var(--green)'}">${r.lateStr}</td>
      <td>${r.schedOut}</td>
      <td style="color:${r.cout==='Pending'?'var(--amber)':r.cout==='—'?'var(--text3)':'var(--text)'}">${r.cout}</td>
      <td>${statusBadge(r.status)}</td>
    </tr>`).join('');
  renderPag('livePag',livePage,pages,total,pp,p=>{livePage=p;renderLive()});
}
function sortLive(col){if(liveSort.col===col)liveSort.dir*=-1;else{liveSort.col=col;liveSort.dir=1}renderLive()}
function clearFilters(){['liveSearch','liveDept','liveShift','liveStatus'].forEach(id=>{const el=document.getElementById(id);el.value=''});renderLive()}

// ── EMPLOYEES TABLE ──────────────────────────────────────────────────────────
let empPage=1;
function renderEmployees(){
  const search=(document.getElementById('empSearch').value||'').toLowerCase();
  const dept=document.getElementById('empDept').value;
  const status=document.getElementById('empStatus').value;
  const data=employees.filter(e=>{
    if(search&&!e.name.toLowerCase().includes(search)&&!e.id.toLowerCase().includes(search))return false;
    if(dept&&e.dept!==dept)return false;
    if(status&&e.status!==status)return false;
    return true;
  });
  const pp=10,total=data.length,pages=Math.ceil(total/pp);
  if(empPage>pages)empPage=1;
  const slice=data.slice((empPage-1)*pp,empPage*pp);
  document.getElementById('empTbody').innerHTML=slice.map(e=>`
    <tr>
      <td>${avEl(e,32)}</td>
      <td style="font-family:monospace;font-size:12px;color:var(--text2)">${e.id}</td>
      <td style="cursor:pointer" onclick='openEmpModal(${JSON.stringify(e)})'><strong style="color:var(--blue)">${e.name}</strong></td>
      <td>${e.dept}</td><td>${e.designation}</td><td style="font-size:12px">${e.shift}</td>
      <td>${e.status==='Active'?'<span class="badge b-green">Active</span>':'<span class="badge b-gray">Inactive</span>'}</td>
      <td><button class="btn btn-outline btn-sm" onclick='openEmpModal(${JSON.stringify(e)})'>View</button></td>
    </tr>`).join('');
  renderPag('empPag',empPage,pages,total,10,p=>{empPage=p;renderEmployees()});
}

// ── RECORDS TABLE ──────────────────────────────────────────────────────────
let recPage=1;
function setDefaultDates(){
  const t=new Date(),f=new Date();f.setDate(f.getDate()-6);
  document.getElementById('recFrom').value=f.toISOString().split('T')[0];
  document.getElementById('recTo').value=t.toISOString().split('T')[0];
}
function renderRecords(){
  const dept=document.getElementById('recDept').value;
  const status=document.getElementById('recStatus').value;
  const data=recData.filter(r=>{
    if(dept&&r.dept!==dept)return false;
    if(status&&r.status!==status)return false;
    return true;
  });
  const pp=15,total=data.length,pages=Math.ceil(total/pp);
  if(recPage>pages)recPage=1;
  const slice=data.slice((recPage-1)*pp,recPage*pp);
  document.getElementById('recTbody').innerHTML=slice.map(r=>`
    <tr>
      <td style="font-size:12px">${r.date}</td>
      <td><div style="display:flex;align-items:center;gap:6px">${avEl({color:COLORS[employees.findIndex(e=>e.id===r.id)%COLORS.length],name:r.name},24)}<span>${r.name}</span></div></td>
      <td>${r.dept}</td><td>${r.schedIn}</td>
      <td style="color:${r.cin==='—'?'var(--text3)':'var(--text)'}">${r.cin}</td>
      <td>${r.schedOut}</td>
      <td style="color:${r.cout==='Pending'?'var(--amber)':r.cout==='—'?'var(--text3)':'var(--text)'}">${r.cout}</td>
      <td style="font-weight:500">${r.wh}</td>
      <td style="color:${r.late!=='—'?'var(--red)':'var(--green)'}">${r.late}</td>
      <td>${r.earlyDep}</td><td>${r.ot}</td>
      <td>${statusBadge(r.status)}</td>
    </tr>`).join('');
  renderPag('recPag',recPage,pages,total,pp,p=>{recPage=p;renderRecords()});
}

// ── PAGINATION ──────────────────────────────────────────────────────────────
function renderPag(id,cur,pages,total,pp,cb){
  const el=document.getElementById(id);if(!el)return;
  const from=total?(cur-1)*pp+1:0,to=Math.min(cur*pp,total);
  let btns='';
  for(let i=1;i<=Math.min(pages,7);i++)btns+=`<div class="pg-btn${i===cur?' active':''}" onclick="(${cb.toString()})(${i})">${i}</div>`;
  el.innerHTML=`<span>Showing ${from}–${to} of ${total}</span><div class="pg-btns"><div class="pg-btn" onclick="if(${cur}>1)(${cb.toString()})(${cur-1})">‹</div>${btns}<div class="pg-btn" onclick="if(${cur}<${pages})(${cb.toString()})(${cur+1})">›</div></div>`;
}

// ── MODAL ──────────────────────────────────────────────────────────────────
function openEmpModal(e){
  document.getElementById('modalTitle').textContent=displayEmployeeName(e.name)||'Employee Details';
  const rows=[
    ['Employee ID',e.id||'—'],['Name',displayEmployeeName(e.name)||'—'],['Department',e.dept||'—'],
    ['Designation',e.designation||'—'],['Shift',e.shift||'—'],['Status',statusBadge(e.status||'—')],
    ...(e.cin?[['Check-in',e.cin],['Check-out',e.cout||'—'],['Late/Early',e.lateStr||'—']]:[]),
    ...(e.phone?[['Phone',e.phone],['Email',e.email||'—']]:[] )
  ];
  document.getElementById('modalBody').innerHTML=`<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px"><div class="emp-av" style="width:48px;height:48px;font-size:16px;background:${e.color||COLORS[0]}">${initials(displayEmployeeName(e.name)||'?')}</div><div><div style="font-size:16px;font-weight:700">${escapeHtml(displayEmployeeName(e.name)||'')}</div><div style="color:var(--text2);font-size:13px">${e.designation||''} · ${e.dept||''}</div></div></div>${rows.map(([l,v])=>`<div class="detail-row"><span class="detail-label">${l}</span><span class="detail-val">${v}</span></div>`).join('')}<div style="margin-top:16px;display:flex;gap:8px"><button class="btn btn-primary btn-sm" onclick="alert('Edit form requires backend integration')">Edit Details</button><button class="btn btn-outline btn-sm" onclick="showScreen('records',document.querySelector('[data-screen=records]'));closeModal()">View Records</button></div>`;
  document.getElementById('empModal').classList.add('open');
}
function closeModal(){document.getElementById('empModal').classList.remove('open')}

// ── DASHBOARD DYNAMIC ──────────────────────────────────────────────────────
function buildDashboard(){
  const recent=liveData.filter(r=>r.cin!=='—').slice(0,8);
  document.getElementById('recentActivity').innerHTML=recent.map(r=>`
    <tr><td><div style="display:flex;align-items:center;gap:6px">${avEl(r,24)}<span>${r.name}</span></div></td>
    <td><span class="badge b-blue" style="font-size:10px">CHECK-IN</span></td>
    <td style="font-family:monospace;font-size:12px">${r.cin}</td>
    <td style="font-size:12px">${r.dept}</td>
    <td>${statusBadge(r.status)}</td></tr>`).join('');
  const exc=[
    ...liveData.filter(r=>r.status==='Absent').slice(0,2).map(r=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--gray100)"><div style="display:flex;align-items:center;gap:8px">${avEl(r,26)}<div><div style="font-size:12px;font-weight:600">${r.name}</div><div style="font-size:11px;color:var(--text3)">${r.dept}</div></div></div><span class="badge b-red">Absent</span></div>`),
    ...liveData.filter(r=>r.status==='Late').slice(0,2).map(r=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--gray100)"><div style="display:flex;align-items:center;gap:8px">${avEl(r,26)}<div><div style="font-size:12px;font-weight:600">${r.name}</div><div style="font-size:11px;color:var(--text3)">${r.lateStr} late</div></div></div><span class="badge b-amber">Late</span></div>`),
    ...liveData.filter(r=>r.cout==='Pending').slice(0,2).map(r=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--gray100)"><div style="display:flex;align-items:center;gap:8px">${avEl(r,26)}<div><div style="font-size:12px;font-weight:600">${r.name}</div><div style="font-size:11px;color:var(--text3)">No check-out recorded</div></div></div><span class="badge b-amber">Pending</span></div>`)
  ];
  document.getElementById('exceptions').innerHTML=exc.join('');
}

// ── LEAVE TABS ──────────────────────────────────────────────────────────────
function switchLeaveTab(el,id){
  document.querySelectorAll('.l-tab').forEach(t=>t.classList.remove('active'));el.classList.add('active');
  ['leave-pending','leave-approved','leave-holidays'].forEach(t=>{document.getElementById(t).style.display='none'});
  document.getElementById(id).style.display='block';
}

// ── SETTINGS TABS ──────────────────────────────────────────────────────────
function switchSettingsTab(el,id){
  document.querySelectorAll('.s-nav-item').forEach(n=>n.classList.remove('active'));el.classList.add('active');
  ['sOrg','sShifts','sDepts','sAttendance','sUsers','sNotif'].forEach(t=>{const el=document.getElementById(t);if(el)el.style.display='none'});
  document.getElementById(id).style.display='block';
}

// ── REPORT PREVIEW ──────────────────────────────────────────────────────────
function showReportPreview(){
  const type=document.getElementById('rptType').value;
  const from=document.getElementById('rptFrom').value||'2026-10-22';
  const to=document.getElementById('rptTo').value||today();
  const rows=liveData.slice(0,20);
  document.getElementById('reportPreview').innerHTML=`
    <div style="border-bottom:1px solid var(--gray200);padding-bottom:12px;margin-bottom:14px">
      <div style="font-size:16px;font-weight:700;text-align:center">Al-Rehman Industries Ltd.</div>
      <div style="text-align:center;color:var(--text2);font-size:13px;margin-top:4px">${type}</div>
      <div style="text-align:center;font-size:11px;color:var(--text3);margin-top:2px">Period: ${from} to ${to} · Generated: ${new Date().toLocaleString()}</div>
    </div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>ID</th><th>Name</th><th>Dept</th><th>Check-in</th><th>Check-out</th><th>Status</th></tr></thead>
      <tbody>${rows.map(r=>`<tr><td style="font-size:11px;font-family:monospace">${r.id}</td><td>${r.name}</td><td style="font-size:11px">${r.dept}</td><td>${r.cin}</td><td>${r.cout}</td><td>${statusBadge(r.status)}</td></tr>`).join('')}</tbody>
    </table></div>
    <div style="margin-top:12px;padding:10px;background:var(--gray50);border-radius:6px;display:flex;gap:20px;font-size:12px">
      <span>✅ Present: <strong>${rows.filter(r=>r.status==='Present'||r.status==='Early Arrival').length}</strong></span>
      <span>⏰ Late: <strong>${rows.filter(r=>r.status==='Late').length}</strong></span>
      <span>❌ Absent: <strong>${rows.filter(r=>r.status==='Absent').length}</strong></span>
      <span>🏖 Leave: <strong>${rows.filter(r=>r.status==='On Leave').length}</strong></span>
    </div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn btn-primary btn-sm" onclick="window.print()">🖨 Print Report</button>
      <button class="btn btn-outline btn-sm" onclick="alert('Export to Excel requires backend integration')">📊 Export Excel</button>
      <button class="btn btn-outline btn-sm" onclick="alert('Export to PDF requires backend integration')">📄 Export PDF</button>
    </div>`;
  // Prep print layout
  document.getElementById('printTitle').textContent=type;
  document.getElementById('printMeta').textContent=`Period: ${from} to ${to} · Generated: ${new Date().toLocaleString()}`;
  document.getElementById('printTbody').innerHTML=liveData.slice(0,30).map(r=>`<tr><td style="border:1px solid #ddd;padding:5px">${r.id}</td><td style="border:1px solid #ddd;padding:5px">${r.name}</td><td style="border:1px solid #ddd;padding:5px">${r.dept}</td><td style="border:1px solid #ddd;padding:5px">${r.cin}</td><td style="border:1px solid #ddd;padding:5px">${r.cout}</td><td style="border:1px solid #ddd;padding:5px">${r.wh||'—'}</td><td style="border:1px solid #ddd;padding:5px">${r.status}</td></tr>`).join('');
}

// ── GLOBAL SEARCH ──────────────────────────────────────────────────────────
function globalSearch(v){
  const employeeSearch=document.getElementById('empSearch');
  if(employeeSearch)employeeSearch.value=v;
  // A top-bar name search should not be silently blocked by an older department/status selection.
  const dept=document.getElementById('empDept'),status=document.getElementById('empStatus');
  if(dept)dept.value='';if(status)status.value='';
  empPage=1;
  if(v.trim())showScreen('employees',document.querySelector('[data-screen=employees]'));
  else renderEmployees();
}

// ── INIT ──────────────────────────────────────────────────────────────────
document.getElementById('liveDate').value=today();
setDefaultDates();
buildDashboard();
renderLive();
renderEmployees();

// ── DATA-BACKED UI OVERRIDES ─────────────────────────────────────────────────
function statusBadge(s){
  const m={'Present':'b-green','Late':'b-amber','Absent':'b-red','On Leave':'b-purple','Early Arrival':'b-blue','Pending Check-out':'b-gray','Missing Check-in':'b-red','Not Checked In':'b-gray'};
  return `<span class="badge ${m[s]||'b-gray'}">${escapeHtml(s||'Unknown')}</span>`;
}
function buildDashboard(){
  const tbody=document.getElementById('deptSummaryBody');
  if(tbody && currentDashboard?.departments){
    tbody.innerHTML=currentDashboard.departments.map(d=>`<tr><td>${escapeHtml(d.department||'Unassigned')}</td><td>${d.total||0}</td><td style="color:#10b981;font-weight:600">${d.present||0}</td><td style="color:#ef4444;font-weight:600">${d.absent||0}</td></tr>`).join('')||'<tr><td colspan="4">No department data</td></tr>';
  }
  const recent=document.getElementById('recentActivity');
  if(recent){
    const rows=recentPunches.length?recentPunches.slice().sort((a,b)=>String(b.happened_at).localeCompare(String(a.happened_at))).slice(0,8).map(p=>{
      const kind=String(p.kind||'CHECK').toUpperCase();
      const employee=employees.find(e=>String(e.dbId)===String(p.employee_id))||{};
      const name=p.name||employee.name||p.badge_number||'Unmapped employee';
      const dept=p.department||employee.dept||'Unassigned';
      return `<tr><td><div style="display:flex;align-items:center;gap:6px">${avEl({color:employee.color||COLORS[0],name},24)}<span>${escapeHtml(name)}</span></div></td><td><span class="badge b-blue" style="font-size:10px">${escapeHtml(kind)}</span></td><td style="font-family:monospace;font-size:12px">${showTime(p.happened_at)}</td><td style="font-size:12px">${escapeHtml(dept)}</td><td>${statusBadge(kind==='IN'?'Present':kind==='OUT'?'Present':'Recorded')}</td></tr>`;
    }):liveData.filter(r=>r.cin!=='—').slice(0,8).map(r=>`<tr><td><div style="display:flex;align-items:center;gap:6px">${avEl(r,24)}<span>${escapeHtml(r.name)}</span></div></td><td><span class="badge b-blue" style="font-size:10px">CHECK-IN</span></td><td style="font-family:monospace;font-size:12px">${escapeHtml(r.cin)}</td><td style="font-size:12px">${escapeHtml(r.dept)}</td><td>${statusBadge(r.status)}</td></tr>`);
    recent.innerHTML=rows.join('')||'<tr><td colspan="5" style="color:var(--text3)">No attendance punches for this date.</td></tr>';
  }
  const exc=document.getElementById('exceptions');
  if(exc){
    const rows=[...liveData.filter(r=>r.status==='Absent').slice(0,2).map(r=>({r,label:'Absent',cls:'b-red',desc:r.dept})),
      ...liveData.filter(r=>r.status==='Late').slice(0,2).map(r=>({r,label:'Late',cls:'b-amber',desc:r.lateStr+' late'})),
      ...liveData.filter(r=>r.status==='Missing Check-in'||r.status==='Not Checked In').slice(0,2).map(r=>({r,label:'Unconfirmed',cls:'b-gray',desc:'No confirmed attendance'}))];
    exc.innerHTML=rows.map(({r,label,cls,desc})=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--gray100)"><div style="display:flex;align-items:center;gap:8px">${avEl(r,26)}<div><div style="font-size:12px;font-weight:600">${escapeHtml(r.name)}</div><div style="font-size:11px;color:var(--text3)">${escapeHtml(desc||r.dept)}</div></div></div><span class="badge ${cls}">${label}</span></div>`).join('')||'<div style="color:var(--text3);font-size:12px">No attendance exceptions.</div>';
  }
  updateDonut();
}
async function renderRecords(){
  await loadHistoryForRange(false);
  const dept=document.getElementById('recDept').value;
  const status=document.getElementById('recStatus').value;
  const from=document.getElementById('recFrom').value;
  const to=document.getElementById('recTo').value;
  const data=recData.filter(r=>(!from||r.date>=from)&&(!to||r.date<=to)&&(!dept||r.dept===dept)&&(!status||r.status===status));
  const pp=15,total=data.length,pages=Math.ceil(total/pp)||1;
  if(recPage>pages)recPage=1;
  const slice=data.slice((recPage-1)*pp,recPage*pp);
  document.getElementById('recTbody').innerHTML=slice.map(r=>`<tr><td style="font-size:12px">${escapeHtml(r.date)}</td><td><div style="display:flex;align-items:center;gap:6px">${avEl({color:COLORS[Math.max(0,employees.findIndex(e=>e.id===r.id))%COLORS.length],name:r.name},24)}<span>${escapeHtml(r.name)}</span></div></td><td>${escapeHtml(r.dept)}</td><td>${escapeHtml(r.schedIn||'—')}</td><td style="color:${r.cin==='—'?'var(--text3)':'var(--text)'}">${escapeHtml(r.cin)}</td><td>${escapeHtml(r.schedOut||'—')}</td><td style="color:${r.cout==='Pending'?'var(--amber)':r.cout==='—'?'var(--text3)':'var(--text)'}">${escapeHtml(r.cout)}</td><td style="font-weight:500">${escapeHtml(r.wh||'—')}</td><td style="color:${r.late!=='—'?'var(--red)':'var(--green)'}">${escapeHtml(r.late||'—')}</td><td>${escapeHtml(r.earlyDep||'—')}</td><td>${escapeHtml(r.ot||'—')}</td><td>${statusBadge(r.status)}</td></tr>`).join('')||'<tr><td colspan="12" style="color:var(--text3);text-align:center;padding:22px">No records match this date range.</td></tr>';
  renderPag('recPag',recPage,pages,total,pp,p=>{recPage=p;renderRecords()});
}
async function showReportPreview(){
  const type=document.getElementById('rptType').value;
  const from=document.getElementById('rptFrom').value||document.getElementById('recFrom').value||currentDataDate||today();
  const to=document.getElementById('rptTo').value||from;
  let rows=[];
  try {
    const q=new URLSearchParams({from,to});
    const result=await apiJSON('/api/attendance/history?'+q.toString());
    rows=(result.items||[]).map(r=>{
      const emp=employees.find(e=>String(e.dbId)===String(r.employee_id));
      const cin=showTime(r.clock_in),cout=showTime(r.clock_out),mins=Number(r.work_minutes||0);
      return {date:r.work_date,id:String(r.badge_number||r.device_user_id||emp?.id||r.employee_id),name:r.name||emp?.name||'Unknown',dept:r.department||emp?.dept||'Unassigned',cin,cout:cout==='—'&&cin!=='—'?'Pending':cout,wh:mins>0?`${Math.floor(mins/60)}h ${mins%60}m`:'—',status:titleStatus(r.status)};
    });
  } catch(e) { alert('Report data load nahi hua: '+e.message); return; }
  currentReportRows=rows;
  const shown=rows.slice(0,100);
  document.getElementById('reportPreview').innerHTML=`<div style="border-bottom:1px solid var(--gray200);padding-bottom:12px;margin-bottom:14px"><div style="font-size:16px;font-weight:700;text-align:center">AttendPro — Attendance Report</div><div style="text-align:center;color:var(--text2);font-size:13px;margin-top:4px">${escapeHtml(type)}</div><div style="text-align:center;font-size:11px;color:var(--text3);margin-top:2px">Period: ${escapeHtml(from)} to ${escapeHtml(to)} · Generated: ${new Date().toLocaleString()}</div></div><div class="tbl-wrap"><table><thead><tr><th>ID</th><th>Name</th><th>Dept</th><th>Check-in</th><th>Check-out</th><th>Status</th></tr></thead><tbody>${shown.map(r=>`<tr><td style="font-size:11px;font-family:monospace">${escapeHtml(r.id)}</td><td>${escapeHtml(r.name)}</td><td style="font-size:11px">${escapeHtml(r.dept)}</td><td>${escapeHtml(r.cin)}</td><td>${escapeHtml(r.cout)}</td><td>${statusBadge(r.status)}</td></tr>`).join('')}</tbody></table></div><div style="margin-top:12px;padding:10px;background:var(--gray50);border-radius:6px;display:flex;gap:20px;flex-wrap:wrap;font-size:12px"><span>Records: <strong>${rows.length}</strong></span><span>Present: <strong>${rows.filter(r=>r.status==='Present'||r.status==='Early Arrival').length}</strong></span><span>Late: <strong>${rows.filter(r=>r.status==='Late').length}</strong></span><span>Absent: <strong>${rows.filter(r=>r.status==='Absent').length}</strong></span></div><div style="display:flex;gap:8px;margin-top:14px"><button class="btn btn-primary btn-sm" onclick="window.print()">🖨 Print Report</button><button class="btn btn-outline btn-sm" onclick="downloadReportCsv()">📊 Export CSV</button></div>`;
  document.getElementById('printTitle').textContent=type;
  document.getElementById('printMeta').textContent=`Period: ${from} to ${to} · Generated: ${new Date().toLocaleString()}`;
  document.getElementById('printTbody').innerHTML=shown.map(r=>`<tr><td style="border:1px solid #ddd;padding:5px">${escapeHtml(r.id)}</td><td style="border:1px solid #ddd;padding:5px">${escapeHtml(r.name)}</td><td style="border:1px solid #ddd;padding:5px">${escapeHtml(r.dept)}</td><td style="border:1px solid #ddd;padding:5px">${escapeHtml(r.cin)}</td><td style="border:1px solid #ddd;padding:5px">${escapeHtml(r.cout)}</td><td style="border:1px solid #ddd;padding:5px">${escapeHtml(r.wh||'—')}</td><td style="border:1px solid #ddd;padding:5px">${escapeHtml(r.status)}</td></tr>`).join('');
}
function downloadReportCsv(){
  const rows=currentReportRows||[];
  if(!rows.length){alert('Pehle report preview generate karein.');return;}
  const fields=['date','id','name','dept','cin','cout','wh','status'];
  const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const csv=[fields.join(','),...rows.map(r=>fields.map(k=>quote(r[k])).join(','))].join('\r\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`attendpro-report-${document.getElementById('rptFrom').value||currentDataDate||today()}.csv`;a.click();URL.revokeObjectURL(url);
}
function toggleTheme(){
  const on=document.body.classList.toggle('dark-mode');
  localStorage.setItem('attendpro-theme',on?'dark':'light');
  const btn=document.getElementById('themeToggle');if(btn){btn.textContent=on?'☀️':'🌙';btn.title=on?'Switch to light mode':'Switch to dark mode';}
}
function initTheme(){
  const on=localStorage.getItem('attendpro-theme')==='dark';
  document.body.classList.toggle('dark-mode',on);
  const btn=document.getElementById('themeToggle');if(btn){btn.textContent=on?'☀️':'🌙';btn.title=on?'Switch to light mode':'Switch to dark mode';}
}
// ── REQUESTED MULTI-DEVICE, USER ROLES, RECORD EDITOR & EXCEL TEMPLATE ────────
let currentUser = null;
let currentEditRecord = null;
let expandedRecordKey = '';
let userCache = [];

function roleAllowed(permission) {
  const role=currentUser?.role||'';
  if(permission==='super_admin')return role==='super_admin';
  if(permission==='attendance_edit')return role==='supervisor'||role==='super_admin';
  if(permission==='view_only')return ['view_only','supervisor','super_admin'].includes(role);
  return true;
}
function applyPermissions() {
  document.querySelectorAll('[data-permission]').forEach(el=>el.classList.toggle('role-hidden',!roleAllowed(el.dataset.permission)));
  const name=currentUser?.display_name||'AttendPro User';
  const roleName=({view_only:'View Only User',supervisor:'Supervisor',super_admin:'Super Admin'})[currentUser?.role]||'User';
  const sn=document.getElementById('sidebarUserName'),sr=document.getElementById('sidebarUserRole'),av=document.getElementById('userAvatar');
  if(sn)sn.textContent=name;if(sr)sr.textContent=roleName;if(av)av.textContent=name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
}
async function initAuth() {
  initSidebar();
  try {
    const result=await apiJSON('/api/auth/status');
    if(result.authenticated){currentUser=result.user;document.getElementById('loginOverlay').classList.remove('open');applyPermissions();await loadRealData(true);}
    else document.getElementById('loginOverlay').classList.add('open');
  } catch(e) { document.getElementById('loginOverlay').classList.add('open'); }
}
async function loginUser(event) {
  if(event)event.preventDefault();
  const error=document.getElementById('loginError');error.style.display='none';
  try {
    const result=await apiJSON('/api/auth/login',{method:'POST',body:JSON.stringify({username:document.getElementById('loginUsername').value.trim(),password:document.getElementById('loginPassword').value})});
    currentUser=result.user;document.getElementById('loginOverlay').classList.remove('open');document.getElementById('loginPassword').value='';applyPermissions();await loadRealData(true);
  } catch(e) {error.textContent=e.message||'Login fail ho gaya.';error.style.display='block';}
}
async function logoutUser() {
  if(!currentUser)return;
  if(!confirm('Logout karna hai?'))return;
  try{await apiJSON('/api/auth/logout',{method:'POST'});}catch(_){}
  currentUser=null;document.getElementById('loginOverlay').classList.add('open');applyPermissions();
}
async function changeMyPassword() {
  const current=document.getElementById('currentPassword').value,newPass=document.getElementById('newPassword').value;
  try{const r=await apiJSON('/api/auth/change-password',{method:'POST',body:JSON.stringify({current_password:current,new_password:newPass})});alert(r.message||'Password update ho gaya.');document.getElementById('currentPassword').value='';document.getElementById('newPassword').value='';}
  catch(e){alert(e.message);}
}
function initSidebar() {
  const savedWidth=parseInt(localStorage.getItem('attendpro-sidebar-width')||'240',10);
  const width=Math.max(180,Math.min(Math.max(180,Math.floor(window.innerWidth*0.5)),Number.isFinite(savedWidth)?savedWidth:240));
  document.body.style.setProperty('--sidebar-w',width+'px');
  if(localStorage.getItem('attendpro-sidebar')==='collapsed'){
    document.body.classList.add('sidebar-collapsed');
    document.body.style.setProperty('--sidebar-w','72px');
  }
  if(localStorage.getItem('attendpro-workspace')==='expanded')document.body.classList.add('sidebar-hidden');
  updateWorkspaceToggle();
  initSidebarResizer();
}
function toggleSidebar() {
  // The menu icon always makes navigation available, including from full-workspace mode.
  if(document.body.classList.contains('sidebar-hidden')){
    document.body.classList.remove('sidebar-hidden');
    localStorage.setItem('attendpro-workspace','normal');
    updateWorkspaceToggle();
    return;
  }
  const collapsed=document.body.classList.contains('sidebar-collapsed');
  if(collapsed){
    document.body.classList.remove('sidebar-collapsed');
    const savedWidth=parseInt(localStorage.getItem('attendpro-sidebar-width')||'240',10);
    document.body.style.setProperty('--sidebar-w',Math.max(180,Math.min(Math.max(180,Math.floor(window.innerWidth*0.5)),Number.isFinite(savedWidth)?savedWidth:240))+'px');
    localStorage.setItem('attendpro-sidebar','expanded');
  }else{
    const current=parseInt(getComputedStyle(document.body).getPropertyValue('--sidebar-w'),10)||240;
    if(current>72)localStorage.setItem('attendpro-sidebar-width',String(current));
    document.body.classList.add('sidebar-collapsed');
    document.body.style.setProperty('--sidebar-w','72px');
    localStorage.setItem('attendpro-sidebar','collapsed');
  }
}
function updateWorkspaceToggle(){
  const btn=document.getElementById('workspaceToggle');if(!btn)return;
  const expanded=document.body.classList.contains('sidebar-hidden');
  btn.textContent=expanded?'▣':'⛶';
  btn.title=expanded?'Restore blue menu':'Expand white workspace';
  btn.setAttribute('aria-label',btn.title);
}
function toggleWorkspace(){
  const expanded=document.body.classList.toggle('sidebar-hidden');
  localStorage.setItem('attendpro-workspace',expanded?'expanded':'normal');
  updateWorkspaceToggle();
}
function initSidebarResizer(){
  const handle=document.getElementById('sidebarResizer');if(!handle||handle.dataset.ready)return;handle.dataset.ready='1';
  let startX=0,startWidth=240,dragging=false;
  handle.addEventListener('pointerdown',event=>{
    if(document.body.classList.contains('sidebar-hidden'))return;
    dragging=true;startX=event.clientX;
    startWidth=document.body.classList.contains('sidebar-collapsed')?72:(parseInt(getComputedStyle(document.body).getPropertyValue('--sidebar-w'),10)||240);
    document.body.classList.remove('sidebar-collapsed');
    document.body.classList.add('is-resizing');handle.classList.add('dragging');
    try{handle.setPointerCapture(event.pointerId)}catch(_){}
    event.preventDefault();
  });
  handle.addEventListener('pointermove',event=>{
    if(!dragging)return;
    const width=Math.max(180,Math.min(Math.max(180,Math.floor(window.innerWidth*0.5)),startWidth+(event.clientX-startX)));
    document.body.style.setProperty('--sidebar-w',width+'px');
    localStorage.setItem('attendpro-sidebar-width',String(Math.round(width)));
    localStorage.setItem('attendpro-sidebar','expanded');
  });
  const stop=()=>{if(!dragging)return;dragging=false;document.body.classList.remove('is-resizing');handle.classList.remove('dragging');};
  handle.addEventListener('pointerup',stop);handle.addEventListener('pointercancel',stop);
  handle.addEventListener('dblclick',()=>{
    document.body.classList.remove('sidebar-collapsed');document.body.style.setProperty('--sidebar-w','240px');
    localStorage.setItem('attendpro-sidebar-width','240');localStorage.setItem('attendpro-sidebar','expanded');
  });
}
function deviceStatusText(d) {
  const status=String(d?.status||'not_configured');
  if(status==='online')return 'Online';if(status==='tested')return 'Test successful';if(status==='not_configured')return 'Not configured';
  if(status==='missing_file')return 'MDB file missing';if(status==='stale_source')return 'Source not recently updated';if(status==='error')return 'Connection error';
  return status.replaceAll('_',' ');
}
function deviceInfoText(d) {
  return `Device: ${d?.name||'Unknown'}\nModel: ${d?.model||'—'}\nSerial: ${d?.serial_number||'—'}\nStatus: ${deviceStatusText(d)}\nMDB path: ${d?.path||'Not configured'}\nLast sync: ${d?.last_sync||'Never'}\nEvents scanned: ${d?.last_fetched??0}\nNew punches saved: ${d?.last_inserted??0}\n\nNote: MDB source read-only hai.`;
}
function showDeviceInfo(id) {
  const d=(currentSettings.devices||[]).find(x=>String(x.id)===String(id))||currentSettings.device;
  alert(deviceInfoText(d));
}
function renderDeviceUI(devices,activeId) {
  devices=Array.isArray(devices)?devices:[];activeId=activeId??currentSettings.active_device_id;
  const sidebar=document.getElementById('deviceNavList');
  if(sidebar)sidebar.innerHTML=devices.map(d=>`<div class="nav-item device-nav-item ${String(d.id)===String(activeId)?'active':''}" data-status="${escapeHtml(d.status||'not_configured')}" title="${escapeHtml(d.name)} — ${escapeHtml(deviceStatusText(d))}" onclick="handleDeviceNav(${Number(d.id)})"><span class="device-nav-dot"></span><span class="nav-label">${escapeHtml(d.name)}</span></div>`).join('');
  const dashboard=document.getElementById('dashboardDevices');
  if(dashboard)dashboard.innerHTML=devices.map(d=>`<div class="device-mini-card"><div class="device-mini-icon">👁</div><div class="device-mini-info"><div class="device-mini-name">${escapeHtml(d.name)}</div><div class="device-mini-model">${escapeHtml(d.model||'ZKTeco biometric terminal')}</div><div class="device-mini-state ${d.status==='online'?'online':''}">● ${escapeHtml(deviceStatusText(d))}</div></div><div class="device-mini-actions"><button onclick="showDeviceInfo(${Number(d.id)})" title="Device information">ⓘ Info</button><button data-permission="super_admin" onclick="selectDevice(${Number(d.id)},true)">${String(d.id)===String(activeId)?'Selected':'Switch'}</button></div></div>`).join('')||'<div class="card">No devices added yet.</div>';
  const cardHTML=devices.map(d=>`<div class="device-list-item ${String(d.id)===String(activeId)?'selected':''}"><div class="device-list-head"><div><div class="device-list-title">👁 ${escapeHtml(d.name)}</div><div class="device-list-sub">${escapeHtml(d.model||'ZKTeco')} · S/N: ${escapeHtml(d.serial_number||'—')}</div><div class="device-list-sub">Status: <strong>${escapeHtml(deviceStatusText(d))}</strong></div><div class="device-list-sub" title="${escapeHtml(d.path||'')}" style="overflow-wrap:anywhere">${escapeHtml(d.path||'MDB path not configured')}</div></div><button class="device-info-btn" onclick="showDeviceInfo(${Number(d.id)})" title="Device information">i</button></div><div class="device-list-actions"><button class="btn btn-primary btn-sm" data-permission="super_admin" onclick="selectDevice(${Number(d.id)},true)">${String(d.id)===String(activeId)?'Selected Device':'Switch Device'}</button><button class="btn btn-outline btn-sm" onclick="showDeviceInfo(${Number(d.id)})">ⓘ Info</button><button class="btn btn-outline btn-sm" data-permission="super_admin" onclick="editDevice(${Number(d.id)})">Edit</button><button class="btn btn-outline btn-sm" data-permission="super_admin" onclick="testSpecificDevice(${Number(d.id)})">Test MDB</button><button class="btn btn-outline btn-sm" data-permission="super_admin" onclick="syncSpecificDevice(${Number(d.id)})">Sync Now</button><button class="btn btn-red btn-sm" data-permission="super_admin" onclick="deleteDevice(${Number(d.id)})">Delete</button></div></div>`).join('')||'<div class="access-help">Abhi koi device configure nahi hai.</div>';
  const deviceCards=document.getElementById('deviceCards');if(deviceCards)deviceCards.innerHTML=cardHTML;
  const settingsCards=document.getElementById('settingsDeviceCards');if(settingsCards)settingsCards.innerHTML=cardHTML;
  document.querySelectorAll('#dashboardDevices [data-permission],#deviceCards [data-permission],#settingsDeviceCards [data-permission]').forEach(el=>el.classList.toggle('role-hidden',!roleAllowed(el.dataset.permission)));
  const active=devices.find(d=>String(d.id)===String(activeId))||currentSettings.device;
  if(active){
    const nm=document.getElementById('activeDeviceName'),model=document.getElementById('activeDeviceModel');
    if(nm)nm.textContent=active.name||'ZKTeco uFace 800';if(model)model.textContent=`${active.model||'ZKTeco biometric terminal'} — S/N: ${active.serial_number||'Not configured'}`;
    const dot=document.querySelector('#screen-device .status-dot');if(dot){dot.classList.toggle('status-pending',active.status!=='online');dot.textContent=(active.status==='online'?'🟢 ':'⏳ ')+deviceStatusText(active);}
  }
  applyPermissions();
}
function handleDeviceNav(id) {
  if(currentUser?.role==='super_admin')selectDevice(id,true);
  else {showScreen('device',document.querySelector('[data-screen="device"]'));showDeviceInfo(id);}
}
async function selectDevice(id,openScreen=false) {
  if(!roleAllowed('super_admin')){showDeviceInfo(id);return;}
  try{
    const r=await apiJSON(`/api/devices/${id}/select`,{method:'POST'});
    currentSettings.devices=r.devices?.items||r.devices||currentSettings.devices;currentSettings.active_device_id=id;
    await loadAccessSettings();renderDeviceUI(currentSettings.devices,id);
    if(openScreen)showScreen('device',document.querySelector('[data-screen="device"]'));
    await loadRealData(true);
  }catch(e){alert('Device switch nahi hua: '+e.message);}
}
function toggleAddDeviceForm(force) {
  const form=document.getElementById('addDeviceForm');if(!form)return;
  form.style.display=force===true?'block':force===false?'none':form.style.display==='none'?'block':'none';
}
async function createDevice() {
  const body={name:document.getElementById('newDeviceName').value.trim(),model:document.getElementById('newDeviceModel').value.trim(),serial_number:document.getElementById('newDeviceSerial').value.trim(),mdb_path:document.getElementById('newDevicePath').value.trim(),sync_interval:Number(document.getElementById('newDeviceInterval').value||90),auto_sync:false};
  try{
    const r=await apiJSON('/api/devices',{method:'POST',body:JSON.stringify(body)});
    const id=r.device.id;toggleAddDeviceForm(false);['newDeviceName','newDeviceSerial','newDevicePath'].forEach(x=>document.getElementById(x).value='');
    await selectDevice(id,true);alert('Device add ho gaya. Ab is device ka MDB path Test MDB se verify karein.');
  }catch(e){alert('Device add nahi hua: '+e.message);}
}
async function editDevice(id) {
  const d=(currentSettings.devices||[]).find(x=>String(x.id)===String(id));if(!d)return;
  const name=prompt('Device name',d.name);if(name===null)return;
  const model=prompt('Device model',d.model||'ZKTeco uFace 800');if(model===null)return;
  const path=prompt('Full .mdb file path (blank to clear)',d.path||'');if(path===null)return;
  try{await apiJSON(`/api/devices/${id}`,{method:'PUT',body:JSON.stringify({name,model,mdb_path:path})});await loadAccessSettings();await loadRealData(true);}
  catch(e){alert('Device update nahi hua: '+e.message);}
}
async function deleteDevice(id) {
  const d=(currentSettings.devices||[]).find(x=>String(x.id)===String(id));if(!d||!confirm(`${d.name} delete karna hai? Attendance records delete nahi honge.`))return;
  try{await apiJSON(`/api/devices/${id}`,{method:'DELETE'});await loadAccessSettings();await loadRealData(true);}
  catch(e){alert('Device delete nahi hua: '+e.message);}
}
async function testSpecificDevice(id) {
  try{const r=await apiJSON(`/api/devices/${id}/test`,{method:'POST'});await loadAccessSettings();alert((r.success?'SUCCESS: ':'ERROR: ')+(r.message||'Test complete'));}
  catch(e){alert('MDB test fail: '+e.message);}
}
async function syncSpecificDevice(id) {
  try{const r=await apiJSON(`/api/devices/${id}/sync`,{method:'POST'});await loadAccessSettings();await loadRealData(true);alert((r.success?'Sync complete: ':'Sync failed: ')+(r.message||JSON.stringify(r)));}
  catch(e){alert('Sync error: '+e.message);}
}
async function loadAccessSettings(showError=false) {
  try {
    currentSettings=await apiJSON('/api/settings');
    const path=document.getElementById('accessPath');if(path&&!path.matches(':focus'))path.value=currentSettings.access_path||'';
    const auto=document.getElementById('accessAuto');if(auto)auto.checked=!!currentSettings.access_auto;
    const interval=document.getElementById('accessInterval');if(interval)interval.value=currentSettings.access_interval||90;
    const dev=currentSettings.device||{};
    const badge=document.getElementById('accessStatus');if(badge)badge.textContent=dev.status==='online'?'MDB connected':dev.status==='error'?'MDB error':dev.status==='missing_file'?'MDB file missing':dev.configured?'Configured — not tested':'Not configured';
    const boxes=document.querySelectorAll('#screen-device .metric-box');
    if(boxes[0]){boxes[0].querySelector('.metric-val').textContent=dev.configured?'MDB':'—';boxes[0].querySelector('.metric-lbl').textContent='Connection Method';boxes[0].lastElementChild.textContent='Read-only Access database';}
    if(boxes[1]){boxes[1].querySelector('.metric-val').textContent=dev.last_sync?showTime(dev.last_sync):'—';boxes[1].querySelector('.metric-lbl').textContent='Last Sync';boxes[1].lastElementChild.textContent=dev.last_sync||'No successful sync yet';}
    if(boxes[2]){boxes[2].querySelector('.metric-val').textContent=dev.last_fetched??0;boxes[2].querySelector('.metric-lbl').textContent='Events Scanned';boxes[2].lastElementChild.textContent=`New punches saved: ${dev.last_inserted??0}`;}
    renderDeviceUI(currentSettings.devices||[],currentSettings.active_device_id);
    await loadSyncHistory();return currentSettings;
  } catch(e){if(showError)alert('Settings load nahi ho sakin: '+e.message);return null;}
}
async function saveAccessSettings(quiet=false) {
  try{
    const body={access_path:document.getElementById('accessPath').value.trim(),access_auto:document.getElementById('accessAuto').checked,access_interval:Number(document.getElementById('accessInterval').value||90)};
    currentSettings=await apiJSON('/api/settings',{method:'PUT',body:JSON.stringify(body)});await loadAccessSettings();
    if(!quiet)alert('Database settings save ho gayi hain.');return true;
  }catch(e){alert('Settings save nahi hui: '+e.message);return false;}
}
async function testAccessDB() {
  if(!await saveAccessSettings(true))return;
  try{const r=await apiJSON('/api/database/test',{method:'POST'});await loadAccessSettings();alert((r.success?'SUCCESS: ':'ERROR: ')+(r.message||'Test complete'));}
  catch(e){alert('MDB test fail: '+e.message);}
}
async function syncAccessDB() {
  if(!await saveAccessSettings(true))return;
  try{const r=await apiJSON('/api/database/sync?force=true',{method:'POST'});await loadAccessSettings();await loadRealData(true);alert((r.success?'Sync complete: ':'Sync failed: ')+(r.message||JSON.stringify(r)));}
  catch(e){alert('Sync error: '+e.message);}
}
function showScreen(name,el) {
  document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
  const target=document.getElementById('screen-'+name);if(target)target.classList.add('active');if(el)el.classList.add('active');
  if(name==='live')renderLive();
  if(name==='employees')renderEmployees();
  if(name==='records'){if(!document.getElementById('recFrom').value)setDefaultDates();renderRecords();}
  if(name==='device'){loadAccessSettings();}
  if(name==='settings'){loadAccessSettings();}
  if(name==='users')loadUsers();
  renderDeviceUI(currentSettings.devices||[],currentSettings.active_device_id);
}
function switchSettingsTab(el,id) {
  document.querySelectorAll('.s-nav-item').forEach(n=>n.classList.remove('active'));if(el)el.classList.add('active');
  ['sOrg','sShifts','sDepts','sAttendance','sUsers','sNotif','sDevices'].forEach(k=>{const panel=document.getElementById(k);if(panel)panel.style.display='none';});
  const panel=document.getElementById(id);if(panel)panel.style.display='block';
  if(id==='sDevices')renderDeviceUI(currentSettings.devices||[],currentSettings.active_device_id);
}
// People > Employees: A–Z by default. Every header can sort asc / desc.
function sortEmployees(key) {
  if(employeeSortKey===key) employeeSortDirection*=-1;
  else {employeeSortKey=key;employeeSortDirection=1;}
  empPage=1;renderEmployees();
}
function employeeCompare(a,b,key){
  const v=x=>String(x?.[key]??'').trim();
  return v(a).localeCompare(v(b),undefined,{numeric:true,sensitivity:'base'}) || a.name.localeCompare(b.name,undefined,{sensitivity:'base'});
}
// The source Name field sometimes contains police rank/job codes and badge numbers.
// Clean them ONLY for display and alphabetic sorting; original MDB/SQLite values stay intact.
function displayEmployeeName(sourceName) {
  // Purely visual transformation. Preserve the exact source Name, employee ID,
  // and device mapping in the database. Rank and service identifiers appear in
  // this client's Name field, not just in the badge_number column.
  const source=String(sourceName||'').trim().replace(/\s+/g,' ');
  let name=source;
  // Role/rank names seen in this client's actual 731-employee dataset.
  // Recognise only a prefix followed by a separator or number; never remove
  // a matching word from the middle of a person's real name.
  const role=/^(?:(?:B\s+L?CONS|D\s+CONS|M\s+CONS|L\s+CONS|S\s+CONS|BLCONS|BCONS|SCONS|LCONS|DCONS|D\.CONS|CONS|CON|HC|ASI|T\s*\/\s*SI|T\s*-\s*SI|SI|IP|IPL|TW|STW|LANGRI|LANNGRI|LAHGRI|LNAGRI|SWEEPER|SWEPER|SWEEPR|DHOBI|BARBER|BARBAR|BABAR|S\.?CLERK|C\.PAINTER|ASST|NAIB\s+QAS(?:A|I)D|NIAB|NQ|COMPOUNDER|MOOCHI|MASHKI|TAILOR|MALI|FITTER|ACNT|DAFTRI|JR|WATER\s+CR|STAINO|PS|DC|CD))(?=[\s.\-\/]|\d|$)/i;
  // Works with source forms like 'ASI- AMIR AZAM' and 'ASI-235 TAUSEEF HAIDER'.
  if(role.test(name)) {
    name=name.replace(role,'').replace(/^[\s.\-\/]+/,'');
    // Leading service number, including cases like '6414-L M.ARIF'.
    name=name.replace(/^\d{1,7}(?:[\/-][A-Z]{1,4})?\s*[-\s]*/i,'');
    // An occasional station/service code precedes the actual name.
    name=name.replace(/^(?:S|SA|KSR|LHR|BWP|DG)\s+\d{1,7}\s+/i,'');
    // Some records include a station code between the ID and the name.
    name=name.replace(/^(?:KSR|LHR|BWP|DG|SA)\s+(?=[A-Z])/i,'');
  }
  // Remove only clearly formatted trailing service numbers; allow ordinary
  // initials / surnames in names such as 'M. ABBAS' and 'G. MUSTAFA'.
  name=name.replace(/\s+\d{2,7}[A-Z]?(?:[-\/]\s*[A-Z]{1,4})?$/i,'')
           .replace(/(?<=[A-Za-z])\d{3,7}(?:[-\/]\s*[A-Z]{1,4})?$/i,'')
           .replace(/\s+[A-Z]{1,4}[-\/]\d{2,7}[A-Z]?$/i,'')
           .replace(/^[\s.\-\/]+/,'').trim();
  // Some source records contain only role/service text. Never show blank.
  return name || source || 'Unknown Employee';
}
function clearEmployeeFilters() {
  ['empSearch','empDept','empStatus','globalEmployeeSearch'].forEach(k=>{const el=document.getElementById(k);if(el)el.value='';});
  employeeSortKey='name';employeeSortDirection=1;empPage=1;expandedEmployeeId=null;
  renderEmployees();
}
function onEmployeeSearch() {
  const val=document.getElementById('empSearch')?.value||'';
  const top=document.getElementById('globalEmployeeSearch');if(top && top.value!==val)top.value=val;
  empPage=1;renderEmployees();
}
function renderEmployees() {
  const search=(document.getElementById('empSearch')?.value||'').trim().toLocaleLowerCase();
  const dept=document.getElementById('empDept')?.value||'';
  const status=document.getElementById('empStatus')?.value||'';
  // The list deliberately displays names only; internal IDs are retained for API requests.
  const data=employees.filter(e=>(!search||displayEmployeeName(e.name).toLocaleLowerCase().includes(search)||e.name.toLocaleLowerCase().includes(search))&&(!dept||e.dept===dept)&&(!status||e.status===status));
  data.sort((a,b)=>employeeSortDirection*(displayEmployeeName(a.name).localeCompare(displayEmployeeName(b.name),undefined,{sensitivity:'base',numeric:true}) || a.name.localeCompare(b.name,undefined,{sensitivity:'base',numeric:true})) || Number(a.dbId)-Number(b.dbId));
  const th=document.querySelector('#screen-employees .emp-sort-col');
  if(th){th.textContent=employeeSortDirection===1?'Employee Name A–Z ↑':'Employee Name Z–A ↓';th.setAttribute('aria-sort',employeeSortDirection===1?'ascending':'descending');}
  const pp=15,total=data.length,pages=Math.ceil(total/pp)||1;
  if(empPage>pages)empPage=1;
  const slice=data.slice((empPage-1)*pp,empPage*pp);
  const tbody=document.getElementById('empTbody');if(!tbody)return;
  tbody.innerHTML=slice.map(e=>{
    const opened=String(e.dbId)===String(expandedEmployeeId),id=Number(e.dbId),profile=employeeProfileCache.get(id);
    return `<tr class="emp-list-row"><td><button type="button" class="emp-name-trigger" data-emp-id="${id}" aria-expanded="${opened}" onclick="toggleEmployeeProfile(${id})">
      ${avEl({...e,name:displayEmployeeName(e.name)},32)}<span class="emp-name-text">${escapeHtml(displayEmployeeName(e.name))}</span><span class="emp-expand-chevron" aria-hidden="true">${opened?'▴':'▾'}</span>
    </button></td></tr>${opened?`<tr class="emp-profile-row"><td class="emp-profile-td">${employeeProfileHTML(e,profile)}</td></tr>`:''}`;
  }).join('')||`<tr><td class="emp-no-results">No employee names match your search or filters.<br><button class="btn btn-outline btn-sm" onclick="clearEmployeeFilters()">✕ Clear Filters — Show All Employees</button></td></tr>`;
  renderPag('empPag',empPage,pages,total,pp,p=>{empPage=p;renderEmployees();});
}

async function toggleEmployeeProfile(id){
  if(String(expandedEmployeeId)===String(id)){expandedEmployeeId=null;renderEmployees();return;}
  expandedEmployeeId=id;renderEmployees();
  if(employeeProfileCache.has(id))return;
  try {
    const data=await apiJSON(`/api/employee/${encodeURIComponent(id)}`);
    employeeProfileCache.set(id,data);
  } catch(e){employeeProfileCache.set(id,{error:e.message,history:[]});}
  if(String(expandedEmployeeId)===String(id))renderEmployees();
}
function employeeProfileHTML(e,data){
  if(!data)return '<div class="emp-profile-box" aria-live="polite">Loading employee profile and attendance history…</div>';
  if(data.error)return `<div class="emp-profile-box">Could not load profile: ${escapeHtml(data.error)}</div>`;
  const info=data.employee||{};
  // These are the nine relevant identity/profile fields from the available database.
  const fields=[['AC-No.',e.id],['Full Name',displayEmployeeName(e.name)],['Department',e.dept],
    ['Designation',e.designation||'Not provided'],['Shift',e.shift||'Not assigned'],
    ['Status',e.status],['Device User ID',info.device_user_id||e.deviceUserId||'Not mapped'],
    ['Source USERID',info.source_userid||e.sourceUserid||'Not mapped'],
    ['Last Updated',info.updated_at||'Not available']];
  const history=(data.history||[]).slice(0,15);
  return `<div class="emp-profile-box">
    <div class="emp-profile-top"><div><div class="emp-profile-title">👤 ${escapeHtml(displayEmployeeName(e.name))} — Employee Profile</div><div class="emp-profile-meta">Profile details & recent attendance</div></div>
    <div style="display:flex;gap:7px"><button class="btn btn-outline btn-sm" onclick="openEmployeeModalById(${Number(e.dbId)})">Open Profile Modal</button><button class="btn btn-outline btn-sm" onclick="toggleEmployeeProfile(${Number(e.dbId)})">✕ Close</button></div></div>
    <div class="emp-profile-fields">${fields.map(([label,value])=>`<div class="emp-profile-field"><label>${escapeHtml(label)}</label><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>
    <div class="emp-profile-history"><h4>Recent Attendance History (${(data.history||[]).length} stored days shown in API, latest 15 below)</h4>
    ${history.length?`<div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Clock In</th><th>Clock Out</th><th>Shift</th><th>Status</th><th>Late (min)</th></tr></thead><tbody>${history.map(h=>`<tr><td>${escapeHtml(h.work_date)}</td><td>${escapeHtml(showTime(h.clock_in))}</td><td>${escapeHtml(showTime(h.clock_out))}</td><td>${escapeHtml(h.shift||'—')}</td><td>${statusBadge(titleStatus(h.status))}</td><td>${Number(h.late_minutes||0)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="access-help">No attendance history has been stored for this employee.</div>'}
    </div></div>`;
}
function openEmployeeModalById(id){const e=employees.find(x=>String(x.dbId)===String(id));if(e)openEmpModal(e);}

function recordKey(r){return `${r.dbId||r.employee_id||r.id}|${r.date}`;}
function clearRecordFilters(){['recSearch','recDept','recStatus'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});setDefaultDates();renderRecords();}
function recordHistoryHTML(employeeId) {
  const rows=recData.filter(x=>String(x.dbId||x.employee_id)===String(employeeId)).slice().sort((a,b)=>b.date.localeCompare(a.date));
  if(!rows.length)return '<div class="record-detail-box">Is selected date range mein is employee ka aur record nahi mila.</div>';
  return `<div class="record-detail-box"><strong>Employee attendance history (selected date range)</strong><div class="tbl-wrap" style="margin-top:8px"><table><thead><tr><th>Date</th><th>Timetable</th><th>Clock In</th><th>Clock Out</th><th>Department</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${escapeHtml(x.date)}</td><td>${escapeHtml(x.timetable||'—')}</td><td>${escapeHtml(x.cin||'—')}</td><td>${escapeHtml(x.cout||'—')}</td><td>${escapeHtml(x.dept)}</td><td>${statusBadge(x.status)}</td><td><button class="btn btn-outline btn-sm" data-permission="attendance_edit" onclick='openAttendanceEditorByKey(${JSON.stringify(recordKey(x))})'>Review / Update</button></td></tr>`).join('')}</tbody></table></div></div>`;
}
function toggleRecordDetails(key) {expandedRecordKey=expandedRecordKey===key?'':key;renderRecords();}
// Attendance Records intentionally uses a flat table: profile dropdowns belong to People > Employees only.
async function renderRecords() {
  await loadHistoryForRange(false);
  const dept=document.getElementById('recDept')?.value||'',status=document.getElementById('recStatus')?.value||'';
  const from=document.getElementById('recFrom')?.value||'',to=document.getElementById('recTo')?.value||'';
  const search=(document.getElementById('recSearch')?.value||'').toLowerCase();
  const data=recData.filter(r=>(!from||r.date>=from)&&(!to||r.date<=to)&&(!dept||r.dept===dept)&&(!status||r.status===status)&&(!search||r.name.toLowerCase().includes(search)||String(r.id).toLowerCase().includes(search)));
  data.sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:'base'})||b.date.localeCompare(a.date));
  const pp=15,total=data.length,pages=Math.ceil(total/pp)||1;
  if(recPage>pages)recPage=1;
  const slice=data.slice((recPage-1)*pp,recPage*pp),canEdit=roleAllowed('attendance_edit');
  const tbody=document.getElementById('recTbody');if(!tbody)return;
  tbody.innerHTML=slice.map(r=>{
    const key=recordKey(r);
    return `<tr><td style="font-family:monospace;font-size:12px">${escapeHtml(r.id)}</td>
      <td><strong>${escapeHtml(r.name)}</strong></td><td>${escapeHtml(r.date)}</td>
      <td>${escapeHtml(r.timetable||r.schedIn||'—')}</td><td>${escapeHtml(r.cin||'—')}</td>
      <td>${escapeHtml(r.cout||'—')}</td><td>${escapeHtml(r.dept)}</td>
      <td>${statusBadge(r.status)}</td>
      <td>${canEdit?`<button class="btn btn-primary btn-sm" onclick='openAttendanceEditorByKey(${JSON.stringify(key)})'>Review / Update</button>`:'<span style="color:var(--text3);font-size:12px">View only</span>'}</td>
    </tr>`;
  }).join('')||'<tr><td colspan="9" style="color:var(--text3);text-align:center;padding:22px">No records match these filters.</td></tr>';
  renderPag('recPag',recPage,pages,total,pp,p=>{recPage=p;renderRecords();});
}
function openAttendanceEditorByKey(key) {
  const r=recData.find(x=>recordKey(x)===key);if(!r)return;
  if(!roleAllowed('attendance_edit')){alert('Aapka role attendance edit nahi kar sakta.');return;}
  currentEditRecord=r;
  document.getElementById('editEmployeeName').textContent=`${r.name} (${r.id})`;
  document.getElementById('editWorkDateLabel').textContent=r.date;
  document.getElementById('editShift').value=/^\d{2}:\d{2}$/.test(String(r.timetable||r.schedIn||''))?(r.timetable||r.schedIn):'09:00';
  document.getElementById('editClockIn').value=/^\d{2}:\d{2}$/.test(String(r.cin||''))?r.cin:'';
  document.getElementById('editClockOut').value=/^\d{2}:\d{2}$/.test(String(r.cout||''))?r.cout:'';
  const status=String(r.status||'').toLowerCase().replaceAll(' ','_');document.getElementById('editStatus').value=({ 'missing_check-in':'not_checked_in','missing_check_in':'not_checked_in','not_checked_in':'not_checked_in','on_leave':'on_leave','early_arrival':'early_arrival'})[status]||(['present','late','absent','on_leave','early_arrival','not_checked_in'].includes(status)?status:'present');
  document.getElementById('attendanceEditModal').classList.add('open');
}
function closeAttendanceEditor(){document.getElementById('attendanceEditModal').classList.remove('open');currentEditRecord=null;}
async function saveAttendanceEdit() {
  if(!currentEditRecord)return;
  const body={employee_id:currentEditRecord.dbId||currentEditRecord.employee_id,work_date:currentEditRecord.date,clock_in:document.getElementById('editClockIn').value,clock_out:document.getElementById('editClockOut').value,shift:document.getElementById('editShift').value||'09:00',status:document.getElementById('editStatus').value,action:'update'};
  try{const r=await apiJSON('/api/attendance/edit',{method:'PUT',body:JSON.stringify(body)});closeAttendanceEditor();alert(r.message||'Attendance update ho gayi.');await loadRealData(true);await loadHistoryForRange(false);renderRecords();}
  catch(e){alert('Attendance update nahi hui: '+e.message);}
}
async function quickAttendanceAction(action) {
  if(!currentEditRecord)return;
  try{const r=await apiJSON('/api/attendance/edit',{method:'PUT',body:JSON.stringify({employee_id:currentEditRecord.dbId||currentEditRecord.employee_id,work_date:currentEditRecord.date,action})});closeAttendanceEditor();alert(r.message||'Attendance update ho gayi.');await loadRealData(true);await loadHistoryForRange(false);renderRecords();}
  catch(e){alert('Attendance action fail: '+e.message);}
}
async function loadUsers() {
  if(!roleAllowed('super_admin'))return;
  const tbody=document.getElementById('usersTbody');if(!tbody)return;
  try{
    const result=await apiJSON('/api/users');userCache=result.items||[];
    tbody.innerHTML=userCache.map(u=>`<tr><td>${escapeHtml(u.display_name)}</td><td>${escapeHtml(u.username)}</td><td>${escapeHtml(({view_only:'View Only User',supervisor:'Supervisor',super_admin:'Super Admin'})[u.role]||u.role)}</td><td>${u.active?'<span class="badge b-green">Active</span>':'<span class="badge b-gray">Disabled</span>'}</td><td><div style="display:flex;gap:5px;flex-wrap:wrap"><button class="btn btn-outline btn-sm" onclick="editUser(${u.id})">Edit</button><button class="btn btn-outline btn-sm" onclick="resetUserPassword(${u.id})">Reset Password</button><button class="btn btn-outline btn-sm" onclick="toggleUserActive(${u.id})">${u.active?'Disable':'Enable'}</button><button class="btn btn-red btn-sm" onclick="deleteUser(${u.id})">Delete</button></div></td></tr>`).join('')||'<tr><td colspan="5">No users found.</td></tr>';
  }catch(e){tbody.innerHTML=`<tr><td colspan="5">Users load nahi huay: ${escapeHtml(e.message)}</td></tr>`;}
}
async function createUser() {
  const body={display_name:document.getElementById('newUserDisplay').value.trim(),username:document.getElementById('newUserName').value.trim(),role:document.getElementById('newUserRole').value,password:document.getElementById('newUserPassword').value};
  try{await apiJSON('/api/users',{method:'POST',body:JSON.stringify(body)});['newUserDisplay','newUserName','newUserPassword'].forEach(id=>document.getElementById(id).value='');await loadUsers();alert('Naya user create ho gaya.');}
  catch(e){alert('User create nahi hua: '+e.message);}
}
async function editUser(id) {
  const u=userCache.find(x=>x.id===id);if(!u)return;
  const display_name=prompt('Display name',u.display_name);if(display_name===null)return;
  const role=prompt('Role enter karein: view_only, supervisor, super_admin',u.role);if(role===null)return;
  try{await apiJSON(`/api/users/${id}`,{method:'PUT',body:JSON.stringify({display_name,role:role.trim()})});await loadUsers();}
  catch(e){alert('User update nahi hua: '+e.message);}
}
async function resetUserPassword(id) {
  const password=prompt('Naya password (kam az kam 8 characters)');if(password===null)return;
  try{await apiJSON(`/api/users/${id}`,{method:'PUT',body:JSON.stringify({password})});alert('Password reset ho gaya.');}
  catch(e){alert('Password reset nahi hua: '+e.message);}
}
async function toggleUserActive(id) {
  const u=userCache.find(x=>x.id===id);if(!u)return;
  try{await apiJSON(`/api/users/${id}`,{method:'PUT',body:JSON.stringify({active:!u.active})});await loadUsers();}
  catch(e){alert('User status update nahi hua: '+e.message);}
}
async function deleteUser(id) {
  const u=userCache.find(x=>x.id===id);if(!u||!confirm(`${u.display_name} ka account delete karna hai?`))return;
  try{await apiJSON(`/api/users/${id}`,{method:'DELETE'});await loadUsers();}
  catch(e){alert('User delete nahi hua: '+e.message);}
}
function updateReportCell(index,field,value) {if(currentReportRows[index])currentReportRows[index][field]=String(value??'').trim();}
async function showReportPreview() {
  const type=document.getElementById('rptType').value;
  const from=document.getElementById('rptFrom').value||document.getElementById('recFrom').value||currentDataDate||today();
  const to=document.getElementById('rptTo').value||from;
  const q=new URLSearchParams({from,to});
  const dept=document.getElementById('rptDept')?.value||'';const search=document.getElementById('rptEmployee')?.value.trim()||'';
  if(dept)q.set('department',dept);if(search)q.set('search',search);
  if(type==='Absent Employees')q.set('status','absent');if(type==='Late Arrivals')q.set('status','late');
  let rows=[];
  try{
    const result=await apiJSON('/api/attendance/history?'+q.toString());
    rows=(result.items||[]).map(r=>{
      const emp=employees.find(e=>String(e.dbId)===String(r.employee_id));const status=titleStatus(r.status);const cin=showTime(r.clock_in),cout=showTime(r.clock_out);const mins=Number(r.work_minutes||0);
      return {date:r.work_date,dbId:r.employee_id,employee_id:r.employee_id,id:String(r.badge_number||r.device_user_id||emp?.id||r.employee_id),name:r.name||emp?.name||'Unknown',dept:r.department||emp?.dept||'Unassigned',timetable:r.shift||'—',cin:cin==='—'?'':cin,cout:cout==='—'?'':cout,absent:status==='Absent'?'True':'',wh:mins>0?`${Math.floor(mins/60)}h ${mins%60}m`:'—',status,late_minutes:r.late_minutes||0,early_minutes:r.early_minutes||0,rawStatus:r.status};
    });
  }catch(e){alert('Report data load nahi hua: '+e.message);return;}
  currentReportRows=rows;const shown=rows.slice(0,100);const editable=roleAllowed('attendance_edit');
  const fields=[['id','AC-No.'],['name','Name'],['date','Date'],['timetable','Timetable'],['cin','Clock In'],['cout','Clock Out'],['absent','Absent'],['dept','Department'],['status','Status']];
  const tableRows=shown.map((r,index)=>`<tr>${fields.map(([field])=>`<td ${editable?`contenteditable="true" spellcheck="false" oninput="updateReportCell(${index},'${field}',this.innerText)"`:''} style="${field==='id'?'font-family:monospace;font-size:11px;':''}" title="${editable?'Editable report copy; original DB will not change':''}">${escapeHtml(r[field]??'')}</td>`).join('')}</tr>`).join('');
  document.getElementById('reportPreview').innerHTML=`<div style="border-bottom:1px solid var(--gray200);padding-bottom:12px;margin-bottom:14px"><div style="font-size:16px;font-weight:700;text-align:center">Police Training Collage — Biometric Attendance</div><div style="text-align:center;color:var(--text2);font-size:13px;margin-top:4px">${escapeHtml(type)}</div><div style="text-align:center;font-size:11px;color:var(--text3);margin-top:2px">Period: ${escapeHtml(from)} to ${escapeHtml(to)} · Generated: ${new Date().toLocaleString()}</div><div class="access-help" style="text-align:center">${editable?'Preview cells par click karke edit kar sakte hain. Yeh sirf export copy hai; main database update nahi hoga.':'View-only mode: report dekh, export aur print kar sakte hain.'}</div></div><div class="tbl-wrap"><table><thead><tr>${fields.map(x=>`<th>${x[1]}</th>`).join('')}</tr></thead><tbody>${tableRows||'<tr><td colspan="9">No records for selected filters.</td></tr>'}</tbody></table></div><div style="margin-top:12px;padding:10px;background:var(--gray50);border-radius:6px;display:flex;gap:20px;flex-wrap:wrap;font-size:12px"><span>Records: <strong>${rows.length}</strong></span><span>Present: <strong>${rows.filter(r=>r.status==='Present'||r.status==='Early Arrival').length}</strong></span><span>Late: <strong>${rows.filter(r=>r.status==='Late').length}</strong></span><span>Absent: <strong>${rows.filter(r=>r.status==='Absent').length}</strong></span></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button class="btn btn-primary btn-sm" onclick="window.print()">🖨 Print Report</button><button class="btn btn-outline btn-sm" onclick="downloadReportCsv()">📊 Export CSV</button><button class="btn btn-outline btn-sm" onclick="downloadReportExcel()">📗 Export / Open Editable Excel</button></div>`;
  document.getElementById('printTitle').textContent=type;document.getElementById('printMeta').textContent=`Period: ${from} to ${to} · Generated: ${new Date().toLocaleString()}`;
  document.getElementById('printTbody').innerHTML=shown.map(r=>`<tr><td style="border:1px solid #ddd;padding:5px">${escapeHtml(r.id)}</td><td style="border:1px solid #ddd;padding:5px">${escapeHtml(r.name)}</td><td style="border:1px solid #ddd;padding:5px">${escapeHtml(r.date)}</td><td style="border:1px solid #ddd;padding:5px">${escapeHtml(r.timetable||'—')}</td><td style="border:1px solid #ddd;padding:5px">${escapeHtml(r.cin||'—')}</td><td style="border:1px solid #ddd;padding:5px">${escapeHtml(r.cout||'—')}</td><td style="border:1px solid #ddd;padding:5px">${escapeHtml(r.absent||'')}</td><td style="border:1px solid #ddd;padding:5px">${escapeHtml(r.dept)}</td><td style="border:1px solid #ddd;padding:5px">${escapeHtml(r.status)}</td></tr>`).join('');
}
function downloadReportCsv() {
  const rows=currentReportRows||[];if(!rows.length){alert('Pehle report preview generate karein.');return;}
  const fields=['id','name','date','timetable','cin','cout','absent','dept','status'];const headers=['AC-No.','Name','Date','Timetable','Clock In','Clock Out','Absent','Department','Status'];
  const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const csv=[headers.join(','),...rows.map(r=>fields.map(k=>quote(r[k])).join(','))].join('\r\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`attendpro-report-${document.getElementById('rptFrom').value||currentDataDate||today()}.csv`;a.click();URL.revokeObjectURL(url);
}
async function downloadReportExcel() {
  const rows=currentReportRows||[];if(!rows.length){alert('Pehle report preview generate karein.');return;}
  const from=document.getElementById('rptFrom').value||document.getElementById('recFrom').value||currentDataDate||today();const to=document.getElementById('rptTo').value||from;
  try{
    const response=await fetch(`${API}/api/reports/excel`,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({from,to,rows})});
    if(!response.ok){let msg=`${response.status} ${response.statusText}`;try{const j=await response.json();msg=j.detail||msg;}catch(_){}throw new Error(msg);}
    const blob=await response.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`attendpro-report-${from}-to-${to}.xlsx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
    alert('Editable Excel report download ho gayi. Isay Excel ya LibreOffice mein open karke edit kar sakte hain. Is file ki editing original attendance DB ko change nahi karegi.');
  }catch(e){alert('Excel export fail: '+e.message);}
}



function openAddEmployeeForm(){
  if(!roleAllowed('super_admin')){alert('Only Super Admin can add employees.');return;}
  document.getElementById('addEmployeeForm')?.reset();
  document.getElementById('addEmployeeModal')?.classList.add('open');
  document.getElementById('newEmpName')?.focus();
}
function closeAddEmployeeForm(){document.getElementById('addEmployeeModal')?.classList.remove('open');}
async function saveNewEmployee(ev){
  ev.preventDefault();
  const form=ev.target,btn=form.querySelector('[type=submit]');
  const payload=Object.fromEntries(new FormData(form));
  btn.disabled=true;
  try{
    const result=await apiJSON('/api/employees',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    closeAddEmployeeForm();clearEmployeeFilters();
    await loadRealData(true);
    const id=Number(result.employee?.id);
    if(id){const e=employees.find(x=>Number(x.dbId)===id);if(e){empPage=1;document.getElementById('empSearch').value=e.name;document.getElementById('globalEmployeeSearch').value=e.name;renderEmployees();await toggleEmployeeProfile(id);}}
  }catch(e){alert('Employee save nahi hua: '+e.message);}finally{btn.disabled=false;}
}
// ── Restored original Employees table: A–Z names + View popup, no row dropdown. ──
function renderEmployees(){
  const search=(document.getElementById('empSearch')?.value||'').trim().toLocaleLowerCase();
  const dept=document.getElementById('empDept')?.value||'';
  const status=document.getElementById('empStatus')?.value||'';
  const rows=employees.filter(e=>(!search||displayEmployeeName(e.name).toLocaleLowerCase().includes(search)||String(e.name).toLocaleLowerCase().includes(search)||String(e.id).toLowerCase().includes(search))&&(!dept||e.dept===dept)&&(!status||e.status===status));
  const sortKey=employeeSortKey||'name';
  const sortValue=e=>sortKey==='name'?displayEmployeeName(e.name):String(e[sortKey]??'');
  rows.sort((a,b)=>employeeSortDirection*sortValue(a).localeCompare(sortValue(b),undefined,{numeric:sortKey==='id',sensitivity:'base'}) || displayEmployeeName(a.name).localeCompare(displayEmployeeName(b.name),undefined,{sensitivity:'base'}));
  const header=document.getElementById('empNameSortHeader');
  if(header){header.textContent=sortKey==='name'?(employeeSortDirection===1?'Name ↑':'Name ↓'):'Name ↕';header.setAttribute('aria-sort',sortKey==='name'?(employeeSortDirection===1?'ascending':'descending'):'none');}
  const pageSize=10,total=rows.length,pages=Math.max(1,Math.ceil(total/pageSize));
  if(empPage>pages)empPage=1;
  const tbody=document.getElementById('empTbody');if(!tbody)return;
  tbody.innerHTML=rows.slice((empPage-1)*pageSize,empPage*pageSize).map(e=>{
    const display=displayEmployeeName(e.name);
    return `<tr><td>${avEl({...e,name:display},32)}</td><td style="font-family:monospace;font-size:12px;color:var(--text2)">${escapeHtml(e.id)}</td>
      <td><button class="emp-display-name" onclick="openEmployeeFromList(${Number(e.dbId)||0})">${escapeHtml(display)}</button></td>
      <td>${escapeHtml(e.dept)}</td><td>${escapeHtml(e.designation)}</td><td>${escapeHtml(e.shift)}</td>
      <td>${e.status==='Active'?'<span class="badge b-green">Active</span>':'<span class="badge b-gray">Inactive</span>'}</td>
      <td><button class="btn btn-outline btn-sm" onclick="openEmployeeFromList(${Number(e.dbId)||0})">View</button></td></tr>`;
  }).join('')||'<tr><td colspan="8" style="padding:25px;text-align:center;color:var(--text2)">No employees match your filters. <button class="btn btn-outline btn-sm" onclick="clearEmployeeFilters()">Clear Filters</button></td></tr>';
  renderPag('empPag',empPage,pages,total,pageSize,p=>{empPage=p;renderEmployees()});
}
function openEmployeeFromList(dbId){const e=employees.find(x=>Number(x.dbId)===Number(dbId));if(e)openEmpModal(e);}

// ── New sidebar Discrepancies page. No external services; original MDB untouched. ──
let discrepancyTimer=null,currentDiscrepancy=null,discrepancyPage=1,discrepancyData=[];
function debounceDiscrepancies(){clearTimeout(discrepancyTimer);discrepancyTimer=setTimeout(()=>{discrepancyPage=1;loadDiscrepancies();},250);}
function resetDiscrepancies(){for(const id of ['discFrom','discTo','discSearch','discIssue']){const el=document.getElementById(id);if(el)el.value='';}document.getElementById('discState').value='open';discrepancyPage=1;loadDiscrepancies();}
function populateDiscrepancyEmployees(){
 const el=document.getElementById('discEmployeeSelect');if(!el)return;
 const previous=el.value;
 el.innerHTML='<option value="">Select employee</option>'+employees.slice().sort((a,b)=>displayEmployeeName(a.name).localeCompare(displayEmployeeName(b.name),undefined,{sensitivity:'base'}))
 .map(e=>`<option value="${Number(e.dbId)}">${escapeHtml(displayEmployeeName(e.name))} (${escapeHtml(e.id)})</option>`).join('');
 el.value=previous;
}
async function loadDiscrepancies(){
 const tbody=document.getElementById('discTbody');if(!tbody)return;
 const q=new URLSearchParams({state:document.getElementById('discState').value, page:String(discrepancyPage),per_page:'50'});
 for(const [param,id] of [['from_date','discFrom'],['to_date','discTo'],['issue','discIssue'],['search','discSearch']]){
  const v=document.getElementById(id)?.value?.trim();if(v)q.set(param,v);
 }
 tbody.innerHTML='<tr><td colspan="9">Loading discrepancies…</td></tr>';
 try{
  const data=await apiJSON('/api/discrepancies?'+q.toString());discrepancyData=data.items||[];
  const summary=data.summary||{};
  [['discTotal','total'],['discOpen','open'],['discReviewed','resolved'],['discMissingOut','missing_check_out']].forEach(([id,key])=>{const el=document.getElementById(id);if(el)el.textContent=summary[key]??0;});
  if(!document.getElementById('discFrom').value)document.getElementById('discFrom').value=data.from;
  if(!document.getElementById('discTo').value)document.getElementById('discTo').value=data.to;
  const canEdit=roleAllowed('attendance_edit');
  tbody.innerHTML=discrepancyData.map((c,i)=>`<tr>
   <td>${escapeHtml(c.work_date)}</td><td><strong>${escapeHtml(displayEmployeeName(c.name))}</strong><div style="font-size:11px;color:var(--text2)">${escapeHtml(c.department)}</div></td>
   <td>${escapeHtml(c.badge_number||'—')}</td><td>${escapeHtml(c.clock_in||'—')}</td><td>${escapeHtml(c.clock_out||'—')}</td>
   <td><span class="badge ${c.issue_type==='missing_check_in'||c.issue_type==='biometric_not_configured'?'b-red':'b-amber'}">${escapeHtml(c.issue_label)}</span></td>
   <td>${escapeHtml(c.biometric_enrollment==='configured'?'Configured':c.biometric_enrollment==='not_configured'?'Not Configured':'Unknown')}</td>
   <td>${statusBadge(titleStatus(c.status))}</td>
   <td>${c.review_state==='resolved'?`<div><span class="badge b-green">Reviewed</span><div style="font-size:11px;color:var(--text2)">${escapeHtml(c.resolution||'')} by ${escapeHtml(c.reviewed_by||'')}</div></div>`:'<span class="badge b-amber">Needs Review</span>'}
     <div style="margin-top:5px"><button class="btn btn-outline btn-sm" onclick="openDiscrepancyReview(${i})">${canEdit?'Review / Update':'View Details'}</button></div></td></tr>`).join('')||'<tr><td colspan="9" style="padding:22px;text-align:center">No discrepancies found for the selected filters.</td></tr>';
  const pag=document.getElementById('discPag');if(pag)pag.innerHTML=`<span>Showing ${data.items?.length||0} of ${data.total||0} issues</span><div class="pg-btns"><button class="pg-btn" onclick="changeDiscrepancyPage(-1)" ${discrepancyPage<=1?'disabled':''}>‹</button><span style="padding:6px 10px">${discrepancyPage}</span><button class="pg-btn" onclick="changeDiscrepancyPage(1)" ${discrepancyPage*50>=(data.total||0)?'disabled':''}>›</button></div>`;
  populateDiscrepancyEmployees();
 }catch(e){tbody.innerHTML=`<tr><td colspan="9">Could not load discrepancies: ${escapeHtml(e.message)}</td></tr>`;}
}
function changeDiscrepancyPage(dir){discrepancyPage=Math.max(1,discrepancyPage+dir);loadDiscrepancies();}
function openDiscrepancyReview(index){
 currentDiscrepancy=discrepancyData[index];if(!currentDiscrepancy)return;
 const c=currentDiscrepancy;
 document.getElementById('discModalDetail').innerHTML=`<div class="detail-row"><span class="detail-label">Employee</span><span class="detail-val">${escapeHtml(displayEmployeeName(c.name))} · ${escapeHtml(c.badge_number||'—')}</span></div>
 <div class="detail-row"><span class="detail-label">Date</span><span class="detail-val">${escapeHtml(c.work_date)}</span></div>
 <div class="detail-row"><span class="detail-label">Issue</span><span class="detail-val">${escapeHtml(c.issue_label)}</span></div>
 <div class="detail-row"><span class="detail-label">Clock In</span><span class="detail-val">${escapeHtml(c.clock_in||'—')}</span></div>
 <div class="detail-row"><span class="detail-label">Clock Out</span><span class="detail-val">${escapeHtml(c.clock_out||'—')}</span></div>
 <div class="detail-row"><span class="detail-label">Biometric</span><span class="detail-val">${escapeHtml(c.biometric_enrollment==='not_configured'?'Not Configured':c.biometric_enrollment==='configured'?'Configured':'Unknown / unverified')}</span></div>
 <div class="detail-row"><span class="detail-label">Current Status</span><span class="detail-val">${statusBadge(titleStatus(c.status))}</span></div>
 ${c.reviewed_by?`<div class="detail-row"><span class="detail-label">Last Reviewed</span><span class="detail-val">${escapeHtml(c.reviewed_by)} · ${escapeHtml(c.reviewed_at||'')}</span></div>`:''}`;
 document.getElementById('discResolution').value=c.resolution||'reviewed';
 document.getElementById('discReviewNote').value=c.review_note||'';
 const allowEdit=roleAllowed('attendance_edit');
 document.getElementById('discResolution').disabled=!allowEdit;
 document.getElementById('discReviewNote').disabled=!allowEdit;
 const save=document.querySelector('#discrepancyModal .btn-primary');if(save)save.style.display=allowEdit?'':'none';
 document.getElementById('discrepancyModal').classList.add('open');
}
function closeDiscrepancyModal(){document.getElementById('discrepancyModal').classList.remove('open');currentDiscrepancy=null;}
async function saveDiscrepancyReview(){
 if(!currentDiscrepancy)return;
 const c=currentDiscrepancy;
 try{
  await apiJSON('/api/discrepancies/resolve',{method:'POST',body:JSON.stringify({employee_id:c.employee_id,work_date:c.work_date,issue_type:c.issue_type,
   resolution:document.getElementById('discResolution').value,note:document.getElementById('discReviewNote').value})});
  closeDiscrepancyModal();await loadDiscrepancies();await loadRealData(true);
 }catch(e){alert('Could not save discrepancy review: '+e.message);}
}
async function saveBiometricStatus(){
 const employee_id=Number(document.getElementById('discEmployeeSelect').value);
 if(!employee_id){alert('Please select an employee.');return;}
 try{
  await apiJSON('/api/discrepancies/biometric-status',{method:'PUT',body:JSON.stringify({employee_id,status:document.getElementById('discEnrollment').value,note:document.getElementById('discEnrollmentNote').value})});
  await loadDiscrepancies();await loadRealData(true);
  alert('Biometric verification status saved locally. No automatic leave was created.');
 }catch(e){alert('Could not save biometric status: '+e.message);}
}
// Preserve existing navigation and all other screens; add only the new page hook.
const showScreenBeforeDiscrepancies=showScreen;
showScreen=function(name,el){showScreenBeforeDiscrepancies(name,el);if(name==='discrepancies'){discrepancyPage=1;loadDiscrepancies();}};

// Re-run the API integration after all original UI functions are defined.
initTheme();
initSidebar();
setTimeout(()=>initAuth(),100);

