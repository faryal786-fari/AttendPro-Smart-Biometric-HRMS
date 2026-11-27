window.ATTENDPRO_BUILD = "2026-11-27-dashboard-roles-v2";

const apEnglishText = new Map([
 ['Could not load settings:','Could not load settings:'],['Could not save settings:','Could not save settings:'],
 ['Database settings saved.','Database settings saved.'],['MDB test failed:','MDB test failed:'],
 ['Sync error:','Sync error:'],['Could not load logs:','Could not load logs:'],
 ['No sync/import history available.','No sync or import history is available.'],
 ['Database mein employee records nahi mile.','No employee records were returned by the database.'],
 ['Could not load report data:','Could not load report data:'],['Generate a report preview first.','Generate a report preview first.'],
 ['Password updated.','Password updated successfully.'],['Could not switch device:','Could not switch device:'],
 ['Could not add device:','Could not add device:'],['Could not update device:','Could not update device:'],
 ['Could not delete device:','Could not delete device:'],['Could not create user:','Could not create user:'],
 ['Could not update user:','Could not update user:'],['Could not delete user:','Could not delete user:'],
 ['Password reset.','Password reset successfully.'],['Could not reset password:','Could not reset password:'],
 ['Could not update user status:','Could not update user status:'],['Attendance updated successfully.','Attendance updated successfully.'],
 ['Could not update attendance:','Could not update attendance:'],['Attendance action failed:','Attendance action failed:'],
 ['Could not save employee:','Could not save employee:'],['User created successfully.','User created successfully.'],
 ['Your role does not allow attendance editing.','Your role does not allow attendance editing.'],
 ['Aapka role attendance edit nahi kar sakta','Your role does not allow attendance editing'],
 ['Device added. Verify its MDB path using Test MDB.','Device added. Use Test MDB to verify its database path.'],
 ['Yeh username pehle se mojood hai.','This username already exists.']
]);
function englishMessage(value){
 let message=String(value ?? 'An unexpected error occurred.');
 for(const [oldText,newText] of apEnglishText)message=message.replaceAll(oldText,newText);
 if(message==='403'||message.includes('Origin not permitted')||message.includes('Invalid origin'))
  return 'Request blocked by server origin settings. Check the allowed Vercel origin on Render.';
 if(message==='401')return 'Sign-in failed or session expired. Please check your credentials and try again.';
 return message;
}
function notify(message,kind=''){
 const text=englishMessage(message),layer=document.getElementById('apToastStack');if(!layer)return;
 const mode=kind||(/failed|error|denied|cannot|could not|unauthorized|forbidden|not available|not allowed|requires|blocked|missing|invalid|403|401/i.test(text)?'error':/warning|pending/i.test(text)?'warning':'success');
 const item=document.createElement('div');item.className='ap-toast '+mode;item.setAttribute('role',mode==='error'?'alert':'status');
 const content=document.createElement('div');content.className='ap-toast-copy';content.textContent=text;
 const x=document.createElement('button');x.className='ap-toast-close';x.type='button';x.textContent='×';x.setAttribute('aria-label','Dismiss notification');x.onclick=()=>item.remove();
 item.append(content,x);layer.append(item);while(layer.childElementCount>5)layer.firstChild.remove();
 setTimeout(()=>item.remove(),mode==='error'?11000:6500);
}
function appDialog(message,opts={}){
 return new Promise(resolve=>{
  const modal=document.getElementById('apActionDialog'),label=document.getElementById('apDialogMessage'),title=document.getElementById('apDialogTitle'),box=document.getElementById('apDialogInputWrap'),input=document.getElementById('apDialogInput');
  title.textContent=opts.title||(opts.input?'Enter details':'Confirm action');label.textContent=englishMessage(message);
  box.style.display=opts.input?'block':'none';input.value=opts.initial||'';modal.classList.add('open');
  const cancel=document.getElementById('apDialogCancel'),ok=document.getElementById('apDialogOK');ok.textContent=opts.input?'Save':'Continue';
  function done(v){modal.classList.remove('open');cancel.onclick=null;ok.onclick=null;input.onkeydown=null;resolve(v);}
  cancel.onclick=()=>done(opts.input?null:false);ok.onclick=()=>done(opts.input?input.value:true);
  input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();done(input.value)}if(e.key==='Escape')done(null)};
  if(opts.input)input.focus();else ok.focus();
 });
}
const appConfirm=message=>appDialog(message,{title:'Please confirm'});
const appPrompt=(message,initial='')=>appDialog(message,{input:true,initial,title:'Enter details'});
function toggleApNotifications(force){
 const panel=document.getElementById('apNotifPanel');if(!panel)return;
 const shouldOpen=force===undefined?!panel.classList.contains('open'):!!force;
 panel.classList.toggle('open',shouldOpen);if(!shouldOpen)return;
 const late=Array.isArray(liveData)?liveData.filter(row=>row.status==='Late').length:0;
 const missing=Array.isArray(liveData)?liveData.filter(row=>row.cin!=='—'&&row.cout==='Pending').length:0;
 const entries=[];
 if(late)entries.push({title:`${late} late arrivals`,body:'For the selected attendance date.'});
 if(missing)entries.push({title:`${missing} missing check-outs`,body:'Review these entries in Discrepancies.'});
 if(currentSettings?.device?.status==='error')entries.push({title:'Biometric sync warning',body:'Check Device Status for the latest connection error.'});
 if(!entries.length)entries.push({title:'No new notifications',body:'There are no outstanding attendance notifications for the current view.'});
 document.getElementById('apNotifItems').innerHTML=entries.map(x=>`<div class="ap-notif-item"><strong>${escapeHtml(x.title)}</strong><small>${escapeHtml(x.body)}</small></div>`).join('');
}

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
let currentReportSourceRows = [];
let currentReportExportMode = 'attendance';

async function apiJSON(path, options={}) {
  const doFetch=()=>fetch(`${API}${path}`, {cache:'no-store', ...options, headers:{'Content-Type':'application/json', ...(options.headers||{})}});
  let response = await doFetch();
  if(response.status===401 && cloudMode && !path.startsWith('/api/auth/')){
    const refresh=await fetch(`${API}/api/auth/refresh`,{method:'POST',cache:'no-store'});
    if(refresh.ok)response=await doFetch();
  }
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    const raw = await response.text().catch(() => '');
    if (raw) {
      try {
        const body = JSON.parse(raw);
        detail = body.detail || body.message || detail;
      } catch (_) {
        detail = raw.trim().slice(0, 280) || detail;
      }
    }
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
    const rawStatus=String(d?.status||'').toLowerCase();
    const arrivalFlag=rawStatus==='early_arrival'?'Early Arrival':'';
    let status=d?(rawStatus==='early_arrival'?'Present':titleStatus(d.status)):'Not Checked In';
    if (d && cin==='—' && cout!=='—' && status==='Present') status='Missing Check-in';
    const rawLate=Number(d?.late_minutes||0), rawEarly=Number(d?.early_minutes||0);
    let lateStr='—';
    if(cin!=='—') lateStr=rawLate>0?`+${rawLate} min`:rawEarly>0?`-${rawEarly} min`:'On time';
    const schedIn=(/^\d{2}:\d{2}$/.test(String(d?.shift||''))?d.shift:officeStart)||'09:00';
    const work=Number(d?.work_minutes||0);
    const wh=work>0?`${Math.floor(work/60)}h ${work%60}m`:'—';
    return {...e, shift:d?.shift||e.shift||'General', schedIn, schedOut:'—', status, arrivalFlag, cin, cout:cout==='—'&&cin!=='—'?'Pending':cout, lateStr,
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
  const employeeEl=document.getElementById('rptEmployee');
  if(employeeEl){const prior=employeeEl.value;employeeEl.innerHTML='<option value="">All Employees</option>'+rows.slice().sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:'base'})).map(e=>`<option value="${escapeHtml(e.id)}">${escapeHtml(e.name)} (${escapeHtml(e.id)})</option>`).join('');if(rows.some(e=>String(e.id)===prior))employeeEl.value=prior;}
}
function escapeHtml(v) { return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function updateKpis(metrics, depts) {
  const early=liveData.filter(r=>r.arrivalFlag==='Early Arrival').length;
  const missingOut=liveData.filter(r=>r.cin!=='—' && (r.cout==='Pending'||r.cout==='—')).length;
  const vals={kpiTotal:metrics.total??employees.length,kpiPresent:metrics.present??0,kpiAbsent:metrics.absent??0,kpiLate:metrics.late??0,
    kpiEarly:metrics.early_arrival??early,kpiLeave:metrics.on_leave??0,kpiMissingIn:metrics.missing_check_in??0,
    kpiMissingOut:metrics.missing_check_out??missingOut,kpiOsd:metrics.osd??0,
    kpiOsdPermanent:metrics.osd_permanent??0,kpiMedicalLeave:metrics.medical_leave??0};
  Object.entries(vals).forEach(([id,val])=>{const el=document.getElementById(id);if(el)el.textContent=val;});
  const cards=document.querySelectorAll('#screen-dashboard .kpi-card .kpi-sub');
  const total=Number(metrics.total||0), present=Number(metrics.present||0), absent=Number(metrics.absent||0);
  if(cards[0])cards[0].textContent=`Across ${depts.length} departments`;
  if(cards[1])cards[1].textContent=`${metrics.attendance_percentage??(total?Math.round(present/total*1000)/10:0)}% attendance rate`;
  if(cards[2])cards[2].textContent=`${metrics.absence_percentage??(metrics.working_employees?Math.round(absent/metrics.working_employees*1000)/10:0)}% absence rate`;
  if(cards[3])cards[3].textContent=`${metrics.late||0} reported late arrivals`;
  if(cards[4])cards[4].textContent='Calculated from available attendance records';
  if(cards[5])cards[5].textContent='Approved leave · excluded from attendance rate';
  if(cards[6])cards[6].textContent='Employees with a missing check-in punch';
  if(cards[7])cards[7].textContent='Employees with a missing check-out punch';
}
function shiftMatchesFront(rowShift,selected){
  if(!selected||selected==='All Shifts')return true;
  const value=String(rowShift||'').toLowerCase();
  const key=String(selected||'').toLowerCase();
  if(key==='morning')return ['morning','morning shift','08:00','08:00 am'].includes(value);
  if(key==='general')return ['general','general shift','09:00','09:00 am'].includes(value);
  if(key==='evening')return ['evening','evening shift','14:00','02:00 pm'].includes(value);
  return value===key;
}
function updateDonut() {
  const selected=currentDashboard?.shift||'';
  const rows=liveData.filter(r=>shiftMatchesFront(r.shift,selected));
  const present=rows.filter(r=>r.status==='Present'||r.status==='Early Arrival').length;
  const late=rows.filter(r=>r.status==='Late').length;
  const absent=rows.filter(r=>r.status==='Absent').length;
  const onLeave=rows.filter(r=>r.status==='On Leave').length;
  const unknown=rows.filter(r=>r.status==='Not Checked In'||r.status==='Missing Check-in').length;
  const total=Math.max(1,present+late+absent+onLeave+unknown);
  const working=Math.max(1,total-onLeave);
  const pct=Math.round((present+late)/working*100);
  const center=document.getElementById('donutCenter'); if(center)center.textContent=`${pct}%`;
  [['legendPresent',present],['legendAbsent',absent],['legendLate',late],['legendLeave',onLeave],['legendUnknown',unknown]].forEach(([id,val])=>{const el=document.getElementById(id);if(el)el.textContent=val;});
  const circles=document.querySelectorAll('#screen-dashboard .donut-wrap svg circle');
  if(circles.length>=6){
    const circ=2*Math.PI*40; let offset=0;
    [present,absent,late,onLeave,unknown].forEach((n,i)=>{const len=circ*n/total;const c=circles[i+1];c.setAttribute('stroke-dasharray',`${len} ${Math.max(0,circ-len)}`);c.setAttribute('stroke-dashoffset',String(-offset));offset+=len;});
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
  } catch(e) { if(showError)notify('Could not load settings: '+e.message); return null; }
}
async function saveAccessSettings(quiet=false) {
  try {
    const body={access_path:document.getElementById('accessPath').value.trim(),access_auto:document.getElementById('accessAuto').checked,access_interval:Number(document.getElementById('accessInterval').value||90)};
    currentSettings=await apiJSON('/api/settings',{method:'PUT',body:JSON.stringify(body)});
    await loadAccessSettings();
    if(!quiet)notify('Database settings saved.');
    return true;
  } catch(e) { notify('Could not save settings: '+e.message); return false; }
}
async function testAccessDB() {
  if(!await saveAccessSettings(true))return;
  try { const r=await apiJSON('/api/database/test',{method:'POST'}); await loadAccessSettings(); notify((r.success?'SUCCESS: ':'ERROR: ')+(r.message||'Test complete')); }
  catch(e){notify('MDB test failed: '+e.message);}
}
async function syncAccessDB() {
  if(!await saveAccessSettings(true))return;
  const btns=document.querySelectorAll('#screen-device button');
  try {
    const r=await apiJSON('/api/database/sync?force=true',{method:'POST'});
    notify((r.success?'Sync completed: ':'Sync failed: ')+(r.message||JSON.stringify(r)));
    await loadAccessSettings(); await loadRealData(true);
  } catch(e){notify('Sync error: '+e.message);}
}
async function showSyncLogs() {
  try { const r=await apiJSON('/api/imports'); const rows=r.items||[]; notify(rows.length?rows.map(x=>`${x.imported_at||''} | ${x.source||''} | ${x.filename||''} | rows: ${x.attendance_rows||0}`).join('\n'):'No sync/import history available.'); }
  catch(e){notify('Could not load logs: '+e.message);}
}
async function loadSelectedDate() { userSelectedDate=true; await loadRealData(true); }
async function loadStaffDashboardFilters(){
  const selected=document.getElementById('staffDashboardDate')?.value||currentDataDate||today();
  userSelectedDate=true;
  const liveDate=document.getElementById('liveDate');if(liveDate)liveDate.value=selected;
  await loadRealData(true);
}
async function loadViewOnlyDashboard(){
  const data=await apiJSON('/api/view-only/dashboard');
  currentDataDate=data.date||'';
  const m=data.metrics||{};
  const put=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=Number(value||0).toLocaleString();};
  put('viewOnlyTotalStaff',m.total_staff);put('viewOnlyOsd',m.osd);
  put('viewOnlyOsdPermanent',m.osd_permanent);put('viewOnlyMedicalLeave',m.medical_leave);
  const dateLabel=document.getElementById('viewOnlyDateLabel');if(dateLabel)dateLabel.textContent=`Previous day: ${data.date||'—'}`;
  const badge=document.querySelector('.demo-badge');if(badge){badge.textContent=`Previous-day attendance only · ${data.date||''}`;badge.style.background='#e0f2fe';badge.style.borderColor='#bae6fd';badge.style.color='#075985';}
  const dashDate=document.getElementById('dashDate');if(dashDate)dashDate.textContent=data.date||'Previous Day';
  const pageSub=document.querySelector('#screen-dashboard .page-sub');if(pageSub)pageSub.innerHTML=`Previous-day attendance — <strong>${escapeHtml(data.date||'')}</strong>`;
  const tbody=document.getElementById('viewOnlyAttendanceTbody');
  if(tbody){
    const rows=data.attendance||[];
    tbody.innerHTML=rows.length?rows.map(r=>`<tr><td>${escapeHtml(r.employee_no||'—')}</td><td><strong>${escapeHtml(r.name||'')}</strong></td><td>${escapeHtml(r.department||'')}</td><td>${escapeHtml(r.shift||'—')}</td><td>${escapeHtml(r.clock_in||'—')}</td><td>${escapeHtml(r.clock_out||'—')}</td><td>${statusBadge(titleStatus(r.status))}</td></tr>`).join(''):'<tr><td colspan="7" class="access-help">No attendance records are available for the previous day.</td></tr>';
  }
  const announcements=document.getElementById('viewOnlyAnnouncements');
  if(announcements){
    const rows=data.announcements||[];
    announcements.innerHTML=rows.length?rows.map(a=>`<article class="view-announcement"><strong>${escapeHtml(a.title||'Leave announcement')}</strong><div>${escapeHtml(a.message||'')}</div><small>${escapeHtml(a.start_date||'')} — ${escapeHtml(a.end_date||'')}</small></article>`).join(''):'<div class="access-help">No current leave announcements.</div>';
  }
}
async function loadRealData(forceDate=false) {
  if(realLoading){if(forceDate)pendingRealReload=true;return;}
  realLoading=true;
  try {
    if(currentUser?.role==='view_only'){
      await loadViewOnlyDashboard();
      return;
    }
    const shift=document.getElementById('staffDashboardShift')?.value||'';
    const preferredDate=(userSelectedDate&&document.getElementById('liveDate')?.value)
      ?document.getElementById('liveDate').value
      :(document.getElementById('staffDashboardDate')?.value||'');
    const q=new URLSearchParams();if(preferredDate)q.set('date',preferredDate);if(shift)q.set('shift',shift);
    const health=await apiJSON('/api/health');
    const selectedDash=await apiJSON('/api/dashboard'+(q.toString()?'?'+q.toString():''));
    await loadAccessSettings();
    const employeeRows=await fetchAllPages('/api/employees');
    if(!employeeRows.length)throw new Error('No employee records were returned by the database.');
    employees.splice(0,employees.length,...employeeRows.map(mapEmployee));
    currentDataDate=selectedDash.date||today();
    if(!userSelectedDate){
      const dateEl=document.getElementById('liveDate');if(dateEl)dateEl.value=currentDataDate;
      const dashDateEl=document.getElementById('staffDashboardDate');if(dashDateEl)dashDateEl.value=currentDataDate;
    }else{
      const dashDateEl=document.getElementById('staffDashboardDate');if(dashDateEl)dashDateEl.value=currentDataDate;
    }
    const liveDate=document.getElementById('liveDate');if(liveDate&&!liveDate.value)liveDate.value=currentDataDate;
    currentDashboard=selectedDash;
    const dailyRows=await fetchAllPages('/api/attendance',{date:currentDataDate});
    liveData.splice(0,liveData.length,...makeLiveRows(employees,dailyRows,(currentSettings.office_start||'09:00')));
    const osdIds=new Set((selectedDash.osd_employee_ids||[]).map(String));
    const osdPermanentIds=new Set((selectedDash.osd_permanent_employee_ids||[]).map(String));
    const medicalIds=new Set((selectedDash.medical_leave_employee_ids||[]).map(String));
    liveData.forEach(row=>{
      const id=String(row.dbId);
      if(osdIds.has(id)){
        row.status='Present';row.source=osdPermanentIds.has(id)?'approved_osd_permanent':'approved_osd';
        row.lateStr='OSD';row.cin=row.cin||'—';row.cout=row.cout||'—';
      }else if(medicalIds.has(id)){
        row.status='On Leave';row.source='approved_medical_leave';
      }
    });
    recentPunches=selectedDash.recent||[];
    updateDepartmentOptions(employees);
    updateKpis(selectedDash.metrics||{},selectedDash.departments||[]);
    updateDonut();
    buildDashboard(); renderLive(); renderEmployees();
    const ptsDate=document.getElementById('ptsDashboardDate');if(ptsDate&&!ptsDate.value)ptsDate.value=currentDataDate;
    if(ptsDashboardMode==='trainee')loadPtsDashboard();
    if(document.getElementById('screen-live')?.classList.contains('active')&&liveAttendanceMode==='trainee')loadPtsLiveAttendance();
    const badge=document.querySelector('.demo-badge');
    if(badge){
      const dev=selectedDash.device||{};
      if(dev.status==='online') {badge.style.background='#dcfce7';badge.style.borderColor='#86efac';badge.style.color='#166534';badge.textContent=`🟢 Live MDB data · ${currentDataDate} · Last sync ${dev.last_sync||'just now'}`;}
      else {
        const broken=['missing_file','stale_source','error'].includes(dev.status);
        badge.style.background=broken?'#fee2e2':'#fef3c7';badge.style.borderColor=broken?'#fecaca':'#fcd34d';badge.style.color=broken?'#991b1b':'#92400e';
        badge.textContent=`📚 Stored data · ${currentDataDate} · Last MDB sync ${dev.last_sync||'never'}`;
      }
    }
    const sub=document.querySelector('#screen-dashboard .page-sub'); if(sub)sub.innerHTML=`Attendance overview — <strong>${escapeHtml(currentDataDate)}</strong> · ${devText(selectedDash.device)}`;
    const empSub=document.querySelector('#screen-employees .page-sub');if(empSub)empSub.textContent=`${employees.length} PTS staff from the attendance database`;
    const liveSub=document.querySelector('#screen-live .page-sub');if(liveSub)liveSub.textContent=`Staff and trainee attendance for ${currentDataDate} · refreshes automatically`;
    await loadHistoryForRange(false);
  } catch(e) {
    const badge=document.querySelector('.demo-badge');
    if(badge){badge.style.background='#fee2e2';badge.style.borderColor='#fecaca';badge.style.color='#991b1b';badge.textContent='⚠ Backend unavailable — sample preview';}
    console.warn('AttendPro backend unavailable:',e.message);
  } finally {
    realLoading=false;
    if(realRefreshTimer)clearTimeout(realRefreshTimer);
    if(pendingRealReload){
      pendingRealReload=false;
      realRefreshTimer=setTimeout(()=>loadRealData(true),50);
      return;
    }
    realRefreshTimer=setTimeout(()=>loadRealData(false),currentUser?.role==='view_only'?60000:15000);
  }
}

function devText(dev){const s=dev?.status||'not configured';return s==='online'?'Access database connected':('database '+s.replaceAll('_',' '));}
async function loadHistoryForRange(render=true) {
  const from=document.getElementById('recFrom')?.value||'';
  const to=document.getElementById('recTo')?.value||'';
  if(!from||!to)return;
  try {
    const q=new URLSearchParams({from,to});
    const employee=document.getElementById('rptEmployee')?.value||'';
    if(employee)q.set('search',employee);
    const dept=document.getElementById('rptDept')?.value||'';
    if(dept)q.set('department',dept);
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


// ── PTC LAHORE / MANAWAN TRAINEE + STAFF WORKSPACE ─────────────────────────
let ptsDashboardMode='trainee';
let ptsTraineeRows=[];
let editingPtsTraineeId=null;
let ptsCurrentRecordType='leave',ptsCurrentPersonType='trainee';
let liveAttendanceMode='staff';
let ptsReportRows=[];
let ptsDirectoryCache={staff:null,trainee:null};
function setPtsDashboardMode(mode){
  if(currentUser?.role==='view_only')return;
  ptsDashboardMode=mode==='staff'?'staff':'trainee';
  const trainee=ptsDashboardMode==='trainee';
  const traineePanel=document.getElementById('ptsTraineeDashboard');
  const staffPanel=document.getElementById('ptsStaffDashboard');
  if(traineePanel)traineePanel.style.display=trainee?'block':'none';
  if(staffPanel)staffPanel.style.display=trainee?'none':'block';
  const t=document.getElementById('ptsModeTrainee'),s=document.getElementById('ptsModeStaff');
  if(t){t.classList.toggle('active',trainee);t.setAttribute('aria-selected',String(trainee));}
  if(s){s.classList.toggle('active',!trainee);s.setAttribute('aria-selected',String(!trainee));}
  if(trainee)loadPtsDashboard();
}
async function loadPtsDashboard(){
  const dateEl=document.getElementById('ptsDashboardDate'),shiftEl=document.getElementById('ptsShiftSelect');
  if(dateEl&&!dateEl.value)dateEl.value=currentDataDate||today();
  const date=(dateEl&&dateEl.value)||currentDataDate||today(),shift=(shiftEl&&shiftEl.value)||'Morning';
  const status=document.getElementById('ptsTraineeDataStatus');
  const heading=document.getElementById('ptsShiftHeading');if(heading)heading.textContent=shift;
  if(status)status.textContent='Loading Manawan trainee data…';
  try{
    const data=await apiJSON('/api/pts/dashboard?'+new URLSearchParams({date,shift}).toString());
    const m=data.metrics||{};
    const values={ptsKpiTotal:m.total_enrolled??0,ptsKpiPresent:m.present??0,ptsKpiAbsent:m.absent??0,ptsKpiLeave:m.leave??0,ptsKpiLongWeekend:m.long_weekend??0,ptsKpiOsd:m.osd??0,ptsKpiMedicalRest:m.medical_rest??0,ptsKpiRepatriate:m.repatriate??0};
    Object.entries(values).forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.textContent=Number(value).toLocaleString('en-US');});
    const rows=Array.isArray(data.course_wise)?data.course_wise:[];
    const body=document.getElementById('ptsCourseWiseTbody');
    if(body)body.innerHTML=rows.length?rows.map(r=>{
      const pct=Number(r.total||0)?Math.round(Number(r.present||0)/Number(r.total||0)*100):0;
      return `<tr><td><strong>${escapeHtml(r.course)}</strong><div class="pts-course-progress"><span style="width:${pct}%"></span></div></td><td>${Number(r.total||0).toLocaleString('en-US')}</td><td style="color:#13a879;font-weight:700">${Number(r.present||0).toLocaleString('en-US')}</td><td style="color:#d83b54;font-weight:700">${Number(r.absent||0).toLocaleString('en-US')}</td></tr>`;
    }).join(''):'<tr><td colspan="4">No course attendance has been recorded for this shift and date.</td></tr>';
    const dist=data.status_distribution||{},distBox=document.getElementById('ptsStatusDistribution');
    const distItems=[['Present',(dist.present||0)+(dist.early_arrival||0),'#13a879'],['Late',dist.late||0,'#d97706'],['Absent',dist.absent||0,'#dc3545'],['Leave',dist.leave||0,'#64748b'],['OSD',dist.osd||0,'#7c3aed'],['Not Marked',dist.not_marked||0,'#94a3b8']];
    const distTotal=distItems.reduce((sum,x)=>sum+Number(x[1]||0),0);
    if(distBox)distBox.innerHTML=distItems.map(([label,count,color])=>`<div class="pts-dist-row"><div><span>${label}</span><strong>${Number(count).toLocaleString('en-US')}</strong></div><div class="pts-dist-track"><span style="width:${distTotal?Math.round(Number(count)/distTotal*100):0}%;background:${color}"></span></div></div>`).join('');
    const totalEl=document.getElementById('ptsStatusTotal');if(totalEl)totalEl.textContent=`${distTotal} trainees`;
    const activityBody=document.getElementById('ptsRecentActivityTbody');
    const activity=data.live_activity||[];
    if(activityBody)activityBody.innerHTML=activity.length?activity.map(r=>`<tr><td><strong>${escapeHtml(r.name||'')}</strong><div class="access-help">${escapeHtml(r.employee_no||'')}</div></td><td>${escapeHtml(r.course_name||'—')} / ${escapeHtml(r.platoon||'—')}</td><td>${escapeHtml(r.check_in||'—')}</td><td>${escapeHtml(r.check_out||'—')}</td><td>${ptsStatusBadge(r.status)}</td></tr>`).join(''):'<tr><td colspan="5">No trainee attendance activity recorded for this date and shift.</td></tr>';
    if(status)status.textContent=data.data_ready?`${m.active_enrolled||0} active trainees · ${m.attendance_records||0} attendance records`:'No Manawan trainee roster imported yet · counts are correctly shown as zero.';
  }catch(e){if(status)status.textContent='Trainee data unavailable: '+englishMessage(e.message);console.warn('PTC trainee dashboard:',e.message);}
}
async function loadPtsLiveAttendance(){
  const dateEl=document.getElementById('ptsLiveDate'),shiftEl=document.getElementById('ptsLiveShift');
  if(dateEl&&!dateEl.value)dateEl.value=currentDataDate||today();
  const date=dateEl?.value||currentDataDate||today(),shift=shiftEl?.value||'Morning';
  const body=document.getElementById('ptsLiveTbody');if(body)body.innerHTML='<tr><td colspan="8">Loading trainee attendance…</td></tr>';
  try{
    const data=await apiJSON('/api/pts/attendance?'+new URLSearchParams({date,shift}).toString());
    const rows=data.items||[];
    rows.sort((a,b)=>{
      const rank=x=>({present:0,late:1,early_arrival:0,absent:2,leave:3,outdoor_leave:3,medical_rest:3,long_weekend:3,osd:4,'':5}[String(x.attendance_status||'').toLowerCase()]??6);
      return rank(a)-rank(b)||String(a.check_in||'99:99').localeCompare(String(b.check_in||'99:99'))||String(a.name||'').localeCompare(String(b.name||''));
    });
    if(body)body.innerHTML=rows.length?rows.map(r=>`<tr><td>${escapeHtml(r.employee_no||'')}</td><td><strong>${escapeHtml(r.name||'')}</strong></td><td>${escapeHtml(r.course_name||'—')}</td><td>${escapeHtml(r.platoon||'—')}</td><td>${escapeHtml(shift)}</td><td>${escapeHtml(r.check_in||'—')}</td><td>${escapeHtml(r.check_out||'—')}</td><td>${ptsStatusBadge(r.attendance_status||'not_marked')}</td></tr>`).join(''):'<tr><td colspan="8">No active trainees found.</td></tr>';
  }catch(e){if(body)body.innerHTML=`<tr><td colspan="8">${escapeHtml(englishMessage(e.message))}</td></tr>`;}
}
function setLiveAttendanceMode(mode){
  liveAttendanceMode=mode==='trainee'?'trainee':'staff';
  const staff=liveAttendanceMode==='staff';
  const staffView=document.getElementById('liveStaffView'),traineeView=document.getElementById('liveTraineeView');
  if(staffView)staffView.style.display=staff?'block':'none';
  if(traineeView)traineeView.style.display=staff?'none':'block';
  const staffTab=document.getElementById('liveStaffTab'),traineeTab=document.getElementById('liveTraineeTab');
  if(staffTab)staffTab.classList.toggle('active',staff);
  if(traineeTab)traineeTab.classList.toggle('active',!staff);
  if(staff)renderLive();else loadPtsLiveAttendance();
}
function ptsStatusBadge(status){
  const key=String(status||'not_marked').toLowerCase();
  const labels={present:'Present',late:'Late',early_arrival:'Early Arrival',absent:'Absent',leave:'Leave',outdoor_leave:'Outdoor Leave',medical_rest:'Medical Rest',long_weekend:'Long Weekend',osd:'OSD',not_marked:'Not Marked'};
  const cls={present:'b-green',late:'b-amber',early_arrival:'b-green',absent:'b-red',leave:'b-blue',outdoor_leave:'b-blue',medical_rest:'b-purple',long_weekend:'b-gray',osd:'b-violet',not_marked:'b-gray'};
  return `<span class="badge ${cls[key]||'b-gray'}">${labels[key]||escapeHtml(status||'Not Marked')}</span>`;
}

async function loadPtsAttendance(){
  const dateEl=document.getElementById('ptsAttendanceDate'),shiftEl=document.getElementById('ptsAttendanceShift');
  if(dateEl&&!dateEl.value)dateEl.value=currentDataDate||today();
  const date=dateEl?.value||today(),shift=shiftEl?.value||'Morning';
  const body=document.getElementById('ptsAttendanceTbody');if(body)body.innerHTML='<tr><td colspan="8">Loading trainee attendance…</td></tr>';
  try{const data=await apiJSON('/api/pts/attendance?'+new URLSearchParams({date,shift}).toString());
    const rows=data.items||[];if(!body)return;
    body.innerHTML=rows.length?rows.map(r=>`<tr data-pts-attendance-row="${Number(r.id)}"><td><strong>${escapeHtml(r.employee_no)}</strong></td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.course_name||'—')}</td><td>${escapeHtml(r.platoon||'—')}</td><td><select class="form-input pts-attendance-status" id="ptsAttendanceStatus_${Number(r.id)}"><option value="">Not Marked</option><option value="present" ${r.attendance_status==='present'?'selected':''}>Present</option><option value="absent" ${r.attendance_status==='absent'?'selected':''}>Absent</option><option value="late" ${r.attendance_status==='late'?'selected':''}>Late</option><option value="early_arrival" ${r.attendance_status==='early_arrival'?'selected':''}>Early Arrival</option><option value="leave" ${r.attendance_status==='leave'?'selected':''}>Leave</option><option value="outdoor_leave" ${r.attendance_status==='outdoor_leave'?'selected':''}>Outdoor Leave</option><option value="osd" ${r.attendance_status==='osd'?'selected':''}>OSD</option><option value="medical_rest" ${r.attendance_status==='medical_rest'?'selected':''}>Medical Rest</option><option value="long_weekend" ${r.attendance_status==='long_weekend'?'selected':''}>Long Weekend</option></select></td><td><input class="form-input pts-attendance-time" id="ptsAttendanceIn_${Number(r.id)}" type="time" value="${escapeHtml(r.check_in||'')}"></td><td><input class="form-input pts-attendance-time" id="ptsAttendanceOut_${Number(r.id)}" type="time" value="${escapeHtml(r.check_out||'')}"></td><td><button class="btn btn-outline btn-sm" data-permission="attendance_edit" onclick="savePtsAttendanceRow(${Number(r.id)})">Save</button></td></tr>`).join(''):'<tr><td colspan="8">No active trainees found. Import the Manawan trainee roster first.</td></tr>';
    applyRolePermissions();
  }catch(e){if(body)body.innerHTML=`<tr><td colspan="8">${escapeHtml(englishMessage(e.message))}</td></tr>`;}
}
async function savePtsAttendanceRow(traineeId){
  if(!roleAllowed('attendance_edit')){notify('Supervisor or Super Admin permission is required.','error');return;}
  const status=document.getElementById('ptsAttendanceStatus_'+traineeId)?.value;
  if(!status){notify('Select an attendance status first.','error');return;}
  const payload={trainee_id:traineeId,attendance_date:document.getElementById('ptsAttendanceDate').value||today(),shift:document.getElementById('ptsAttendanceShift').value||'Morning',status,check_in:document.getElementById('ptsAttendanceIn_'+traineeId)?.value||'',check_out:document.getElementById('ptsAttendanceOut_'+traineeId)?.value||''};
  try{await apiJSON('/api/pts/attendance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});notify('Trainee attendance saved.','success');await loadPtsDashboard();}
  catch(e){notify('Could not save attendance: '+e.message,'error');}
}
async function saveAllPtsAttendance(markAllPresent=false){
  if(!roleAllowed('attendance_edit')){notify('Supervisor or Super Admin permission is required.','error');return;}
  const rows=[...document.querySelectorAll('#ptsAttendanceTbody tr[data-pts-attendance-row]')];
  if(!rows.length){notify('Load the trainee roster first.','error');return;}
  const date=document.getElementById('ptsAttendanceDate').value||today(),shift=document.getElementById('ptsAttendanceShift').value||'Morning';
  if(markAllPresent&&!await appConfirm(`Mark ALL ${rows.length} active trainees Present for ${date} (${shift})? This replaces any previously selected status for these rows.`))return;
  const items=[];
  rows.forEach(row=>{const id=Number(row.dataset.ptsAttendanceRow),select=document.getElementById('ptsAttendanceStatus_'+id);if(markAllPresent&&select)select.value='present';const status=select?.value;if(!status)return;items.push({trainee_id:id,attendance_date:date,shift,status,check_in:document.getElementById('ptsAttendanceIn_'+id)?.value||'',check_out:document.getElementById('ptsAttendanceOut_'+id)?.value||''});});
  if(!items.length){notify('Choose at least one attendance status.','error');return;}
  try{const result=await apiJSON('/api/pts/attendance/bulk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items})});notify(result.message||'Attendance saved.','success');await loadPtsAttendance();await loadPtsDashboard();}
  catch(e){notify('Could not save attendance: '+e.message,'error');}
}
async function loadPtsTrainees(){
  const body=document.getElementById('ptsTraineeTbody');if(body)body.innerHTML='<tr><td colspan="8">Loading trainees…</td></tr>';
  try{const r=await apiJSON('/api/pts/trainees');ptsTraineeRows=r.items||[];renderPtsTrainees();}
  catch(e){if(body)body.innerHTML=`<tr><td colspan="7">${escapeHtml(englishMessage(e.message))}</td></tr>`;}
}
function downloadPtsTraineeTemplate(){window.location.href='/api/pts/templates/trainee-roster';}
async function importPtsTrainees(input){
  const file=input?.files?.[0];if(!file)return;
  const form=new FormData();form.append('file',file);
  try{
    const response=await fetch('/api/pts/trainees/import',{method:'POST',credentials:'same-origin',body:form,cache:'no-store'});
    const result=await response.json().catch(()=>({detail:'The server returned an unreadable response.'}));
    if(!response.ok)throw new Error(result.detail||result.message||('HTTP '+response.status));
    notify(result.message||'Trainee roster imported.','success');await loadPtsTrainees();await loadPtsDashboard();
  }catch(e){notify('Trainee import failed: '+e.message,'error');}
  finally{input.value='';}
}
function downloadPtsRecordTemplate(recordType){window.location.href='/api/pts/templates/'+encodeURIComponent(recordType);}
async function importPtsRecords(input,recordType,personType){
  const file=input?.files?.[0];if(!file)return;
  const form=new FormData();form.append('file',file);
  try{
    const query=new URLSearchParams({record_type:recordType,person_type:personType});
    const response=await fetch('/api/pts/records/import?'+query.toString(),{method:'POST',credentials:'same-origin',body:form,cache:'no-store'});
    const result=await response.json().catch(()=>({detail:'The server returned an unreadable response.'}));
    if(!response.ok)throw new Error(result.detail||result.message||('HTTP '+response.status));
    notify(result.message||'Records imported.','success');
    if(result.rejected_count){console.warn('Rejected PTS import rows:',result.rejected);notify(result.rejected_count+' rows were rejected. Open the browser console to review row numbers and reasons.','warning');}
    await loadPtsRecords(recordType,personType);await loadPtsDashboard();if(personType==='staff')await loadRealData(true);
  }catch(e){notify('Import failed: '+e.message,'error');}
  finally{input.value='';}
}
function renderPtsTrainees(){
  const body=document.getElementById('ptsTraineeTbody');if(!body)return;
  const q=(document.getElementById('ptsTraineeSearch')?.value||'').trim().toLowerCase();
  const status=document.getElementById('ptsTraineeStatus')?.value||'';
  const rows=ptsTraineeRows.filter(r=>(!q||[r.employee_no,r.name,r.father_name,r.course_name].some(v=>String(v||'').toLowerCase().includes(q)))&&(!status||r.status===status));
  body.innerHTML=rows.length?rows.map((r,i)=>`<tr><td>${i+1}</td><td><strong>${escapeHtml(r.employee_no)}</strong></td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.father_name||'—')}</td><td>${escapeHtml(r.course_name||'—')}</td><td>${escapeHtml(r.platoon||'—')}</td><td><span class="badge ${r.status==='active'?'b-green':r.status==='repatriated'?'b-amber':'b-gray'}">${escapeHtml(r.status||'active')}</span></td><td><button class="btn btn-outline btn-sm" data-permission="attendance_edit" onclick="openPtsTraineeModal(${Number(r.id)})">Edit</button></td></tr>`).join(''):'<tr><td colspan="8">No Manawan trainees found. Use “Add Trainee” to create the first roster entry.</td></tr>';
  applyRolePermissions();
}
function openPtsTraineeModal(id=null){if(!roleAllowed('attendance_edit')){notify('Supervisor or Super Admin permission is required.','error');return;}const f=document.getElementById('ptsTraineeForm');if(f)f.reset();editingPtsTraineeId=id===null?null:Number(id);const row=editingPtsTraineeId?ptsTraineeRows.find(x=>Number(x.id)===editingPtsTraineeId):null;document.getElementById('ptsTraineeModal').querySelector('.modal-title').textContent=row?'Edit Manawan Trainee':'Add Manawan Trainee';if(row){document.getElementById('ptsTraineeEmployeeNo').value=row.employee_no||'';document.getElementById('ptsTraineeName').value=row.name||'';document.getElementById('ptsTraineeFatherName').value=row.father_name||'';document.getElementById('ptsTraineeCourse').value=row.course_name||'';document.getElementById('ptsTraineePlatoon').value=row.platoon||'';document.getElementById('ptsTraineeStart').value=String(row.course_start_date||'').slice(0,10);document.getElementById('ptsTraineeEnd').value=String(row.course_end_date||'').slice(0,10);document.getElementById('ptsTraineeStatusForm').value=row.status||'active';}document.getElementById('ptsTraineeModal')?.classList.add('open');}
function closePtsTraineeModal(){editingPtsTraineeId=null;document.getElementById('ptsTraineeModal')?.classList.remove('open');}
async function savePtsTrainee(event){
  event.preventDefault();
  const payload={employee_no:document.getElementById('ptsTraineeEmployeeNo').value.trim(),name:document.getElementById('ptsTraineeName').value.trim(),father_name:document.getElementById('ptsTraineeFatherName').value.trim(),course_name:document.getElementById('ptsTraineeCourse').value.trim(),platoon:document.getElementById('ptsTraineePlatoon').value.trim(),course_start_date:document.getElementById('ptsTraineeStart').value||null,course_end_date:document.getElementById('ptsTraineeEnd').value||null,status:document.getElementById('ptsTraineeStatusForm').value};
  try{await apiJSON(editingPtsTraineeId?'/api/pts/trainees/'+editingPtsTraineeId:'/api/pts/trainees',{method:editingPtsTraineeId?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});closePtsTraineeModal();notify('Manawan trainee saved successfully.','success');await loadPtsTrainees();await loadPtsDashboard();}
  catch(e){notify('Could not save trainee: '+e.message,'error');}
}
function ptsFormatDate(value){if(!value)return'—';const d=new Date(value);return Number.isNaN(d.getTime())?String(value):d.toLocaleString('en-PK',{dateStyle:'medium',timeStyle:'short'});}
async function loadPtsRecords(recordType,personType){
  const idMap={ 'leave-trainee':'ptsTraineeLeaveTbody','osd-trainee':'ptsTraineeOsdTbody','leave-staff':'ptsStaffLeaveTbody','osd-staff':'ptsStaffOsdTbody','osd_permanent-staff':'ptsStaffOsdPermanentTbody','duty_rest-staff':'ptsDutyRestTbody'};
  const body=document.getElementById(idMap[recordType+'-'+personType]);const colSpan=(recordType==='osd'||recordType==='osd_permanent')?9:8;if(body)body.innerHTML=`<tr><td colspan="${colSpan}">Loading records…</td></tr>`;
  try{
    const r=await apiJSON('/api/pts/records?'+new URLSearchParams({record_type:recordType,person_type:personType}).toString());
    const rows=r.items||[];
    if(!body)return;
    body.innerHTML=rows.length?rows.map(row=>{
      const identity=`<td><strong>${escapeHtml(row.person_id)}</strong></td><td>${escapeHtml(row.person_name)}</td>`;
      const context=personType==='trainee'?`<td>${escapeHtml(row.course_name||'—')} / ${escapeHtml(row.platoon||'—')}</td>`:`<td>${escapeHtml(row.staff_category||'—')} / ${escapeHtml(row.staff_branch||'—')}</td>`;
      const status=`<td><span class="badge ${row.status==='approved'?'b-green':row.status==='rejected'?'b-red':'b-amber'}">${escapeHtml(row.status||'pending')}</span></td>`;
      const actions=(row.status==='pending')?`<td><div class="access-actions"><button class="btn btn-outline btn-sm" data-permission="attendance_edit" onclick="updatePtsRecordStatus('${recordType}',${Number(row.id)},'approved','${personType}')">Approve</button><button class="btn btn-outline btn-sm" data-permission="attendance_edit" onclick="updatePtsRecordStatus('${recordType}',${Number(row.id)},'rejected','${personType}')">Reject</button></div></td>`:'<td>—</td>';
      if(recordType==='leave')return`<tr>${identity}${context}<td>${escapeHtml(row.leave_type||row.reason||'—')}</td><td>${ptsFormatDate(row.start_at)}</td><td>${ptsFormatDate(row.end_at)}</td>${status}${actions}</tr>`;
      if(recordType==='osd'||recordType==='osd_permanent')return`<tr>${identity}${context}<td>${escapeHtml(row.reason||'—')}</td><td>${escapeHtml(row.duty_place||'—')}</td><td>${ptsFormatDate(row.start_at)}</td><td>${ptsFormatDate(row.end_at)}</td>${status}${actions}</tr>`;
      return`<tr>${identity}${context}<td>${ptsFormatDate(row.start_at)}</td><td>${ptsFormatDate(row.end_at)}</td><td>${escapeHtml(row.reason||'Duty Rest')}</td>${status}${actions}</tr>`;
    }).join(''):`<tr><td colspan="${colSpan}">No records found for this category.</td></tr>`;
    applyRolePermissions();
  }catch(e){if(body)body.innerHTML=`<tr><td colspan="${colSpan}">${escapeHtml(englishMessage(e.message))}</td></tr>`;}
}
async function updatePtsRecordStatus(recordType,recordId,status,personType){
  if(!roleAllowed('attendance_edit')){notify('Supervisor or Super Admin permission is required.','error');return;}
  try{await apiJSON('/api/pts/records/'+recordType+'/'+recordId,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});notify('Record status updated.','success');if(recordType==='leave'&&document.getElementById('screen-leave')?.classList.contains('active'))await loadLeaveManagement();else await loadPtsRecords(recordType,personType);await loadPtsDashboard();if(personType==='staff')await loadRealData(true);}
  catch(e){notify('Could not update record: '+e.message,'error');}
}
async function loadLeaveManagement(){
  const pending=document.getElementById('leavePendingTbody'),approved=document.getElementById('leaveApprovedTbody');
  const announcementsBody=document.getElementById('leaveAnnouncementsTbody'),holidaysBody=document.getElementById('leaveHolidaysTbody');
  [pending,approved,announcementsBody,holidaysBody].forEach(el=>{if(el)el.innerHTML='<tr><td colspan="9">Loading…</td></tr>';});
  try{
    const [staffLeave,traineeLeave,announcementResult,holidayResult]=await Promise.all([
      apiJSON('/api/pts/records?record_type=leave&person_type=staff'),
      apiJSON('/api/pts/records?record_type=leave&person_type=trainee'),
      apiJSON('/api/pts/leave-announcements'),
      apiJSON('/api/pts/holidays')
    ]);
    const records=[...(staffLeave.items||[]),...(traineeLeave.items||[])].sort((a,b)=>String(b.start_at||'').localeCompare(String(a.start_at||'')));
    const renderRows=rows=>rows.length?rows.map(row=>{
      const type=String(row.person_type||'staff'),status=String(row.status||'pending');
      const actions=status==='pending'?`<button class="btn btn-outline btn-sm" data-permission="attendance_edit" onclick="updatePtsRecordStatus('leave',${Number(row.id)},'approved','${type}')">Approve</button><button class="btn btn-outline btn-sm" data-permission="attendance_edit" onclick="updatePtsRecordStatus('leave',${Number(row.id)},'rejected','${type}')">Reject</button>`:status==='approved'?`<button class="btn btn-outline btn-sm" data-permission="attendance_edit" onclick="updatePtsRecordStatus('leave',${Number(row.id)},'cancelled','${type}')">Cancel</button>`:'—';
      return `<tr><td>${escapeHtml(type==='trainee'?'Trainee':'Staff')}</td><td>${escapeHtml(row.person_id||'')}</td><td><strong>${escapeHtml(row.person_name||'')}</strong></td><td>${escapeHtml(row.leave_type||row.reason||'Leave')}</td><td>${escapeHtml(ptsFormatDate(row.start_at))}</td><td>${escapeHtml(ptsFormatDate(row.end_at))}</td><td>${escapeHtml(row.reason||'—')}</td><td>${statusBadge(status)}</td><td><div class="access-actions">${actions}</div></td></tr>`;
    }).join(''):'<tr><td colspan="9">No leave requests found.</td></tr>';
    if(pending)pending.innerHTML=renderRows(records.filter(r=>String(r.status||'pending')==='pending'));
    if(approved)approved.innerHTML=renderRows(records.filter(r=>['approved','cancelled','rejected'].includes(String(r.status||''))));
    const announcements=announcementResult.items||[];
    if(announcementsBody)announcementsBody.innerHTML=announcements.length?announcements.map(a=>`<tr><td><strong>${escapeHtml(a.title||'')}</strong></td><td>${escapeHtml(a.message||'—')}</td><td>${escapeHtml(a.start_date||'')}</td><td>${escapeHtml(a.end_date||'')}</td><td>${escapeHtml(a.audience||'all')}</td><td>${a.active?'Published':'Hidden'}</td><td><button class="btn btn-outline btn-sm" data-permission="attendance_edit" onclick="toggleLeaveAnnouncement(${Number(a.id)},${a.active?'false':'true'})">${a.active?'Hide':'Publish'}</button></td></tr>`).join(''):'<tr><td colspan="7">No leave announcements have been published.</td></tr>';
    const holidays=holidayResult.items||[];
    if(holidaysBody)holidaysBody.innerHTML=holidays.length?holidays.map(h=>`<tr><td><strong>${escapeHtml(h.title||'')}</strong></td><td>${escapeHtml(h.holiday_date||'')}</td><td>${escapeHtml(h.holiday_date?new Date(h.holiday_date+'T00:00:00').toLocaleDateString('en-PK',{weekday:'long'}):'—')}</td><td>${escapeHtml(h.category||'')}</td><td>${escapeHtml(h.description||'—')}</td><td><button class="btn btn-outline btn-sm" data-permission="attendance_edit" onclick="deleteHoliday(${Number(h.id)})">Delete</button></td></tr>`).join(''):'<tr><td colspan="6">No public holidays have been added.</td></tr>';
    applyRolePermissions();
  }catch(e){
    [pending,approved,announcementsBody,holidaysBody].forEach(el=>{if(el)el.innerHTML=`<tr><td colspan="9">${escapeHtml(englishMessage(e.message))}</td></tr>`;});
  }
}
function switchLeaveTab(tab,id){
  document.querySelectorAll('.leave-tabs .l-tab').forEach(el=>el.classList.toggle('active',el===tab));
  ['leave-pending','leave-approved','leave-announcements','leave-holidays'].forEach(key=>{const el=document.getElementById(key);if(el)el.style.display=key===id?'block':'none';});
}
function openLeaveAnnouncementModal(){
  if(!roleAllowed('attendance_edit'))return;
  const todayValue=today();
  document.getElementById('ptsAnnouncementTitle').value='';
  document.getElementById('ptsAnnouncementMessage').value='';
  document.getElementById('ptsAnnouncementStart').value=todayValue;
  document.getElementById('ptsAnnouncementEnd').value=todayValue;
  document.getElementById('ptsAnnouncementModal').classList.add('open');
}
function closeLeaveAnnouncementModal(){document.getElementById('ptsAnnouncementModal')?.classList.remove('open');}
async function saveLeaveAnnouncement(event){
  event.preventDefault();
  const payload={title:document.getElementById('ptsAnnouncementTitle').value.trim(),message:document.getElementById('ptsAnnouncementMessage').value.trim(),start_date:document.getElementById('ptsAnnouncementStart').value,end_date:document.getElementById('ptsAnnouncementEnd').value,audience:document.getElementById('ptsAnnouncementAudience').value};
  try{await apiJSON('/api/pts/leave-announcements',{method:'POST',body:JSON.stringify(payload)});closeLeaveAnnouncementModal();notify('Leave announcement published.','success');await loadLeaveManagement();}
  catch(e){notify('Announcement could not be published: '+e.message,'error');}
}
async function toggleLeaveAnnouncement(id,active){
  try{await apiJSON('/api/pts/leave-announcements/'+id,{method:'PATCH',body:JSON.stringify({active:active===true||active==='true'})});await loadLeaveManagement();notify('Announcement status updated.','success');}
  catch(e){notify('Announcement could not be updated: '+e.message,'error');}
}
function openHolidayModal(){
  if(!roleAllowed('attendance_edit'))return;
  document.getElementById('ptsHolidayTitle').value='';document.getElementById('ptsHolidayDate').value=today();
  document.getElementById('ptsHolidayDescription').value='';document.getElementById('ptsHolidayModal').classList.add('open');
}
function closeHolidayModal(){document.getElementById('ptsHolidayModal')?.classList.remove('open');}
async function saveHoliday(event){
  event.preventDefault();
  const payload={title:document.getElementById('ptsHolidayTitle').value.trim(),holiday_date:document.getElementById('ptsHolidayDate').value,category:document.getElementById('ptsHolidayCategory').value,description:document.getElementById('ptsHolidayDescription').value.trim()};
  try{await apiJSON('/api/pts/holidays',{method:'POST',body:JSON.stringify(payload)});closeHolidayModal();notify('Public holiday saved.','success');await loadLeaveManagement();}
  catch(e){notify('Holiday could not be saved: '+e.message,'error');}
}
async function deleteHoliday(id){
  if(!await appConfirm('Delete this holiday record?'))return;
  try{await apiJSON('/api/pts/holidays/'+id,{method:'DELETE'});notify('Holiday deleted.','success');await loadLeaveManagement();}
  catch(e){notify('Holiday could not be deleted: '+e.message,'error');}
}
async function loadPtsPersonDirectory(personType){
  if(personType==='staff'){
    if(!ptsDirectoryCache.staff){
      if(!employees.length){const rows=await fetchAllPages('/api/employees');employees.splice(0,employees.length,...rows.map(mapEmployee));}
      ptsDirectoryCache.staff=employees.filter(e=>e.status==='Active').map(e=>({key:String(e.dbId),person_id:String(e.id||e.deviceUserId||e.dbId),name:e.name,category:e.designation||'',branch:e.dept||'',course:'',platoon:''}));
    }
    return ptsDirectoryCache.staff;
  }
  if(!ptsDirectoryCache.trainee){
    const result=await apiJSON('/api/pts/trainees');
    ptsDirectoryCache.trainee=(result.items||[]).filter(t=>String(t.status||'active').toLowerCase()==='active').map((t,i)=>({key:String(t.id),person_id:String(t.employee_no||''),name:t.name||'',category:'',branch:'',course:t.course_name||'',platoon:t.platoon||''}));
  }
  return ptsDirectoryCache.trainee;
}
function fillSimpleSelect(id,values,placeholder,selected=''){
  const el=document.getElementById(id);if(!el)return;
  const unique=[...new Set((values||[]).map(v=>String(v||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  el.innerHTML=`<option value="">${escapeHtml(placeholder)}</option>`+unique.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  if(unique.includes(selected))el.value=selected;
}
async function populatePtsRecordPersonOptions(){
  const select=document.getElementById('ptsRecordPersonSelect');if(!select)return;
  select.innerHTML='<option value="">Loading directory…</option>';
  try{
    const rows=await loadPtsPersonDirectory(ptsCurrentPersonType);
    select.innerHTML='<option value="">Select person from directory…</option>'+rows.map((r,i)=>`<option value="${escapeHtml(r.key)}" data-person-id="${escapeHtml(r.person_id)}" data-person-name="${escapeHtml(r.name)}" data-category="${escapeHtml(r.category)}" data-branch="${escapeHtml(r.branch)}" data-course="${escapeHtml(r.course)}" data-platoon="${escapeHtml(r.platoon)}">${escapeHtml(r.person_id)} — ${escapeHtml(r.name)}${r.course?' · '+escapeHtml(r.course):''}</option>`).join('');
    const category=document.getElementById('ptsRecordCategory');
    const branch=document.getElementById('ptsRecordBranch');
    if(ptsCurrentPersonType==='staff'){
      fillSimpleSelect('ptsRecordCategory',rows.map(r=>r.category),'Select category…');
      fillSimpleSelect('ptsRecordBranch',rows.map(r=>r.branch),'Select branch…');
    }
    selectPtsRecordPerson('');
  }catch(e){select.innerHTML='<option value="">Could not load directory</option>';notify('Could not load staff/trainee dropdown: '+e.message,'error');}
}
function selectPtsRecordPerson(key){
  const select=document.getElementById('ptsRecordPersonSelect');
  const option=select?.selectedOptions?.[0];
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.value=value||'';};
  set('ptsRecordPersonId',option?.dataset.personId||'');
  set('ptsRecordPersonName',option?.dataset.personName||'');
  set('ptsRecordCourse',option?.dataset.course||'');
  set('ptsRecordPlatoon',option?.dataset.platoon||'');
  if(option?.dataset.category)set('ptsRecordCategory',option.dataset.category);
  if(option?.dataset.branch)set('ptsRecordBranch',option.dataset.branch);
}
async function switchPtsRecordPersonType(personType){
  ptsCurrentPersonType=personType==='trainee'?'trainee':'staff';
  await populatePtsRecordPersonOptions();
  const isTrainee=ptsCurrentPersonType==='trainee';
  ['ptsRecordCourseWrap','ptsRecordPlatoonWrap'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display=isTrainee?'block':'none';});
  ['ptsRecordCategoryWrap','ptsRecordBranchWrap'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display=isTrainee?'none':'block';});
}
async function openPtsRecordModal(recordType,personType,globalLeave=false){
  if(!roleAllowed('attendance_edit')){notify('Supervisor or Super Admin permission is required.','error');return;}
  ptsCurrentRecordType=recordType;ptsCurrentPersonType=personType;
  document.getElementById('ptsRecordForm')?.reset();
  const isTrainee=personType==='trainee',isLeave=recordType==='leave',isOsd=recordType==='osd'||recordType==='osd_permanent',isPermanent=recordType==='osd_permanent';
  const typeWrap=document.getElementById('ptsRecordPersonTypeWrap');
  if(typeWrap)typeWrap.style.display=globalLeave?'block':'none';
  const personTypeSelect=document.getElementById('ptsRecordPersonTypeSelect');if(personTypeSelect)personTypeSelect.value=personType;
  document.getElementById('ptsRecordModalTitle').textContent=recordType==='duty_rest'?'Add Staff Duty Rest':isPermanent?'Add Permanent Staff OSD':`${isTrainee?'Trainee':'Staff'} ${isLeave?'Leave':'OSD / Permission'}`;
  ['ptsRecordCourseWrap','ptsRecordPlatoonWrap'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display=isTrainee?'block':'none';});
  ['ptsRecordCategoryWrap','ptsRecordBranchWrap'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display=isTrainee?'none':'block';});
  document.getElementById('ptsRecordLeaveTypeWrap').style.display=isLeave?'block':'none';
  document.getElementById('ptsRecordDutyPlaceWrap').style.display=isOsd?'block':'none';
  document.getElementById('ptsRecordOsdTypeWrap').style.display=isOsd?'block':'none';
  const osdType=document.getElementById('ptsRecordOsdType');if(osdType)osdType.value=isPermanent?'permanent':'temporary';
  const status=document.getElementById('ptsRecordStatus');if(status)status.value=isLeave?'pending':'pending';
  const start=document.getElementById('ptsRecordStart'),end=document.getElementById('ptsRecordEnd');
  if(start&&!start.value)start.value=new Date().toISOString().slice(0,16);
  if(end&&!end.value)end.value=isPermanent?'2099-12-31T23:59':new Date(Date.now()+86400000).toISOString().slice(0,16);
  document.getElementById('ptsRecordModal').classList.add('open');
  await populatePtsRecordPersonOptions();
}
function openLeaveRequestModal(){openPtsRecordModal('leave','staff',true);}
function closePtsRecordModal(){document.getElementById('ptsRecordModal')?.classList.remove('open');}

async function savePtsRecord(event){
  event.preventDefault();
  const startValue=document.getElementById('ptsRecordStart').value;
  const endValue=document.getElementById('ptsRecordEnd').value||(ptsCurrentRecordType==='osd_permanent'?'2099-12-31T23:59':'');
  if(!document.getElementById('ptsRecordPersonId').value||!document.getElementById('ptsRecordPersonName').value){notify('Directory se staff ya trainee select karein.','error');return;}
  const payload={record_type:ptsCurrentRecordType,person_type:ptsCurrentPersonType,person_id:document.getElementById('ptsRecordPersonId').value.trim(),person_name:document.getElementById('ptsRecordPersonName').value.trim(),course_name:document.getElementById('ptsRecordCourse').value.trim(),platoon:document.getElementById('ptsRecordPlatoon').value.trim(),staff_category:document.getElementById('ptsRecordCategory').value.trim(),staff_branch:document.getElementById('ptsRecordBranch').value.trim(),leave_type:document.getElementById('ptsRecordLeaveType').value.trim(),start_at:new Date(startValue).toISOString(),end_at:new Date(endValue).toISOString(),reason:document.getElementById('ptsRecordReason').value.trim(),duty_place:document.getElementById('ptsRecordDutyPlace').value.trim(),osd_type:document.getElementById('ptsRecordOsdType')?.value||'temporary',reference_no:document.getElementById('ptsRecordReference').value.trim(),remarks:document.getElementById('ptsRecordRemarks').value.trim(),status:document.getElementById('ptsRecordStatus').value};
  try{await apiJSON('/api/pts/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});closePtsRecordModal();notify('Record saved successfully.','success');if(ptsCurrentRecordType==='leave'&&document.getElementById('screen-leave')?.classList.contains('active'))await loadLeaveManagement();else await loadPtsRecords(ptsCurrentRecordType,ptsCurrentPersonType);await loadPtsDashboard();if(ptsCurrentPersonType==='staff')await loadRealData(true);}
  catch(e){notify('Could not save record: '+e.message,'error');}
}

// ── NAVIGATION ──────────────────────────────────────────────────────────────
function showScreen(name,el){
  if(currentUser?.role==='view_only'&&name!=='dashboard'){notify('View Only account ko sirf Dashboard aur previous-day attendance ki access hai.','error');return;}
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const screen=document.getElementById('screen-'+name);if(!screen)return;
  screen.classList.add('active');
  if(el)el.classList.add('active');
  if(name==='live')setLiveAttendanceMode(liveAttendanceMode);
  if(name==='employees')renderEmployees();
  if(name==='records'){setDefaultDates();renderRecords();}
  if(name==='trainees')loadPtsTrainees();
  if(name==='pts-trainee-attendance')loadPtsAttendance();
  if(name==='pts-trainee-leave')loadPtsRecords('leave','trainee');
  if(name==='pts-trainee-osd')loadPtsRecords('osd','trainee');
  if(name==='pts-staff-leave')loadPtsRecords('leave','staff');
  if(name==='pts-staff-osd')loadPtsRecords('osd','staff');
  if(name==='pts-staff-osd-permanent')loadPtsRecords('osd_permanent','staff');
  if(name==='pts-duty-rest')loadPtsRecords('duty_rest','staff');
  if(name==='leave')loadLeaveManagement();
  if(name==='reports')loadTraineeReportDefaults();
  if(name==='dashboard'&&ptsDashboardMode==='trainee'&&currentUser?.role!=='view_only')loadPtsDashboard();
  if(name==='settings'){loadApConfig();}
}
function setLiveFilter(s){document.getElementById('liveStatus').value=s;renderLive()}

// ── LIVE TABLE ──────────────────────────────────────────────────────────────
let livePage=1,liveSort={col:'',dir:1};
function renderLive(){
  const search=(document.getElementById('liveSearch')?.value||'').toLowerCase();
  const dept=document.getElementById('liveDept')?.value||'';
  const shift=document.getElementById('liveShift')?.value||'';
  const status=document.getElementById('liveStatus')?.value||'';
  let data=liveData.filter(r=>{
    if(search&&!r.name.toLowerCase().includes(search)&&!r.id.toLowerCase().includes(search))return false;
    if(dept&&r.dept!==dept)return false;
    if(shift&&!shiftMatchesFront(r.shift,shift))return false;
    if(status&&r.status!==status)return false;
    return true;
  });
  if(liveSort.col){
    const k=liveSort.col;data.sort((a,b)=>liveSort.dir*String(a[k]??'').localeCompare(String(b[k]??''),undefined,{numeric:true,sensitivity:'base'}));
  }else{
    const rank={'Present':0,'Late':1,'Absent':2,'On Leave':3,'Missing Check-in':4,'Not Checked In':5};
    data.sort((a,b)=>(rank[a.status]??6)-(rank[b.status]??6)||
      (a.cin==='—'?1:b.cin==='—'?-1:String(a.cin).localeCompare(String(b.cin)))||
      a.name.localeCompare(b.name,undefined,{sensitivity:'base'}));
  }
  const pp=15,total=data.length,pages=Math.ceil(total/pp);
  if(livePage>pages)livePage=1;
  const slice=data.slice((livePage-1)*pp,livePage*pp);
  document.getElementById('liveTbody').innerHTML=slice.map(r=>`
    <tr style="cursor:pointer" onclick='openEmpModal(${JSON.stringify(r)})'>
      <td>${avEl(r)}</td><td style="font-family:monospace;font-size:12px">${r.id}</td>
      <td><strong>${r.name}</strong></td><td>${r.dept}</td><td style="font-size:12px">${r.shift}</td>
      <td>${r.schedIn}</td>
      <td style="font-weight:600;color:${r.cin==='—'?'var(--text3)':r.status==='Late'?'var(--red)':r.arrivalFlag==='Early Arrival'?'var(--blue)':'var(--green)'}">${r.cin}</td>
      <td style="font-size:12px;color:${r.lateStr.startsWith('+')?'var(--red)':r.lateStr.startsWith('-')?'var(--blue)':'var(--green)'}">${r.lateStr}</td>
      <td>${r.schedOut}</td>
      <td style="color:${r.cout==='Pending'?'var(--amber)':r.cout==='—'?'var(--text3)':'var(--text)'}">${r.cout}</td>
      <td>${statusBadge(r.status)}</td>
      <td><div class="access-actions" style="margin:0;flex-wrap:nowrap">
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();reviewApEmployeeAttendance(${Number(r.dbId)||0})" data-permission="attendance_edit">Review / Update</button>
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();openApEmployeeReport(${Number(r.dbId)||0})">Report</button>
      </div></td>
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
  document.getElementById('modalBody').innerHTML=`<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px"><div class="emp-av" style="width:48px;height:48px;font-size:16px;background:${e.color||COLORS[0]}">${initials(displayEmployeeName(e.name)||'?')}</div><div><div style="font-size:16px;font-weight:700">${escapeHtml(displayEmployeeName(e.name)||'')}</div><div style="color:var(--text2);font-size:13px">${e.designation||''} · ${e.dept||''}</div></div></div>${rows.map(([l,v])=>`<div class="detail-row"><span class="detail-label">${l}</span><span class="detail-val">${v}</span></div>`).join('')}<div style="margin-top:16px;display:flex;gap:8px"><button class="btn btn-primary btn-sm" onclick="openEmployeeEditor(${Number(e.dbId)})">Edit Details</button><button class="btn btn-outline btn-sm" onclick="viewEmployeeRecords(${Number(e.dbId)})">View Records</button><button class="btn btn-outline btn-sm" onclick="reviewApEmployeeAttendance(${Number(e.dbId)})" data-permission="attendance_edit">Review / Update</button><button class="btn btn-outline btn-sm" onclick="openApEmployeeReport(${Number(e.dbId)})">Generate Report</button><button class="btn btn-outline btn-sm" onclick="exportApEmployeeExcel(${Number(e.dbId)})">Export Editable Excel</button></div>`;
  document.getElementById('empModal').classList.add('open');
}
function closeModal(){document.getElementById('empModal').classList.remove('open')}

let apEditingEmployeeId=null,employeeRecordFilterId=null;
function openEmployeeEditor(id){
 if(!roleAllowed('super_admin')){notify('Only Super Admin can edit employee profiles.','error');return;}
 const e=employees.find(row=>String(row.dbId)===String(id));if(!e){notify('Employee was not found.','error');return;}
 apEditingEmployeeId=id;
 const fields=[['name','Full Name',displayEmployeeName(e.name)],['department','Department',e.dept],['designation','Designation',e.designation],['shift','Shift',e.shift],['phone','Phone',e.phone],['email','Email',e.email]];
 const departments=[...(apLocalConfig.departments||[]).map(x=>x.name),...employees.map(x=>x.dept),e.dept];
 const shifts=[...(apLocalConfig.shifts||[]).map(x=>x.name),...employees.map(x=>x.shift),e.shift];
 document.getElementById('apEmployeeEditFields').innerHTML=fields.map(([key,label,value])=>{
  if(key==='department'||key==='shift'){
   const opts=[...new Set((key==='department'?departments:shifts).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
   return `<label class="form-label" style="display:block;margin-top:10px">${escapeHtml(label)}<select class="ap-profile-input" name="${key}">${opts.map(v=>`<option value="${escapeHtml(v)}" ${v===value?'selected':''}>${escapeHtml(v)}</option>`).join('')}</select></label>`;
  }
  return `<label class="form-label" style="display:block;margin-top:10px">${escapeHtml(label)}<input class="ap-profile-input" name="${key}" value="${escapeHtml(value||'')}" ${key==='name'?'required minlength="2"':''} ${key==='email'?'type="email"':''}></label>`;
 }).join('');
 document.getElementById('apEmployeeEditOverlay').classList.add('open');closeModal();
}
function closeEmployeeEditor(){document.getElementById('apEmployeeEditOverlay').classList.remove('open');apEditingEmployeeId=null;}
async function saveEmployeeProfile(event){
 event.preventDefault();if(!apEditingEmployeeId)return;
 const id=apEditingEmployeeId,btn=document.getElementById('apProfileSaveButton');
 const profile=Object.fromEntries(new FormData(document.getElementById('apEmployeeEditForm')));
 btn.disabled=true;
 try{
  const result=await apiJSON('/api/employees/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify(profile)});
  if(!result.success)throw new Error('Profile could not be saved.');
  const employee=employees.find(e=>String(e.dbId)===String(id));if(employee){employee.name=profile.name;employee.dept=profile.department;employee.designation=profile.designation;employee.shift=profile.shift;employee.phone=profile.phone;employee.email=profile.email;}
  employeeProfileCache.delete(Number(id));ptsDirectoryCache.staff=null;closeEmployeeEditor();renderEmployees();
  notify('Employee profile saved to '+(result.saved_to==='supabase'?'Supabase.':'AttendPro.')+' Original biometric data is unchanged.','success');
  await loadRealData(true);
 }catch(err){notify('Employee profile could not be saved: '+err.message,'error');}
 finally{btn.disabled=false;}
}
async function viewEmployeeRecords(id){
 const person=employees.find(e=>String(e.dbId)===String(id));if(!person){notify('Employee not found.','error');return;}
 closeModal();employeeRecordFilterId=String(id);
 const d=new Date();const end=d.toISOString().slice(0,10);d.setDate(d.getDate()-90);const start=d.toISOString().slice(0,10);
 showScreen('records',document.querySelector('[data-screen=records]'));
 document.getElementById('recFrom').value=start;document.getElementById('recTo').value=end;
 const search=document.getElementById('recSearch');if(search)search.value=displayEmployeeName(person.name);
 recPage=1;await renderRecords();
 notify('Showing attendance for '+displayEmployeeName(person.name)+' (last 90 days). Use Clear to view all employees.','success');
}


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
  ['leave-pending','leave-approved','leave-announcements','leave-holidays'].forEach(t=>{const panel=document.getElementById(t);if(panel)panel.style.display='none';});
  const target=document.getElementById(id);if(target)target.style.display='block';
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
  const from=document.getElementById('rptFrom').value||currentDataDate||today();
  const to=document.getElementById('rptTo').value||today();
  const rows=liveData.slice(0,20);
  document.getElementById('reportPreview').innerHTML=`
    <div style="border-bottom:1px solid var(--gray200);padding-bottom:12px;margin-bottom:14px">
      <div style="font-size:16px;font-weight:700;text-align:center">${escapeHtml(apLocalConfig.organization?.name||'AttendPro')}</div>
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
      <button class="btn btn-primary btn-sm" onclick="printMasterAttendanceReport()">🖨 Print Report</button>
      <button class="btn btn-outline btn-sm" onclick="notify('Export to Excel requires backend integration')">📊 Export Excel</button>
      <button class="btn btn-outline btn-sm" onclick="notify('Export to PDF requires backend integration')">📄 Export PDF</button>
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
  const selected=currentDashboard?.shift||'';
  const selectedRows=liveData.filter(r=>shiftMatchesFront(r.shift,selected));
  const selectedIds=new Set(selectedRows.map(r=>String(r.dbId)));
  const tbody=document.getElementById('deptSummaryBody');
  if(tbody && currentDashboard?.departments){
    tbody.innerHTML=currentDashboard.departments.map(d=>`<tr><td>${escapeHtml(d.department||'Unassigned')}</td><td>${d.total||0}</td><td style="color:#10b981;font-weight:600">${d.present||0}</td><td style="color:#ef4444;font-weight:600">${d.absent||0}</td><td style="color:#8b5cf6;font-weight:600">${d.on_leave||0}</td></tr>`).join('')||'<tr><td colspan="5">No department data</td></tr>';
  }
  const recent=document.getElementById('recentActivity');
  if(recent){
    const filteredPunches=recentPunches.filter(p=>!selected||selected==='All Shifts'||selectedIds.has(String(p.employee_id)));
    const rows=filteredPunches.length?filteredPunches.slice().sort((a,b)=>String(b.happened_at).localeCompare(String(a.happened_at))).slice(0,8).map(p=>{
      const kind=String(p.kind||'CHECK').toUpperCase();
      const employee=employees.find(e=>String(e.dbId)===String(p.employee_id))||{};
      const name=p.name||employee.name||p.badge_number||'Unmapped employee';
      const dept=p.department||employee.dept||'Unassigned';
      return `<tr><td><div style="display:flex;align-items:center;gap:6px">${avEl({color:employee.color||COLORS[0],name},24)}<span>${escapeHtml(name)}</span></div></td><td><span class="badge b-blue" style="font-size:10px">${escapeHtml(kind)}</span></td><td style="font-family:monospace;font-size:12px">${showTime(p.happened_at)}</td><td style="font-size:12px">${escapeHtml(dept)}</td><td>${statusBadge(kind==='IN'?'Present':kind==='OUT'?'Present':'Recorded')}</td></tr>`;
    }):selectedRows.filter(r=>r.cin!=='—').slice(0,8).map(r=>`<tr><td><div style="display:flex;align-items:center;gap:6px">${avEl(r,24)}<span>${escapeHtml(r.name)}</span></div></td><td><span class="badge b-blue" style="font-size:10px">CHECK-IN</span></td><td style="font-family:monospace;font-size:12px">${escapeHtml(r.cin)}</td><td style="font-size:12px">${escapeHtml(r.dept)}</td><td>${statusBadge(r.status)}</td></tr>`);
    recent.innerHTML=rows.join('')||'<tr><td colspan="5" style="color:var(--text3)">No attendance punches for this date and shift.</td></tr>';
  }
  const exc=document.getElementById('exceptions');
  if(exc){
    const rows=[...selectedRows.filter(r=>r.status==='Absent').slice(0,2).map(r=>({r,label:'Absent',cls:'b-red',desc:r.dept})),
      ...selectedRows.filter(r=>r.status==='Late').slice(0,2).map(r=>({r,label:'Late',cls:'b-amber',desc:r.lateStr+' late'})),
      ...selectedRows.filter(r=>r.status==='Missing Check-in'||r.status==='Not Checked In').slice(0,2).map(r=>({r,label:'Unconfirmed',cls:'b-gray',desc:'No confirmed attendance'}))];
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
  } catch(e) { notify('Could not load report data: '+e.message); return; }
  currentReportRows=rows;
  const shown=rows.slice(0,100);
  document.getElementById('reportPreview').innerHTML=`<div style="border-bottom:1px solid var(--gray200);padding-bottom:12px;margin-bottom:14px"><div style="font-size:16px;font-weight:700;text-align:center">AttendPro — Attendance Report</div><div style="text-align:center;color:var(--text2);font-size:13px;margin-top:4px">${escapeHtml(type)}</div><div style="text-align:center;font-size:11px;color:var(--text3);margin-top:2px">Period: ${escapeHtml(from)} to ${escapeHtml(to)} · Generated: ${new Date().toLocaleString()}</div></div><div class="tbl-wrap"><table><thead><tr><th>ID</th><th>Name</th><th>Dept</th><th>Check-in</th><th>Check-out</th><th>Status</th></tr></thead><tbody>${shown.map(r=>`<tr><td style="font-size:11px;font-family:monospace">${escapeHtml(r.id)}</td><td>${escapeHtml(r.name)}</td><td style="font-size:11px">${escapeHtml(r.dept)}</td><td>${escapeHtml(r.cin)}</td><td>${escapeHtml(r.cout)}</td><td>${statusBadge(r.status)}</td></tr>`).join('')}</tbody></table></div><div style="margin-top:12px;padding:10px;background:var(--gray50);border-radius:6px;display:flex;gap:20px;flex-wrap:wrap;font-size:12px"><span>Records: <strong>${rows.length}</strong></span><span>Present: <strong>${rows.filter(r=>r.status==='Present'||r.status==='Early Arrival').length}</strong></span><span>Late: <strong>${rows.filter(r=>r.status==='Late').length}</strong></span><span>Absent: <strong>${rows.filter(r=>r.status==='Absent').length}</strong></span></div><div style="display:flex;gap:8px;margin-top:14px"><button class="btn btn-primary btn-sm" onclick="printMasterAttendanceReport()">🖨 Print Report</button><button class="btn btn-outline btn-sm" onclick="downloadReportCsv()">📊 Export CSV</button></div>`;
  document.getElementById('printTitle').textContent=type;
  document.getElementById('printMeta').textContent=`Period: ${from} to ${to} · Generated: ${new Date().toLocaleString()}`;
  document.getElementById('printTbody').innerHTML=shown.map(r=>`<tr><td style="border:1px solid #ddd;padding:5px">${escapeHtml(r.id)}</td><td style="border:1px solid #ddd;padding:5px">${escapeHtml(r.name)}</td><td style="border:1px solid #ddd;padding:5px">${escapeHtml(r.dept)}</td><td style="border:1px solid #ddd;padding:5px">${escapeHtml(r.cin)}</td><td style="border:1px solid #ddd;padding:5px">${escapeHtml(r.cout)}</td><td style="border:1px solid #ddd;padding:5px">${escapeHtml(r.wh||'—')}</td><td style="border:1px solid #ddd;padding:5px">${escapeHtml(r.status)}</td></tr>`).join('');
}
function downloadReportCsv(){
  const rows=currentReportRows||[];
  if(!rows.length){notify('Generate a report preview first.');return;}
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
  if(permission==='supervisor')return role==='supervisor'||role==='super_admin';
  if(permission==='attendance_edit')return role==='supervisor'||role==='super_admin';
  if(permission==='view_only')return ['view_only','supervisor','super_admin'].includes(role);
  return true;
}
function applyPermissions() {
  document.querySelectorAll('[data-permission]').forEach(el=>el.classList.toggle('role-hidden',!roleAllowed(el.dataset.permission)));
  const isViewOnly=currentUser?.role==='view_only';
  const fullDashboard=document.getElementById('fullDashboardContent'),viewDashboard=document.getElementById('viewOnlyDashboard');
  if(fullDashboard)fullDashboard.style.display=isViewOnly?'none':'';
  if(viewDashboard)viewDashboard.style.display=isViewOnly?'block':'none';
  document.querySelectorAll('.sb-nav .nav-item').forEach(el=>el.classList.toggle('role-hidden',isViewOnly&&el.dataset.screen!=='dashboard'));
  document.querySelectorAll('.sb-nav .sb-section').forEach((el,index)=>el.classList.toggle('role-hidden',isViewOnly&&index>0));
  const deviceNav=document.getElementById('deviceNavList');if(deviceNav)deviceNav.classList.toggle('role-hidden',isViewOnly);
  ['.tb-search','.aplp-app-home','#apNotificationBell'].forEach(selector=>{const el=document.querySelector(selector);if(el)el.classList.toggle('role-hidden',isViewOnly);});
  const name=currentUser?.display_name||'AttendPro User';
  const roleName=({view_only:'View Only User',supervisor:'Supervisor',super_admin:'Super Admin'})[currentUser?.role]||'User';
  const sn=document.getElementById('sidebarUserName'),sr=document.getElementById('sidebarUserRole'),av=document.getElementById('userAvatar');
  if(sn)sn.textContent=name;if(sr)sr.textContent=roleName;if(av)av.textContent=name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
}
// Backward-compatible name used by the PTS trainee/leave record renderers.
// Keep both names so existing modules continue to apply the same role rules.
function applyRolePermissions(){ return applyPermissions(); }
let cloudMode = false;
let originalReportRows = [];
async function initAuth() {
  initSidebar();
  try {
    const result=await apiJSON('/api/auth/status');
    cloudMode = result.mode === 'supabase';
    if(cloudMode){const label=document.getElementById('loginUsernameLabel');if(label)label.textContent='Email address (Supabase Auth)';const input=document.getElementById('loginUsername');if(input){input.type='email';input.autocomplete='email';input.placeholder='you@company.com';if(input.value==='admin')input.value='';}}else{const label=document.getElementById('loginUsernameLabel');if(label)label.textContent='Username';const input=document.getElementById('loginUsername');if(input){input.type='text';input.autocomplete='username';input.placeholder='Username';}}

    const help=document.getElementById('editSaveHelp');
    if(help)help.textContent=cloudMode?'Manual corrections are saved to Supabase with an audit trail; original biometric data remains unchanged.':'Edits affect only AttendPro local data; source MDB is never modified.';
    const dHelp=document.getElementById('discrepancySaveHelp');
    if(dHelp)dHelp.textContent=cloudMode?'Approved reviews and corrections are saved to Supabase; original biometric punches remain unchanged.':'Reviews are saved locally; original punches and MDB remain unchanged.';
    if(cloudMode){ const el=document.querySelector('.demo-badge');if(el)el.textContent='☁ Supabase Mode — Cloud Authentication'; }
    const newUserLabel=document.getElementById('newUserNameLabel'),newUserInput=document.getElementById('newUserName');
    if(newUserLabel)newUserLabel.textContent=cloudMode?'Email address':'Username';
    if(newUserInput){newUserInput.type=cloudMode?'email':'text';newUserInput.placeholder=cloudMode?'name@company.com':'Username';}
    if(result.authenticated){
      currentUser=result.user;
      document.body.classList.remove('portal-login-open');
      document.getElementById('loginOverlay').classList.remove('open');
      applyPermissions();
      await loadRealData(true);
    } else if(typeof aplpPortalScreenFromHash==='function' && aplpPortalScreenFromHash()) {
      document.body.classList.add('portal-login-open');
      document.getElementById('loginOverlay').classList.add('open');
    } else {
      document.body.classList.remove('portal-login-open');
      document.getElementById('loginOverlay').classList.remove('open');
    }
  } catch(e) {
    if(typeof aplpPortalScreenFromHash==='function' && aplpPortalScreenFromHash()) {
      document.body.classList.add('portal-login-open');
      document.getElementById('loginOverlay').classList.add('open');
    } else {
      document.body.classList.remove('portal-login-open');
      document.getElementById('loginOverlay').classList.remove('open');
    }
  }
}
async function loginUser(event) {
  if(event)event.preventDefault();
  const error=document.getElementById('loginError');error.style.display='none';
  try {
    const result=await apiJSON('/api/auth/login',{method:'POST',body:JSON.stringify({username:document.getElementById('loginUsername').value.trim(),password:document.getElementById('loginPassword').value})});
    currentUser=result.user;
    document.body.classList.remove('portal-login-open');
    document.getElementById('loginOverlay').classList.remove('open');
    document.getElementById('loginPassword').value='';
    applyPermissions();
    await loadRealData(true);
  } catch(e) {error.textContent=englishMessage(e.message||'Login failed. Please try again.');error.style.display='block';}
}
async function logoutUser() {
  if(!currentUser)return;
  if(!await appConfirm('Are you sure you want to log out?'))return;
  try{await apiJSON('/api/auth/logout',{method:'POST'});}catch(_){}
  currentUser=null;
  document.body.classList.add('portal-login-open');
  document.getElementById('loginOverlay').classList.add('open');
  applyPermissions();
}
async function changeMyPassword() {
  const current=document.getElementById('currentPassword').value,newPass=document.getElementById('newPassword').value;
  try{const r=await apiJSON('/api/auth/change-password',{method:'POST',body:JSON.stringify({current_password:current,new_password:newPass})});notify(r.message||'Password updated.');document.getElementById('currentPassword').value='';document.getElementById('newPassword').value='';}
  catch(e){notify(e.message);}
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
  notify(deviceInfoText(d));
}
function renderDeviceUI(devices,activeId) {
  devices=Array.isArray(devices)?devices:[];activeId=activeId??currentSettings.active_device_id;
  const sidebar=document.getElementById('deviceNavList');
  if(sidebar)sidebar.innerHTML=devices.map(d=>`<div class="nav-item device-nav-item ${String(d.id)===String(activeId)?'active':''}" data-status="${escapeHtml(d.status||'not_configured')}" title="${escapeHtml(d.name)} — ${escapeHtml(deviceStatusText(d))}" onclick="handleDeviceNav(${Number(d.id)})"><span class="device-nav-dot"></span><span class="nav-label">${escapeHtml(d.name)}</span></div>`).join('');
  const dashboard=document.getElementById('dashboardDevices');
  if(dashboard)dashboard.innerHTML=devices.map(d=>`<div class="device-mini-card"><div class="device-mini-icon">👁</div><div class="device-mini-info"><div class="device-mini-name">${escapeHtml(d.name)}</div><div class="device-mini-model">${escapeHtml(d.model||'ZKTeco biometric terminal')}</div><div class="device-mini-state ${d.status==='online'?'online':''}">● ${escapeHtml(deviceStatusText(d))}</div></div><div class="device-mini-actions"><button onclick="showDeviceInfo(${Number(d.id)})" title="Device information">ⓘ Info</button><button data-permission="super_admin" onclick="selectDevice(${Number(d.id)},true)">${String(d.id)===String(activeId)?'Selected':'Switch'}</button></div></div>`).join('')||'<div class="card">No devices added yet.</div>';
  const cardHTML=devices.map(d=>`<div class="device-list-item ${String(d.id)===String(activeId)?'selected':''}"><div class="device-list-head"><div><div class="device-list-title">👁 ${escapeHtml(d.name)}</div><div class="device-list-sub">${escapeHtml(d.model||'ZKTeco')} · S/N: ${escapeHtml(d.serial_number||'—')}</div><div class="device-list-sub">Status: <strong>${escapeHtml(deviceStatusText(d))}</strong></div><div class="device-list-sub" title="${escapeHtml(d.path||'')}" style="overflow-wrap:anywhere">${escapeHtml(d.path||'MDB path not configured')}</div></div><button class="device-info-btn" onclick="showDeviceInfo(${Number(d.id)})" title="Device information">i</button></div><div class="device-list-actions"><button class="btn btn-primary btn-sm" data-permission="super_admin" onclick="selectDevice(${Number(d.id)},true)">${String(d.id)===String(activeId)?'Selected Device':'Switch Device'}</button><button class="btn btn-outline btn-sm" onclick="showDeviceInfo(${Number(d.id)})">ⓘ Info</button><button class="btn btn-outline btn-sm" data-permission="super_admin" onclick="editDevice(${Number(d.id)})">Edit</button><button class="btn btn-outline btn-sm" data-permission="super_admin" onclick="testSpecificDevice(${Number(d.id)})">Test MDB</button><button class="btn btn-outline btn-sm" data-permission="super_admin" onclick="syncSpecificDevice(${Number(d.id)})">Sync Now</button><button class="btn btn-red btn-sm" data-permission="super_admin" onclick="deleteDevice(${Number(d.id)})">Delete</button></div></div>`).join('')||'<div class="access-help">No devices configured yet.</div>';
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
  }catch(e){notify('Could not switch device: '+e.message);}
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
    await selectDevice(id,true);notify('Device added. Verify its MDB path using Test MDB.');
  }catch(e){notify('Could not add device: '+e.message);}
}
async function editDevice(id) {
  const d=(currentSettings.devices||[]).find(x=>String(x.id)===String(id));if(!d)return;
  const name=await appPrompt('Device name',d.name);if(name===null)return;
  const model=await appPrompt('Device model',d.model||'ZKTeco uFace 800');if(model===null)return;
  const path=await appPrompt('Full .mdb file path (blank to clear)',d.path||'');if(path===null)return;
  try{await apiJSON(`/api/devices/${id}`,{method:'PUT',body:JSON.stringify({name,model,mdb_path:path})});await loadAccessSettings();await loadRealData(true);}
  catch(e){notify('Could not update device: '+e.message);}
}
async function deleteDevice(id) {
  const d=(currentSettings.devices||[]).find(x=>String(x.id)===String(id));if(!d||!await appConfirm(`${d.name} Do you want to delete this device? Attendance records will be preserved.`))return;
  try{await apiJSON(`/api/devices/${id}`,{method:'DELETE'});await loadAccessSettings();await loadRealData(true);}
  catch(e){notify('Could not delete device: '+e.message);}
}
async function testSpecificDevice(id) {
  try{const r=await apiJSON(`/api/devices/${id}/test`,{method:'POST'});await loadAccessSettings();notify((r.success?'SUCCESS: ':'ERROR: ')+(r.message||'Test complete'));}
  catch(e){notify('MDB test failed: '+e.message);}
}
async function syncSpecificDevice(id) {
  try{const r=await apiJSON(`/api/devices/${id}/sync`,{method:'POST'});await loadAccessSettings();await loadRealData(true);notify((r.success?'Sync completed: ':'Sync failed: ')+(r.message||JSON.stringify(r)));}
  catch(e){notify('Sync error: '+e.message);}
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
  } catch(e){if(showError)notify('Could not load settings: '+e.message);return null;}
}
async function saveAccessSettings(quiet=false) {
  try{
    const body={access_path:document.getElementById('accessPath').value.trim(),access_auto:document.getElementById('accessAuto').checked,access_interval:Number(document.getElementById('accessInterval').value||90)};
    currentSettings=await apiJSON('/api/settings',{method:'PUT',body:JSON.stringify(body)});await loadAccessSettings();
    if(!quiet)notify('Database settings saved.');return true;
  }catch(e){notify('Could not save settings: '+e.message);return false;}
}
async function testAccessDB() {
  if(!await saveAccessSettings(true))return;
  try{const r=await apiJSON('/api/database/test',{method:'POST'});await loadAccessSettings();notify((r.success?'SUCCESS: ':'ERROR: ')+(r.message||'Test complete'));}
  catch(e){notify('MDB test failed: '+e.message);}
}
async function syncAccessDB() {
  if(!await saveAccessSettings(true))return;
  try{const r=await apiJSON('/api/database/sync?force=true',{method:'POST'});await loadAccessSettings();await loadRealData(true);notify((r.success?'Sync completed: ':'Sync failed: ')+(r.message||JSON.stringify(r)));}
  catch(e){notify('Sync error: '+e.message);}
}
function showScreen(name,el) {
  if(currentUser?.role==='view_only'&&name!=='dashboard'){notify('View Only account ko sirf Dashboard aur previous-day attendance ki access hai.','error');return;}
  document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
  const target=document.getElementById('screen-'+name);if(target)target.classList.add('active');if(el)el.classList.add('active');
  if(name==='live')setLiveAttendanceMode(liveAttendanceMode);
  if(name==='employees')renderEmployees();
  if(name==='trainees')loadPtsTrainees();
  if(name==='pts-trainee-attendance')loadPtsAttendance();
  if(name==='pts-trainee-leave')loadPtsRecords('leave','trainee');
  if(name==='pts-trainee-osd')loadPtsRecords('osd','trainee');
  if(name==='pts-staff-leave')loadPtsRecords('leave','staff');
  if(name==='pts-staff-osd')loadPtsRecords('osd','staff');
  if(name==='pts-staff-osd-permanent')loadPtsRecords('osd_permanent','staff');
  if(name==='pts-duty-rest')loadPtsRecords('duty_rest','staff');
  if(name==='leave')loadLeaveManagement();
  if(name==='dashboard'&&ptsDashboardMode==='trainee'&&currentUser?.role!=='view_only')loadPtsDashboard();
  if(name==='records'){if(!document.getElementById('recFrom').value)setDefaultDates();renderRecords();}
  if(name==='device'){loadAccessSettings();}
  if(name==='settings'){loadAccessSettings();renderApSettings();}
  if(name==='users')loadUsers();
  if(name==='reports'){const day=currentDataDate||today();for(const id of ['rptFrom','rptTo']){const el=document.getElementById(id);if(el&&!el.value)el.value=day;}loadTraineeReportDefaults();}
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
function clearRecordFilters(){employeeRecordFilterId=null;['recSearch','recDept','recStatus'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});setDefaultDates();renderRecords();}
function recordHistoryHTML(employeeId) {
  const rows=recData.filter(x=>String(x.dbId||x.employee_id)===String(employeeId)).slice().sort((a,b)=>b.date.localeCompare(a.date));
  if(!rows.length)return '<div class="record-detail-box">No more records were found for this employee in the selected date range.</div>';
  return `<div class="record-detail-box"><strong>Employee attendance history (selected date range)</strong><div class="tbl-wrap" style="margin-top:8px"><table><thead><tr><th>Date</th><th>Timetable</th><th>Clock In</th><th>Clock Out</th><th>Department</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${escapeHtml(x.date)}</td><td>${escapeHtml(x.timetable||'—')}</td><td>${escapeHtml(x.cin||'—')}</td><td>${escapeHtml(x.cout||'—')}</td><td>${escapeHtml(x.dept)}</td><td>${statusBadge(x.status)}</td><td><button class="btn btn-outline btn-sm" data-permission="attendance_edit" onclick='openAttendanceEditorByKey(${JSON.stringify(recordKey(x))})'>Review / Update</button></td></tr>`).join('')}</tbody></table></div></div>`;
}
function toggleRecordDetails(key) {expandedRecordKey=expandedRecordKey===key?'':key;renderRecords();}
// Attendance Records intentionally uses a flat table: profile dropdowns belong to People > Employees only.
async function renderRecords() {
  await loadHistoryForRange(false);
  const dept=document.getElementById('recDept')?.value||'',status=document.getElementById('recStatus')?.value||'';
  const from=document.getElementById('recFrom')?.value||'',to=document.getElementById('recTo')?.value||'';
  const search=(document.getElementById('recSearch')?.value||'').toLowerCase();
  const data=recData.filter(r=>(!from||r.date>=from)&&(!to||r.date<=to)&&(!dept||r.dept===dept)&&(!status||r.status===status)&&(!employeeRecordFilterId||String(r.dbId||r.employee_id)===String(employeeRecordFilterId))&&(!search||!!employeeRecordFilterId||r.name.toLowerCase().includes(search)||String(r.id).toLowerCase().includes(search)));
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
      <td><div class="access-actions" style="margin:0;flex-wrap:nowrap">${canEdit?`<button class="btn btn-primary btn-sm" onclick='openAttendanceEditorByKey(${JSON.stringify(key)})'>Review / Update</button>`:'<span style="color:var(--text3);font-size:12px">View only</span>'}<button class="btn btn-outline btn-sm" onclick="openApEmployeeReport(${Number(r.dbId||r.employee_id)||0})">Report</button></div></td>
    </tr>`;
  }).join('')||'<tr><td colspan="9" style="color:var(--text3);text-align:center;padding:22px">No records match these filters.</td></tr>';
  renderPag('recPag',recPage,pages,total,pp,p=>{recPage=p;renderRecords();});
}
function openAttendanceEditorForRecord(r){
  if(!r)return;
  if(!roleAllowed('attendance_edit')){notify('Your role does not allow attendance editing.');return;}
  currentEditRecord=r;
  document.getElementById('editEmployeeName').textContent=`${r.name} (${r.id})`;
  document.getElementById('editWorkDateLabel').textContent=r.date;
  document.getElementById('editShift').value=/^\d{2}:\d{2}$/.test(String(r.timetable||r.schedIn||''))?(r.timetable||r.schedIn):'09:00';
  document.getElementById('editClockIn').value=/^\d{2}:\d{2}$/.test(String(r.cin||''))?r.cin:'';
  document.getElementById('editClockOut').value=/^\d{2}:\d{2}$/.test(String(r.cout||''))?r.cout:'';
  const status=String(r.status||'').toLowerCase().replaceAll(' ','_');document.getElementById('editStatus').value=({ 'missing_check-in':'not_checked_in','missing_check_in':'not_checked_in','not_checked_in':'not_checked_in','on_leave':'on_leave','early_arrival':'early_arrival'})[status]||(['present','late','absent','on_leave','early_arrival','not_checked_in'].includes(status)?status:'present');
  document.getElementById('attendanceEditModal').classList.add('open');
}
function openAttendanceEditorByKey(key) {
  const r=recData.find(x=>recordKey(x)===key);openAttendanceEditorForRecord(r);
}
function openDiscrepancyPunchEditor(){
  const c=currentDiscrepancy;if(!c)return;
  const employee=employees.find(e=>String(e.dbId)===String(c.employee_id))||{};
  const row={dbId:c.employee_id,employee_id:c.employee_id,date:c.work_date,id:String(c.badge_number||employee.id||c.employee_id),
    name:c.name||employee.name||'Unknown',dept:c.department||employee.dept||'Unassigned',
    timetable:c.shift||employee.shift||'09:00',cin:c.clock_in||'',cout:c.clock_out||'',status:titleStatus(c.status)};
  closeDiscrepancyModal();
  openAttendanceEditorForRecord(row);
}
function openDashboardDiscrepancies(issue){
  if(!roleAllowed('attendance_edit'))return;
  const day=currentDataDate||today();
  const from=document.getElementById('discFrom'),to=document.getElementById('discTo');
  const issueEl=document.getElementById('discIssue'),state=document.getElementById('discState');
  if(from)from.value=day;if(to)to.value=day;if(issueEl)issueEl.value=issue||'';if(state)state.value='all';
  discrepancyPage=1;showScreen('discrepancies',document.querySelector('[data-screen="discrepancies"]'));loadDiscrepancies();
}
function closeAttendanceEditor(){document.getElementById('attendanceEditModal').classList.remove('open');currentEditRecord=null;}
async function viewOriginalAudit(){
 if(!currentEditRecord)return;
 const id=currentEditRecord.dbId||currentEditRecord.employee_id;
 try{
  const data=await apiJSON('/api/attendance/provenance?'+new URLSearchParams({employee_id:id,work_date:currentEditRecord.date}).toString());
  const fmt=x=>x?`Status: ${x.status||'—'}, In: ${x.clock_in||'—'}, Out: ${x.clock_out||'—'}`:'No original daily row';
  const audits=(data.cloud_audit||[]).slice(0,8).map(a=>`${a.created_at}: ${a.action} (${a.reason})`).join('\n');
  notify('ORIGINAL / BIOMETRIC SOURCE\n'+fmt(data.original)+'\n\nCURRENT EFFECTIVE REPORT\n'+fmt(data.effective)+
        '\n\nRaw punches: '+(data.raw_punches||[]).length+'\n\nCLOUD CHANGE AUDIT\n'+(audits||'No approved changes yet.'));
 }catch(e){notify('Could not load audit: '+e.message);}
}

async function saveAttendanceEdit() {
  if(!currentEditRecord)return;
  const body={employee_id:currentEditRecord.dbId||currentEditRecord.employee_id,work_date:currentEditRecord.date,clock_in:document.getElementById('editClockIn').value,clock_out:document.getElementById('editClockOut').value,shift:document.getElementById('editShift').value||'09:00',status:document.getElementById('editStatus').value,action:'update'};
  if(cloudMode){body.reason=await appPrompt('Reason for attendance correction (required for audit):')||'';if(body.reason.trim().length<3){notify('Correction cancelled: enter a reason (3+ characters).');return;}}
  try{const r=await apiJSON('/api/attendance/edit',{method:'PUT',body:JSON.stringify(body)});closeAttendanceEditor();notify(r.message||'Attendance updated successfully.');await loadRealData(true);await loadHistoryForRange(false);renderRecords();if(document.getElementById('screen-discrepancies')?.classList.contains('active'))await loadDiscrepancies();if(document.getElementById('screen-discrepancies')?.classList.contains('active'))await loadDiscrepancies();}
  catch(e){notify('Could not update attendance: '+e.message);}
}
async function quickAttendanceAction(action) {
  if(!currentEditRecord)return;
  const reason=cloudMode?(await appPrompt('Reason for manual '+action+' (required):')||''):'';
  if(cloudMode&&reason.trim().length<3){notify('Enter a reason (3+ characters).');return;}
  try{const r=await apiJSON('/api/attendance/edit',{method:'PUT',body:JSON.stringify({employee_id:currentEditRecord.dbId||currentEditRecord.employee_id,work_date:currentEditRecord.date,action,reason})});closeAttendanceEditor();notify(r.message||'Attendance updated successfully.');await loadRealData(true);await loadHistoryForRange(false);renderRecords();}
  catch(e){notify('Attendance action failed: '+e.message);}
}
async function loadUsers() {
  if(!roleAllowed('super_admin'))return;
  const tbody=document.getElementById('usersTbody');if(!tbody)return;
  try{
    const result=await apiJSON('/api/users');userCache=result.items||[];
    tbody.innerHTML=userCache.map(u=>`<tr><td>${escapeHtml(u.display_name)}</td><td>${escapeHtml(u.username)}</td><td>${escapeHtml(({view_only:'View Only User',supervisor:'Supervisor',super_admin:'Super Admin'})[u.role]||u.role)}</td><td>${u.active?'<span class="badge b-green">Active</span>':'<span class="badge b-gray">Disabled</span>'}</td><td><div style="display:flex;gap:5px;flex-wrap:wrap"><button class="btn btn-outline btn-sm" onclick="editUser(${u.id})">Edit</button><button class="btn btn-outline btn-sm" onclick="resetUserPassword(${u.id})">Reset Password</button><button class="btn btn-outline btn-sm" onclick="toggleUserActive(${u.id})">${u.active?'Disable':'Enable'}</button><button class="btn btn-red btn-sm" onclick="deleteUser(${u.id})">Delete</button></div></td></tr>`).join('')||'<tr><td colspan="5">No users found.</td></tr>';
  }catch(e){tbody.innerHTML=`<tr><td colspan="5">Could not load users: ${escapeHtml(e.message)}</td></tr>`;}
}
async function createUser() {
  const body={display_name:document.getElementById('newUserDisplay').value.trim(),username:document.getElementById('newUserName').value.trim(),role:document.getElementById('newUserRole').value,password:document.getElementById('newUserPassword').value};
  try{await apiJSON('/api/users',{method:'POST',body:JSON.stringify(body)});['newUserDisplay','newUserName','newUserPassword'].forEach(id=>document.getElementById(id).value='');await loadUsers();notify('User created successfully.');}
  catch(e){notify('Could not create user: '+e.message);}
}
async function editUser(id) {
  const u=userCache.find(x=>x.id===id);if(!u)return;
  const display_name=await appPrompt('Display name',u.display_name);if(display_name===null)return;
  const role=await appPrompt('Enter role: view_only, supervisor, super_admin',u.role);if(role===null)return;
  try{await apiJSON(`/api/users/${id}`,{method:'PUT',body:JSON.stringify({display_name,role:role.trim()})});await loadUsers();}
  catch(e){notify('Could not update user: '+e.message);}
}
async function resetUserPassword(id) {
  const password=await appPrompt('New password (at least 8 characters)');if(password===null)return;
  try{await apiJSON(`/api/users/${id}`,{method:'PUT',body:JSON.stringify({password})});notify('Password reset.');}
  catch(e){notify('Could not reset password: '+e.message);}
}
async function toggleUserActive(id) {
  const u=userCache.find(x=>x.id===id);if(!u)return;
  try{await apiJSON(`/api/users/${id}`,{method:'PUT',body:JSON.stringify({active:!u.active})});await loadUsers();}
  catch(e){notify('Could not update user status: '+e.message);}
}
async function deleteUser(id) {
  const u=userCache.find(x=>x.id===id);if(!u||!await appConfirm(`${u.display_name} account should be deleted?`))return;
  try{await apiJSON(`/api/users/${id}`,{method:'DELETE'});await loadUsers();}
  catch(e){notify('Could not delete user: '+e.message);}
}
function updateReportCell(index,field,value) {if(currentReportRows[index])currentReportRows[index][field]=String(value??'').trim();}
async function saveReportToSupabase(){
 if(!cloudMode||!roleAllowed('attendance_edit')){notify('Supervisor/Super Admin permission required.');return;}
 if(currentReportExportMode!=='attendance'){notify('Generate a detailed attendance report to save corrections. Summary tables are read-only.','warning');return;}
 const fields=['cin','cout','status','timetable'];
 const changed=(currentReportRows||[]).filter((r,i)=>fields.some(f=>String(r[f]??'')!==String(originalReportRows[i]?.[f]??'')));
 if(!changed.length){notify('No attendance changes to save.');return;}
 if(changed.length>100){notify('Save in smaller batches of up to 100 changes.');return;}
 const reason=await appPrompt(`Reason for applying ${changed.length} corrections to Supabase (audit required):`)||'';
 if(reason.trim().length<3){notify('Save cancelled: reason required.');return;}
 if(!await appConfirm(`Save ${changed.length} corrections to Supabase? Original biometric punches will not change.`))return;
 let ok=0;const failed=[];
 for(const r of changed){
  const status=String(r.status||'').toLowerCase().replace(/\s+/g,'_');
  try{
   await apiJSON('/api/attendance/edit',{method:'PUT',body:JSON.stringify({
     employee_id:r.employee_id,work_date:r.date,clock_in:r.cin,clock_out:r.cout,
     status,shift:r.timetable,action:'update',reason})});ok++;
  }catch(e){failed.push(`${r.name} (${r.date}): ${e.message}`);}
 }
 notify(`${ok} correction(s) saved to Supabase.${failed.length?' Failed: '+failed.slice(0,5).join(' | '):''}`);
 await showReportPreview();await loadRealData(true);
}

function addDaysToIso(day, delta) {
  const value = new Date(`${day}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + delta);
  return value.toISOString().slice(0,10);
}

function loadTraineeReportDefaults(){
  const from=document.getElementById('ptsReportFrom'),to=document.getElementById('ptsReportTo');
  if(from&&!from.value)from.value=currentDataDate||today();
  if(to&&!to.value)to.value=currentDataDate||today();
}
async function loadTraineeReport(){
  const from=document.getElementById('ptsReportFrom')?.value||currentDataDate||today();
  const to=document.getElementById('ptsReportTo')?.value||from;
  const shift=document.getElementById('ptsReportShift')?.value||'';
  const body=document.getElementById('ptsReportTbody');if(body)body.innerHTML='<tr><td colspan="9">Loading trainee report…</td></tr>';
  if(from>to){notify('From date must be before or equal to To date.','error');return;}
  try{
    const q=new URLSearchParams({from_date:from,to_date:to});if(shift)q.set('shift',shift);
    const result=await apiJSON('/api/pts/attendance/history?'+q.toString());
    ptsReportRows=result.items||[];
    if(body)body.innerHTML=ptsReportRows.length?ptsReportRows.map(r=>`<tr><td>${escapeHtml(r.employee_no||'')}</td><td><strong>${escapeHtml(r.name||'')}</strong></td><td>${escapeHtml(r.course_name||'—')}</td><td>${escapeHtml(r.platoon||'—')}</td><td>${escapeHtml(r.attendance_date||'')}</td><td>${escapeHtml(r.shift||'')}</td><td>${escapeHtml(r.check_in||'—')}</td><td>${escapeHtml(r.check_out||'—')}</td><td>${ptsStatusBadge(r.status||'not_marked')}</td></tr>`).join(''):'<tr><td colspan="9">No trainee attendance records were found for this period.</td></tr>';
    notify(`${ptsReportRows.length} trainee attendance rows loaded.`, 'success');
  }catch(e){ptsReportRows=[];if(body)body.innerHTML=`<tr><td colspan="9">${escapeHtml(englishMessage(e.message))}</td></tr>`;notify('Trainee report could not be loaded: '+e.message,'error');}
}
function exportTraineeReportCsv(){
  if(!ptsReportRows.length){notify('Pehle trainee report preview karein.','error');return;}
  const fields=['employee_no','name','course_name','platoon','attendance_date','shift','check_in','check_out','status'];
  const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const csv=[fields.join(','),...ptsReportRows.map(r=>fields.map(k=>quote(r[k])).join(','))].join('\r\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`attendpro-trainee-attendance-${document.getElementById('ptsReportFrom')?.value||today()}.csv`;a.click();URL.revokeObjectURL(url);
}

async function runQuickReport(kind) {
  const baseDate = currentDataDate || today();
  let from = baseDate, to = baseDate, type = 'Daily Attendance Register', title = 'Attendance Register';
  if (kind === 'week') {
    from = addDaysToIso(baseDate, -6);
    type = 'Monthly Attendance Summary';
    title = 'This Week Summary';
  } else if (kind === 'late') {
    const monthDate = new Date(`${baseDate}T00:00:00Z`);
    const year = monthDate.getUTCFullYear();
    const month = monthDate.getUTCMonth();
    from = `${year}-${String(month + 1).padStart(2,'0')}-01`;
    to = `${year}-${String(month + 1).padStart(2,'0')}-${String(new Date(Date.UTC(year,month+1,0)).getUTCDate()).padStart(2,'0')}`;
    type = 'Late Arrivals';
    title = `Late Arrivals — ${monthDate.toLocaleString('en-US',{month:'short',timeZone:'UTC'})} ${year}`;
  } else if (kind === 'missing_checkout') {
    type = 'Missing Check-outs';
    title = 'Missing Check-outs';
  } else if (kind === 'department') {
    type = 'Department-wise Attendance';
    title = 'Department Summary';
  }
  const typeSelect = document.getElementById('rptType');
  if (typeSelect) typeSelect.value = type;
  document.getElementById('rptFrom').value = from;
  document.getElementById('rptTo').value = to;
  if (document.getElementById('rptDept')) document.getElementById('rptDept').value = '';
  if (document.getElementById('rptEmployee')) document.getElementById('rptEmployee').value = '';
  await showReportPreview({quickKind:kind,displayTitle:title,from,to});
}

async function showReportPreview(options = {}) {
  const quickKind = options.quickKind || '';
  const type = options.displayTitle || document.getElementById('rptType').value;
  // Prefer the dashboard's latest stored attendance date over the unrelated
  // Attendance Records filter date (which may point to a day with no data).
  const from = options.from || document.getElementById('rptFrom').value || currentDataDate || document.getElementById('recFrom').value || today();
  const to = options.to || document.getElementById('rptTo').value || from;
  const preview = document.getElementById('reportPreview');
  if(from>to){notify('From Date must be on or before To Date.','error');return;}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)){notify('Select valid report dates.','error');return;}
  if((Date.parse(to)-Date.parse(from))/86400000>366){notify('Select a date range of 366 days or less.','error');return;}
  document.getElementById('rptFrom').value=from;document.getElementById('rptTo').value=to;
  currentReportRows = [];
  currentReportSourceRows = [];
  currentReportExportMode = 'attendance';
  preview.innerHTML = '<div style="text-align:center;padding:42px;color:var(--text2)">Loading report data…</div>';
  const q = new URLSearchParams({from,to});
  const dept = document.getElementById('rptDept')?.value || '';
  const search = document.getElementById('rptEmployee')?.value.trim() || '';
  if (dept) q.set('department',dept);
  if (search) q.set('search',search);
  if (type === 'Absent Employees') q.set('status','absent');
  if (type === 'Late Arrivals' || quickKind === 'late') q.set('status','late');
  if(options.status && !['Absent Employees','Late Arrivals'].includes(type))q.set('status',String(options.status).trim().toLowerCase().replaceAll(' ','_'));

  let sourceRows = [];
  try {
    const result = await apiJSON('/api/attendance/history?' + q.toString());
    sourceRows = (result.items || []).map(r => {
      const emp = employees.find(e => String(e.dbId) === String(r.employee_id));
      const status = titleStatus(r.status);
      const cin = showTime(r.clock_in), cout = showTime(r.clock_out);
      const mins = Number(r.work_minutes || 0);
      return {
        date:r.work_date, dbId:r.employee_id, employee_id:r.employee_id,
        id:String(r.badge_number || r.device_user_id || emp?.id || r.employee_id),
        name:r.name || emp?.name || 'Unknown', dept:r.department || emp?.dept || 'Unassigned',
        timetable:r.shift || '—', cin:cin === '—' ? '' : cin, cout:cout === '—' ? '' : cout,
        absent:status === 'Absent' ? 'True' : '',
        wh:mins > 0 ? `${Math.floor(mins/60)}h ${mins%60}m` : '—',
        status, late_minutes:r.late_minutes || 0, early_minutes:r.early_minutes || 0, rawStatus:r.status
      };
    });
  } catch(e) {
    preview.innerHTML = `<div style="padding:24px;color:var(--red)">Could not load report data: ${escapeHtml(e.message)}</div>`;
    return;
  }

  if (quickKind === 'missing_checkout' || type === 'Missing Check-outs') {
    sourceRows = sourceRows.filter(r => Boolean(r.cin) && !r.cout);
  }
  if(type === 'Missing Check-ins')sourceRows=sourceRows.filter(r => !r.cin);
  if(type === 'Absent Employees')sourceRows=sourceRows.filter(r => r.status==='Absent');
  if(type === 'Late Arrivals')sourceRows=sourceRows.filter(r => r.status==='Late');

  // Keep the full filtered detail set for the supplied two-sheet print/XLSX template.
  currentReportSourceRows = sourceRows.map(r=>({...r}));
  let rows = sourceRows;
  let fields = [['id','AC-No.'],['name','Name'],['date','Date'],['timetable','Timetable'],['cin','Clock In'],['cout','Clock Out'],['absent','Absent'],['dept','Department'],['status','Status']];
  currentReportExportMode = 'attendance';
  if (type === 'Monthly Attendance Summary') {
    const groups=new Map();
    sourceRows.forEach(r=>{
      const k=String(r.employee_id)+'|'+r.name;
      if(!groups.has(k))groups.set(k,{id:r.id,name:r.name,dept:r.dept,total:0,present:0,late:0,absent:0,on_leave:0});
      const g=groups.get(k);g.total++;
      if(r.status==='Present'||r.status==='Early Arrival')g.present++;
      else if(r.status==='Late')g.late++;
      else if(r.status==='Absent')g.absent++;
      else if(r.status==='On Leave')g.on_leave++;
    });
    rows=[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name));
    fields=[['id','AC-No.'],['name','Name'],['dept','Department'],['total','Days'],['present','Present'],['late','Late'],['absent','Absent'],['on_leave','On Leave']];
    currentReportExportMode='monthly';
  }
  if (quickKind === 'department' || type === 'Department-wise Attendance') {
    const groups = new Map();
    sourceRows.forEach(r => {
      const key = r.dept || 'Unassigned';
      if (!groups.has(key)) groups.set(key,{department:key,total:0,present:0,late:0,absent:0,on_leave:0});
      const g = groups.get(key); g.total += 1;
      if (r.status === 'Present' || r.status === 'Early Arrival') g.present += 1;
      else if (r.status === 'Late') g.late += 1;
      else if (r.status === 'Absent') g.absent += 1;
      else if (r.status === 'On Leave') g.on_leave += 1;
    });
    rows = [...groups.values()].sort((a,b)=>a.department.localeCompare(b.department)).map(g=>({
      ...g, attendance_rate:g.total ? `${Math.round(((g.present+g.late)/g.total)*1000)/10}%` : '0%'
    }));
    fields = [['department','Department'],['total','Employees'],['present','Present'],['late','Late'],['absent','Absent'],['on_leave','On Leave'],['attendance_rate','Attendance Rate']];
    currentReportExportMode = 'department';
  }

  currentReportRows = rows;
  originalReportRows = JSON.parse(JSON.stringify(rows));
  const shown = rows.slice(0,100);
  const isDepartmentSummary = currentReportExportMode === 'department' || currentReportExportMode === 'monthly';
  const editable = !isDepartmentSummary && roleAllowed('attendance_edit');
  if (!shown.length) notify(`No attendance data found for ${from} to ${to}. Select dates with imported biometric records.`, 'warning');
  const tableRows = shown.map((r,index)=>`<tr>${fields.map(([field])=>`<td ${editable && (!cloudMode || ['cin','cout','status','timetable'].includes(field)) ? `contenteditable="true" spellcheck="false" oninput="updateReportCell(${index},'${field}',this.innerText)"` : ''} style="${field==='id'?'font-family:monospace;font-size:11px;':''}" title="${editable?'Editable report copy; original DB will not change':''}">${escapeHtml(r[field] ?? '')}</td>`).join('')}</tr>`).join('');
  const presentCount = sourceRows.filter(r=>r.status==='Present'||r.status==='Early Arrival').length;
  const lateCount = sourceRows.filter(r=>r.status==='Late').length;
  const absentCount = sourceRows.filter(r=>r.status==='Absent').length;
  const summary = currentReportExportMode==='monthly'
    ? `<span>Employees: <strong>${rows.length}</strong></span><span>Attendance days: <strong>${sourceRows.length}</strong></span><span>Present: <strong>${presentCount}</strong></span><span>Late: <strong>${lateCount}</strong></span><span>Absent: <strong>${absentCount}</strong></span>`
    : currentReportExportMode==='department'
    ? `<span>Departments: <strong>${rows.length}</strong></span><span>Attendance rows: <strong>${sourceRows.length}</strong></span><span>Present: <strong>${presentCount}</strong></span><span>Late: <strong>${lateCount}</strong></span><span>Absent: <strong>${absentCount}</strong></span>`
    : `<span>Records: <strong>${rows.length}</strong></span><span>Present: <strong>${presentCount}</strong></span><span>Late: <strong>${lateCount}</strong></span><span>Absent: <strong>${absentCount}</strong></span>${(quickKind==='missing_checkout'||type==='Missing Check-outs')?`<span>Missing Check-outs: <strong>${rows.length}</strong></span>`:''}`;
  const help = editable
    ? (cloudMode ? 'Edit Clock In, Clock Out, Timetable or Status, then click Save to Supabase. Original biometric data stays unchanged.' : 'Preview cells can be edited for export only. Local source database will not change.')
    : 'View-only mode: reports can be viewed, exported and printed.';
  preview.innerHTML = `<div style="border-bottom:1px solid var(--gray200);padding-bottom:12px;margin-bottom:14px"><div style="font-size:16px;font-weight:700;text-align:center">Police Training Collage — Biometric Attendance</div><div style="text-align:center;color:var(--text2);font-size:13px;margin-top:4px">${escapeHtml(type)}</div><div style="text-align:center;font-size:11px;color:var(--text3);margin-top:2px">Period: ${escapeHtml(from)} to ${escapeHtml(to)} · Generated: ${new Date().toLocaleString()}</div><div class="access-help" style="text-align:center">${help}</div></div><div class="tbl-wrap"><table><thead><tr>${fields.map(x=>`<th>${x[1]}</th>`).join('')}</tr></thead><tbody>${tableRows || `<tr><td colspan="${fields.length}" style="text-align:center;padding:22px">No records for the selected filters.</td></tr>`}</tbody></table></div><div style="margin-top:12px;padding:10px;background:var(--gray50);border-radius:6px;display:flex;gap:20px;flex-wrap:wrap;font-size:12px">${summary}</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"><button class="btn btn-primary btn-sm" onclick="printMasterAttendanceReport()">🖨 Print Report</button><button class="btn btn-outline btn-sm" onclick="downloadReportCsv()">📊 Export CSV</button><button class="btn btn-outline btn-sm" onclick="downloadReportExcel()">📗 Export Editable Excel</button>${editable&&cloudMode?'<button class="btn btn-primary btn-sm" onclick="saveReportToSupabase()">☁ Save Changes to Supabase</button>':''}</div>`;

  document.getElementById('printTitle').textContent = type;
  document.getElementById('printMeta').textContent = `Period: ${from} to ${to} · Generated: ${new Date().toLocaleString()}`;
  const printHead = document.querySelector('#printLayout thead tr');
  if (printHead) printHead.innerHTML = fields.map(([,label])=>`<th style="border:1px solid #ddd;padding:6px">${label}</th>`).join('');
  document.getElementById('printTbody').innerHTML = shown.map(r=>`<tr>${fields.map(([field])=>`<td style="border:1px solid #ddd;padding:5px">${escapeHtml(r[field] ?? '—')}</td>`).join('')}</tr>`).join('');
}

function downloadReportCsv() {
  const rows = currentReportExportMode==='attendance' && currentReportSourceRows&&currentReportSourceRows.length
    ? currentReportSourceRows : (currentReportRows || []);
  if (!rows.length) { notify('Generate a report preview first.'); return; }
  const fields = currentReportExportMode === 'department'
    ? ['department','total','present','late','absent','on_leave','attendance_rate']
    : currentReportExportMode==='monthly' ? ['id','name','dept','total','present','late','absent','on_leave']
    : ['id','name','date','timetable','cin','cout','absent','dept','status'];
  const headers = currentReportExportMode === 'department'
    ? ['Department','Employees','Present','Late','Absent','On Leave','Attendance Rate']
    : currentReportExportMode==='monthly' ? ['AC-No.','Name','Department','Days','Present','Late','Absent','On Leave']
    : ['AC-No.','Name','Date','Timetable','Clock In','Clock Out','Absent','Department','Status'];
  const quote = v => {const t=String(v??'');return '"'+( /^[=+@\-\t\r]/.test(t)?'\u0027'+t:t ).replace(/"/g,'""')+'"';};
  const csv = [headers.join(','), ...rows.map(r=>fields.map(k=>quote(r[k])).join(','))].join('\r\n');
  const blob = new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href=url; a.download=`attendpro-${currentReportExportMode}-report-${document.getElementById('rptFrom').value||currentDataDate||today()}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

async function downloadReportExcel() {
  const rows = currentReportRows || [];
  if (!rows.length) { notify('Generate a report preview first.'); return; }
  if (['department','monthly'].includes(currentReportExportMode)) { downloadApGridXlsx('AttendPro '+currentReportExportMode+' Summary', getApReportGridColumns(), rows, 'attendpro-'+currentReportExportMode+'-summary.xlsx'); return; }
  const from = document.getElementById('rptFrom').value || currentDataDate || today();
  const to = document.getElementById('rptTo').value || from;
  const templateRows = currentReportSourceRows&&currentReportSourceRows.length?currentReportSourceRows:rows;
  try {
    let response = await fetch(`${API}/api/reports/excel`,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({from,to,rows:templateRows})});
    if(response.status===401 && cloudMode){const refresh=await fetch(`${API}/api/auth/refresh`,{method:'POST',credentials:'same-origin'});if(refresh.ok)response=await fetch(`${API}/api/reports/excel`,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({from,to,rows:templateRows})});}
    if (!response.ok) { let msg=`${response.status} ${response.statusText}`; try { const j=await response.json(); msg=j.detail||msg; } catch(_) {} throw new Error(msg); }
    const blob=await response.blob(); const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download=`attendpro-report-${from}-to-${to}.xlsx`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
    notify('Editable Excel report downloaded. You can open and edit it in Excel or LibreOffice. Editing this file does not change the original attendance database.');
  } catch(e) { notify('Excel export failed: '+e.message); }
}



async function populateEmployeeFormDropdowns(){
  try{if(!apLocalConfig?.departments?.length||!apLocalConfig?.shifts?.length)await loadApConfig();}catch(_){}
  const departments=['Unassigned',...(apLocalConfig.departments||[]).map(x=>x.name),...employees.map(x=>x.dept)];
  const shifts=['General','Morning','Evening',...(apLocalConfig.shifts||[]).map(x=>x.name),...employees.map(x=>x.shift)];
  fillSimpleSelect('newEmpDept',departments,'Select department…','Unassigned');
  fillSimpleSelect('newEmpShift',shifts,'Select shift…','General');
  const dept=document.getElementById('newEmpDept');if(dept&&!dept.value)dept.value='Unassigned';
  const shift=document.getElementById('newEmpShift');if(shift&&!shift.value)shift.value='General';
}
async function openAddEmployeeForm(){
  if(!roleAllowed('super_admin')){notify('Only Super Admin can add employees.');return;}
  document.getElementById('addEmployeeForm')?.reset();
  await populateEmployeeFormDropdowns();
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
    ptsDirectoryCache.staff=null;
    await loadRealData(true);
    const id=Number(result.employee?.id);
    if(id){const e=employees.find(x=>Number(x.dbId)===id);if(e){empPage=1;const search=document.getElementById('empSearch');if(search)search.value=e.name;renderEmployees();}}
    notify('New employee added. Aap login session mein hi rahenge.','success');
  }catch(e){notify('Could not save employee: '+e.message);}finally{btn.disabled=false;}
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
 ${roleAllowed('attendance_edit')?`<div style="margin-top:12px"><button type="button" class="btn btn-primary btn-sm" onclick="openDiscrepancyPunchEditor()">＋ Add / Edit Missing Punch</button></div>`:''}
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
 }catch(e){notify('Could not save discrepancy review: '+e.message);}
}
async function saveBiometricStatus(){
 const employee_id=Number(document.getElementById('discEmployeeSelect').value);
 if(!employee_id){notify('Please select an employee.');return;}
 try{
  const result=await apiJSON('/api/discrepancies/biometric-status',{method:'PUT',body:JSON.stringify({employee_id,status:document.getElementById('discEnrollment').value,note:document.getElementById('discEnrollmentNote').value})});
  await loadDiscrepancies();await loadRealData(true);
  const auto=result.auto_rule||{};
  if(auto.warnings&&auto.warnings.length){
   notify('Biometric status was saved, but the automatic exception could not be applied. Check that Supabase migration 002 has been run. Details: '+auto.warnings[0].error);
  }else if(Number(auto.applied||0)>0){
   notify('Biometric status saved. The effective attendance was automatically marked On Leave. Original MDB data remains unchanged.');
  }else{
   notify('Biometric status saved. If a matching original MDB check-in is found for the current work date, AttendPro will apply the automatic On Leave rule. Original MDB data remains unchanged.');
  }
 }catch(e){notify('Could not save biometric status: '+e.message);}
}
// ── REDIS & SCHEDULER MONITOR ───────────────────────────────────────────────
let redisMonitorTimer=null;
let redisMonitorLoading=false;
const redisDatasetLabels={
 employees:['Employees','Employee profiles'],
 source_daily:['Source Daily','Original imported biometric attendance'],
 effective_daily:['Effective Daily','Current attendance after approved corrections'],
 raw_punches:['Raw Punches','Original biometric punch events'],
 discrepancy_reviews:['Discrepancy Reviews','Supervisor review decisions'],
 correction_overrides:['Correction Overrides','Approved attendance corrections'],
 attendance_audit:['Attendance Audit','Who changed attendance and when'],
 devices:['Devices','Configured biometric device records']
};
function monitorDate(value){
 if(!value)return 'Not yet';
 const d=new Date(value);
 return Number.isNaN(d.getTime())?String(value).replace('T',' '):d.toLocaleString();
}
function monitorBadge(text,kind='gray'){return `<span class="badge b-${kind}">${escapeHtml(text)}</span>`;}
function monitorBool(value){return value===true||value===1||String(value).toLowerCase()==='true';}
function showRedisNotice(message,kind='success'){
 const el=document.getElementById('redisMonitorNotice');if(!el)return;
 el.style.display='block';el.style.background=kind==='error'?'var(--red-lt)':'var(--green-lt)';
 el.style.color=kind==='error'?'#991b1b':'#065f46';el.textContent=message;
}
async function loadRedisMonitor(showErrors=false){
 if(redisMonitorLoading)return;
 redisMonitorLoading=true;
 const names=['cache','scheduler','cloud','logs'];
 const paths=['/api/cache/status','/api/scheduler/status','/api/cloud/status','/api/monitor/logs?limit=30'];
 try{
  // Load each monitor API independently. One unavailable endpoint must not leave every panel stuck on Loading.
  const settled=await Promise.allSettled(paths.map(path=>apiJSON(path)));
  const payload={cache:{},scheduler:{},cloud:{},logs:{items:[],total:0}};
  const errors={};
  settled.forEach((result,index)=>{
   const key=names[index];
   if(result.status==='fulfilled')payload[key]=result.value||{};
   else errors[key]=result.reason?.message||String(result.reason||'Unknown API error');
  });
  try{
   renderRedisMonitor(payload.cache,payload.scheduler,payload.cloud,payload.logs,errors);
  }catch(renderError){
   const logsBody=document.getElementById('redisLogsBody');
   if(logsBody)logsBody.innerHTML=`<tr><td colspan="5">Monitor rendering error: ${escapeHtml(renderError.message||String(renderError))}</td></tr>`;
   const datasetsBody=document.getElementById('redisDatasetsBody');
   if(datasetsBody)datasetsBody.innerHTML='<tr><td colspan="5">Monitor data could not be rendered. Refresh Status to retry.</td></tr>';
   errors.render=renderError.message||String(renderError);
  }
  const failed=Object.entries(errors).map(([key,message])=>`${key}: ${message}`);
  if(showErrors&&failed.length)showRedisNotice('Some monitor sections could not load — '+failed.join(' | '),'error');
 }finally{redisMonitorLoading=false;}
}
function renderRedisMonitor(cache,scheduler,cloud,logs,apiErrors={}){
 // Normalize every response and use a uniquely named local flag. The monitor must also render when Supabase is not configured.
 cache=cache&&typeof cache==='object'?cache:{};
 scheduler=scheduler&&typeof scheduler==='object'?scheduler:{};
 cloud=cloud&&typeof cloud==='object'?cloud:{};
 logs=logs&&typeof logs==='object'?logs:{items:[],total:0};
 const cloudIsEnabled=monitorBool(cloud.enabled);
 const snap=cache.snapshot&&typeof cache.snapshot==='object'?cache.snapshot:{};
 const counts=snap.counts&&typeof snap.counts==='object'?snap.counts:{};
 const datasets=cache.datasets&&typeof cache.datasets==='object'?cache.datasets:{};
 const totalRecords=Object.values(counts).reduce((sum,n)=>sum+(Number(n)||0),0);
 const redisConnected=monitorBool(cache.connected);
 const redisConfigured=monitorBool(cache.configured);
 const redisText=apiErrors.cache?'Unavailable':(redisConnected?'Connected':(redisConfigured?'Disconnected':'Not Configured'));
 const redisKind=apiErrors.cache?'red':(redisConnected?'green':(redisConfigured?'red':'amber'));
 const schedulerEnabled=monitorBool(scheduler.enabled);
 const schedulerRunning=schedulerEnabled&&!!scheduler.next_run&&!apiErrors.scheduler;
 const schedulerText=apiErrors.scheduler?'Unavailable':(!schedulerEnabled?'Stopped':(schedulerRunning?'Running':'Starting'));
 const schedulerKind=apiErrors.scheduler?'red':(!schedulerEnabled?'red':(schedulerRunning?'green':'amber'));
 const lastSuccess=monitorBool(scheduler.last_success);
 const lastResult=scheduler.last_result||{};
 const lastSyncText=snap.generated_at||scheduler.last_finished||'';
 const kpis=document.getElementById('redisMonitorKpis');
 if(kpis)kpis.innerHTML=`
  <div class="kpi-card kpi-${redisKind}"><div class="kpi-top"><span class="kpi-label">Redis Connection</span><span class="kpi-icon">🧠</span></div><div class="kpi-value" style="font-size:21px">${escapeHtml(redisText)}</div><div class="kpi-sub">${apiErrors.cache?'Cache status API unavailable':(redisConfigured?'Connection configured':'REDIS_URL / cache setting required')}</div></div>
  <div class="kpi-card kpi-${schedulerKind}"><div class="kpi-top"><span class="kpi-label">Hourly Scheduler</span><span class="kpi-icon">⏱</span></div><div class="kpi-value" style="font-size:21px">${escapeHtml(schedulerText)}</div><div class="kpi-sub">${Number(scheduler.interval_seconds||3600)/3600} hour interval</div></div>
  <div class="kpi-card kpi-blue"><div class="kpi-top"><span class="kpi-label">Cached Records</span><span class="kpi-icon">🗂</span></div><div class="kpi-value">${apiErrors.cache?'—':totalRecords.toLocaleString()}</div><div class="kpi-sub">${apiErrors.cache?'Snapshot counts unavailable':`Total rows across ${Object.keys(counts).length} snapshots`}</div></div>
  <div class="kpi-card kpi-purple"><div class="kpi-top"><span class="kpi-label">Last Cache Update</span><span class="kpi-icon">🔄</span></div><div class="kpi-value" style="font-size:15px">${escapeHtml(apiErrors.cache?'Unavailable':(lastSyncText?monitorDate(lastSyncText):'Not yet'))}</div><div class="kpi-sub">Snapshot generation time</div></div>`;
 const connBadge=document.getElementById('redisConnectionBadge');if(connBadge)connBadge.outerHTML=`<span id="redisConnectionBadge">${monitorBadge(redisText,redisKind)}</span>`;
 const detail=document.getElementById('redisDetails');if(detail)detail.innerHTML=apiErrors.cache
  ?`<div class="redis-error" style="grid-column:1/-1">Redis status unavailable: ${escapeHtml(apiErrors.cache)}</div>`
  :`
  <div><span>Key Prefix</span><strong>${escapeHtml(cache.prefix||'—')}</strong></div>
  <div><span>Total Redis Keys</span><strong>${cache.redis_key_count==null?'—':Number(cache.redis_key_count).toLocaleString()}</strong></div>
  <div><span>API Cache TTL</span><strong>${Number(cache.api_cache_ttl_seconds||0).toLocaleString()} seconds</strong></div>
  <div><span>Snapshot Generated</span><strong>${escapeHtml(monitorDate(snap.generated_at))}</strong></div>
  <div><span>Permanent Database</span><strong>${escapeHtml(cloudIsEnabled?(snap.permanent_database||'Supabase PostgreSQL'):'Local SQLite — Supabase not enabled')}</strong></div>
  <div><span>Original MDB</span><strong>${snap.original_mdb_write_enabled===false?'Read-only — never written':'Not confirmed'}</strong></div>`;
 const cacheNote=document.getElementById('redisCacheNote');if(cacheNote)cacheNote.textContent=apiErrors.cache?('Redis API error: '+apiErrors.cache):(cache.last_error?('Redis message: '+cache.last_error):(cache.note||'Redis is a rebuildable cache; Supabase remains the permanent cloud database.'));
 const schBadge=document.getElementById('schedulerStatusBadge');if(schBadge)schBadge.outerHTML=`<span id="schedulerStatusBadge">${monitorBadge(schedulerText,schedulerKind)}</span>`;
 const schDetails=document.getElementById('schedulerDetails');if(schDetails)schDetails.innerHTML=apiErrors.scheduler
  ?`<div class="redis-error" style="grid-column:1/-1">Scheduler status unavailable: ${escapeHtml(apiErrors.scheduler)}</div>`
  :`
  <div><span>Scheduler Enabled</span><strong>${schedulerEnabled?'Yes':'No'}</strong></div>
  <div><span>Update Interval</span><strong>${Math.round(Number(scheduler.interval_seconds||3600)/60)} minutes</strong></div>
  <div><span>Last Started</span><strong>${escapeHtml(monitorDate(scheduler.last_started))}</strong></div>
  <div><span>Last Completed</span><strong>${escapeHtml(monitorDate(scheduler.last_finished))}</strong></div>
  <div><span>Next Scheduled Run</span><strong>${escapeHtml(monitorDate(scheduler.next_run))}</strong></div>
  <div><span>Last Run Result</span><strong>${scheduler.last_success==null?'No completed run':(lastSuccess?(monitorBool(lastResult.redis_cache_refreshed)?'Success · Redis refreshed':'Success'):'Failed / Warning')}</strong></div>`;
 const schErr=document.getElementById('schedulerError');if(schErr){const err=apiErrors.scheduler||scheduler.last_error||'';schErr.style.display=err?'block':'none';schErr.textContent=err?'Scheduler message: '+err:'';}
 const dsBody=document.getElementById('redisDatasetsBody');
 if(dsBody){
  if(apiErrors.cache)dsBody.innerHTML=`<tr><td colspan="5">Cache datasets unavailable: ${escapeHtml(apiErrors.cache)}</td></tr>`;
  else{const names=Object.keys(redisDatasetLabels);dsBody.innerHTML=names.map(key=>{const label=redisDatasetLabels[key];const count=Number(counts[key]??datasets[key]?.records??0);const chunks=datasets[key]?.chunks??(count?'—':0);return `<tr><td><strong>${escapeHtml(label[0])}</strong></td><td>${escapeHtml(label[1])}</td><td>${count.toLocaleString()}</td><td>${escapeHtml(String(chunks))}</td><td><button class="btn btn-outline btn-sm" data-permission="super_admin" onclick="viewRedisDataset('${key}')" ${!redisConnected||!datasets[key]?'disabled':''}>View Data</button></td></tr>`;}).join('');}
 }
 const cloudPending=monitorBool(cloud.pending_source_upload);
 const supBadge=document.getElementById('supabaseStatusBadge');
 if(supBadge)supBadge.outerHTML=`<span id="supabaseStatusBadge">${monitorBadge(apiErrors.cloud?'Unavailable':(cloudIsEnabled?(cloudPending?'Upload Pending':'Enabled'):'Not Enabled'),apiErrors.cloud?'red':(cloudIsEnabled?(cloudPending?'amber':'green'):'gray'))}</span>`;
 const cloudDetails=document.getElementById('supabaseDetails');if(cloudDetails)cloudDetails.innerHTML=apiErrors.cloud
  ?`<div class="redis-error" style="grid-column:1/-1">Supabase status unavailable: ${escapeHtml(apiErrors.cloud)}</div>`
  :`
  <div><span>Cloud Database</span><strong>${cloudIsEnabled?'Supabase Enabled':'Supabase Not Enabled'}</strong></div>
  <div><span>Pending Source Upload</span><strong>${cloudPending?'Yes':'No'}</strong></div>
  <div><span>Last Source Upload</span><strong>${escapeHtml(monitorDate(cloud.last_source_upload))}</strong></div>
  <div><span>Cloud Pull</span><strong>${cloud.cloud_pull_active?'Active':'Idle'}</strong></div>`;
 const cloudErr=document.getElementById('supabaseError');if(cloudErr){const err=apiErrors.cloud||cloud.last_source_error||cloud.cloud_pull_error||'';cloudErr.style.display=err?'block':'none';cloudErr.textContent=err?'Cloud sync message: '+err:'';}
 const deviceBody=document.getElementById('redisDevicesBody');
 if(deviceBody){if(apiErrors.scheduler)deviceBody.innerHTML=`<tr><td colspan="5">Device status unavailable: ${escapeHtml(apiErrors.scheduler)}</td></tr>`;else{const devices=Array.isArray(scheduler.devices)?scheduler.devices:[];deviceBody.innerHTML=devices.map(d=>{const devStatus=d.last_error?'Error':(d.status|| (d.configured?'Configured':'Not Configured'));const devKind=d.last_error||['error','missing_file'].includes(String(d.status||''))?'red':(d.configured?'green':'amber');return `<tr><td><strong>${escapeHtml(d.name||'Unnamed device')}</strong></td><td>${monitorBadge(d.configured?'Configured':'Not Configured',d.configured?'green':'amber')}</td><td>${d.automatic_sync_enabled?'On':'Off'}</td><td>${escapeHtml(monitorDate(d.last_sync))}</td><td>${monitorBadge(devStatus,devKind)}<div style="font-size:11px;color:var(--text2);white-space:normal">${escapeHtml(d.last_error|| (d.last_inserted!=null?`New punches saved: ${d.last_inserted}`:'No current error'))}</div></td></tr>`;}).join('')||'<tr><td colspan="5">No devices configured.</td></tr>';}}
 const logBody=document.getElementById('redisLogsBody');const items=Array.isArray(logs.items)?logs.items:[];
 if(logBody)logBody.innerHTML=apiErrors.logs?`<tr><td colspan="5">Activity log API unavailable: ${escapeHtml(apiErrors.logs)}</td></tr>`:(items.map(item=>{const kind=/success/i.test(item.status)?'green':(/running|pending/i.test(item.status)?'amber':'red');return `<tr><td>${escapeHtml(monitorDate(item.time))}</td><td><strong>${escapeHtml(item.action||'Activity')}</strong><div style="font-size:11px;color:var(--text2)">${escapeHtml(item.trigger||'')}</div></td><td>${item.records==null?'—':Number(item.records).toLocaleString()}</td><td>${monitorBadge(item.status||'—',kind)}</td><td style="white-space:normal;min-width:180px">${escapeHtml(item.details||'—')}</td></tr>`;}).join('')||'<tr><td colspan="5" style="text-align:center;padding:20px">No activity logs yet. The first scheduler run will appear here.</td></tr>');
 const logCount=document.getElementById('redisLogCount');if(logCount)logCount.textContent=`${items.length} recent events · ${logs.total||0} stored`;
 applyPermissions();
}
async function refreshRedisCache(){
 if(currentUser?.role!=='super_admin'){showRedisNotice('Only Super Admin can refresh Redis cache.','error');return;}
 showRedisNotice('Refreshing Redis snapshot from the current AttendPro data…');
 try{const result=await apiJSON('/api/cache/refresh',{method:'POST'});showRedisNotice(`Redis cache refreshed successfully. ${Object.values(result.counts||{}).reduce((a,b)=>a+Number(b||0),0).toLocaleString()} records cached.`);await loadRedisMonitor();}
 catch(e){showRedisNotice('Redis refresh failed: '+e.message,'error');await loadRedisMonitor();}
}
async function runSchedulerNow(){
 if(currentUser?.role!=='super_admin'){showRedisNotice('Only Super Admin can run the scheduler manually.','error');return;}
 showRedisNotice('Scheduler is running now. It will read configured MDB devices, sync cloud data when enabled, and refresh Redis…');
 try{const result=await apiJSON('/api/scheduler/run',{method:'POST'});showRedisNotice(result.success?'Scheduler run completed successfully.':'Scheduler run completed with warnings.',result.success?'success':'error');await loadRedisMonitor();}
 catch(e){showRedisNotice('Scheduler run failed: '+e.message,'error');await loadRedisMonitor();}
}
async function viewRedisDataset(dataset){
 if(currentUser?.role!=='super_admin'){showRedisNotice('Only Super Admin can inspect cached record samples.','error');return;}
 const card=document.getElementById('redisPreviewCard');const body=document.getElementById('redisPreviewBody');
 if(!card||!body)return;
 body.innerHTML='<div class="access-help">Loading cached data…</div>';card.style.display='block';
 document.getElementById('redisPreviewTitle').textContent=(redisDatasetLabels[dataset]?.[0]||dataset)+' — Cached Data Preview';
 try{
  const result=await apiJSON('/api/cache/snapshot/'+encodeURIComponent(dataset)+'?chunk=0');
  const rows=result.items||[];document.getElementById('redisPreviewMeta').textContent=`Showing ${Math.min(rows.length,10)} of ${Number(result.total_records||rows.length).toLocaleString()} cached records · Chunk ${Number(result.chunk||0)+1} of ${result.total_chunks||1}. This is a read-only preview.`;
  if(!rows.length){body.innerHTML='<div class="access-help">This cached dataset is empty.</div>';}
  else{const cols=Object.keys(rows[0]).slice(0,9);body.innerHTML=`<table><thead><tr>${cols.map(c=>`<th>${escapeHtml(c.replaceAll('_',' '))}</th>`).join('')}</tr></thead><tbody>${rows.slice(0,10).map(row=>`<tr>${cols.map(c=>{let v=row[c];if(v&&typeof v==='object')v=JSON.stringify(v);return `<td class="redis-preview-cell" title="${escapeHtml(String(v??''))}">${escapeHtml(String(v??'—'))}</td>`;}).join('')}</tr>`).join('')}</tbody></table>`;}
  card.scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){body.innerHTML=`<div class="redis-error">Could not read cached data: ${escapeHtml(e.message)}</div>`;document.getElementById('redisPreviewMeta').textContent='';}
}
function closeRedisPreview(){const card=document.getElementById('redisPreviewCard');if(card)card.style.display='none';}
function startRedisMonitorPolling(){if(redisMonitorTimer)clearInterval(redisMonitorTimer);redisMonitorTimer=setInterval(()=>{if(document.getElementById('screen-redis')?.classList.contains('active'))loadRedisMonitor(false);},30000);}

// Preserve existing navigation and all other screens; add only the monitor page hook.
const showScreenBeforeDiscrepancies=showScreen;
showScreen=function(name,el){
 showScreenBeforeDiscrepancies(name,el);
 if(name==='discrepancies'){discrepancyPage=1;loadDiscrepancies();}
 if(name==='redis'){loadRedisMonitor(true);startRedisMonitorPolling();}
 else if(redisMonitorTimer){clearInterval(redisMonitorTimer);redisMonitorTimer=null;}
};

// Re-run the API integration after all original UI functions are defined.
initTheme();
initSidebar();
setTimeout(()=>initAuth(),100);

/* Frontend-only incremental attendance report and settings tools */
// Keep report creation and Excel/CSV downloads on the frontend. No new backend APIs.
const apSafeCell = value => {
  const v=String(value??'');
  return /^[=+@\-\t\r]/.test(v) ? "'"+v : v;
};
function apFileDownload(content, filename, mime) {
  const blob=content instanceof Blob?content:new Blob([content],{type:mime||'application/octet-stream'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
}
function apDownloadGridCsv(columns, rows, filename) {
  const quote=v=>'"'+apSafeCell(v).replaceAll('"','""')+'"';
  const csv=[columns.map(x=>quote(x[1])).join(','),...rows.map(row=>columns.map(([field])=>quote(row[field])).join(','))].join('\r\n');
  apFileDownload('\ufeff'+csv,filename,'text/csv;charset=utf-8');
}
function apExcelCol(index) {
  let s='',n=index+1;while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;
}
const apXmlEscape=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'');
function apZipArchive(items){
 const encoder=new TextEncoder();let offset=0;const locals=[],central=[];
 const crcTable=apZipArchive.crc||(apZipArchive.crc=Array.from({length:256},(_,i)=>{let n=i;for(let j=0;j<8;j++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;}));
 const crc32=data=>{let crc=0xffffffff;for(const byte of data)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;};
 function header(bytes){const dv=new DataView(bytes.buffer);return dv;}
 for(const [name,content] of Object.entries(items)){
   const filename=encoder.encode(name),body=encoder.encode(content),crc=crc32(body),size=body.length;
   const local=new Uint8Array(30+filename.length+size),a=header(local);
   a.setUint32(0,0x04034b50,true);a.setUint16(4,20,true);a.setUint16(6,0,true);
   a.setUint16(8,0,true);a.setUint32(14,crc,true);a.setUint32(18,size,true);a.setUint32(22,size,true);a.setUint16(26,filename.length,true);
   local.set(filename,30);local.set(body,30+filename.length);locals.push(local);
   const c=new Uint8Array(46+filename.length),b=header(c);
   b.setUint32(0,0x02014b50,true);b.setUint16(4,20,true);b.setUint16(6,20,true);
   b.setUint16(8,0,true);b.setUint16(10,0,true);b.setUint32(16,crc,true);
   b.setUint32(20,size,true);b.setUint32(24,size,true);b.setUint16(28,filename.length,true);
   b.setUint32(42,offset,true);c.set(filename,46);central.push(c);
   offset+=local.length;
 }
 const centralSize=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),z=header(end);
 z.setUint32(0,0x06054b50,true);z.setUint16(8,central.length,true);z.setUint16(10,central.length,true);
 z.setUint32(12,centralSize,true);z.setUint32(16,offset,true);
 return new Blob([...locals,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function downloadApGridXlsx(title,columns,rows,filename){
  if(!rows.length){notify('No records are available to export.','warning');return;}
  if(rows.length>20000){notify('Limit the export to 20,000 rows per workbook.','warning');return;}
  const a=columns.length,last=apExcelCol(a-1),xmlCell=(col,row,value,style=0)=>`<c r="${apExcelCol(col)}${row}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${apXmlEscape(value)}</t></is></c>`;
  const colDefs=columns.map(([key,label],i)=>{
    const sample=rows.slice(0,80).reduce((max,r)=>Math.max(max,String(r[key]??'').length),String(label).length);
    return `<col min="${i+1}" max="${i+1}" width="${Math.min(44,Math.max(13,sample+2))}" customWidth="1"/>`;
  }).join('');
  const header=`<row r="2">${columns.map(([,label],i)=>xmlCell(i,2,label,2)).join('')}</row>`;
  const data=rows.map((r,index)=>`<row r="${index+3}">${columns.map(([field],i)=>xmlCell(i,index+3,apSafeCell(r[field]),3)).join('')}</row>`).join('');
  const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="17"/><cols>${colDefs}</cols><sheetData><row r="1" ht="31" customHeight="1">${xmlCell(0,1,title,1)}</row>${header}${data}</sheetData><mergeCells count="1"><mergeCell ref="A1:${last}1"/></mergeCells><autoFilter ref="A2:${last}${rows.length+2}"/><pageMargins left="0.5" right="0.5" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`;
  const files={
    '[Content_Types].xml':`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels':`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml':`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml':`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF17325C"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFDDE5F0"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    'xl/worksheets/sheet1.xml':sheet
  };
  apFileDownload(apZipArchive(files),filename,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  notify('Editable Excel workbook downloaded. Changes to the downloaded file are not automatically uploaded.','success');
}
const apAttendanceColumns=[['id','AC-No.'],['name','Name'],['date','Date'],['timetable','Timetable'],['cin','Clock In'],['cout','Clock Out'],['absent','Absent'],['dept','Department'],['status','Status']];
function getApReportGridColumns(){
 if(currentReportExportMode==='department')return [['department','Department'],['total','Employees'],['present','Present'],['late','Late'],['absent','Absent'],['on_leave','On Leave'],['attendance_rate','Attendance Rate']];
 if(currentReportExportMode==='monthly')return [['id','AC-No.'],['name','Name'],['dept','Department'],['total','Days'],['present','Present'],['late','Late'],['absent','Absent'],['on_leave','On Leave']];
 return apAttendanceColumns;
}
function apNormalizeRecord(r){
 return {id:r.id||r.badge_number||'',name:r.name||'',date:r.date||r.work_date||'',timetable:r.timetable||r.shift||'',cin:r.cin==='—'?'':r.cin||r.clock_in||'',cout:['—','Pending'].includes(r.cout)?'':r.cout||r.clock_out||'',absent:r.status==='Absent'?'True':'',dept:r.dept||r.department||'',status:r.status||''};
}
function apSelectLiveRows(){
 const q=(document.getElementById('liveSearch')?.value||'').toLowerCase(),dept=document.getElementById('liveDept')?.value||'',shift=document.getElementById('liveShift')?.value||'',status=document.getElementById('liveStatus')?.value||'';
 return liveData.filter(r=>(!q||String(r.name).toLowerCase().includes(q)||String(r.id).toLowerCase().includes(q))&&(!dept||r.dept===dept)&&(!shift||r.shift===shift)&&(!status||r.status===status)).map(r=>apNormalizeRecord({...r,date:currentDataDate,timetable:r.shift}));
}
function exportApLiveRecords(format){
 const rows=apSelectLiveRows();if(!rows.length){notify('No live attendance rows match the current filters.','warning');return;}
 if(format==='xlsx')downloadApGridXlsx('AttendPro Live Attendance · '+(currentDataDate||today()),apAttendanceColumns,rows,'attendpro-live-attendance-'+(currentDataDate||today())+'.xlsx');
 else apDownloadGridCsv(apAttendanceColumns,rows,'attendpro-live-attendance-'+(currentDataDate||today())+'.csv');
}
function apSelectHistoryRows(){
 const from=document.getElementById('recFrom')?.value||'',to=document.getElementById('recTo')?.value||'',dept=document.getElementById('recDept')?.value||'',status=document.getElementById('recStatus')?.value||'',q=(document.getElementById('recSearch')?.value||'').toLowerCase();
 return recData.filter(r=>(!from||r.date>=from)&&(!to||r.date<=to)&&(!dept||r.dept===dept)&&(!status||r.status===status)&&(!employeeRecordFilterId||String(r.dbId||r.employee_id)===String(employeeRecordFilterId))&&(!q||String(r.name).toLowerCase().includes(q)||String(r.id).toLowerCase().includes(q)||!!employeeRecordFilterId)).map(apNormalizeRecord);
}
async function exportApAttendanceRecords(format){
 await loadHistoryForRange(false);
 const rows=apSelectHistoryRows();if(!rows.length){notify('No attendance records match these filters.','warning');return;}
 const tag=document.getElementById('recFrom')?.value||currentDataDate||today();
 if(format==='xlsx')downloadApGridXlsx('AttendPro Attendance Records',apAttendanceColumns,rows,'attendpro-attendance-'+tag+'.xlsx');
 else apDownloadGridCsv(apAttendanceColumns,rows,'attendpro-attendance-'+tag+'.csv');
}
function apReportField(id,value){const el=document.getElementById(id);if(el)el.value=value??'';}
async function openApEmployeeReport(id){
 const employee=employees.find(e=>Number(e.dbId)===Number(id));if(!employee){notify('Employee not found.','error');return false;}
 closeModal();closeEmployeeEditor();
 const to=currentDataDate||today(),from=addDaysToIso(to,-30);
 apReportField('rptType','Employee Attendance History');apReportField('rptFrom',from);apReportField('rptTo',to);
 apReportField('rptEmployee',String(employee.id));apReportField('rptDept','');
 showScreen('reports',document.querySelector('[data-screen=reports]'));
 await showReportPreview();return currentReportRows.length>0;
}
async function exportApEmployeeExcel(id){if(await openApEmployeeReport(id))await downloadReportExcel();}
async function reviewApEmployeeAttendance(id){
 if(!roleAllowed('attendance_edit')){notify('Supervisor or Super Admin access is required to edit attendance.','error');return;}
 await viewEmployeeRecords(id);
 const row=recData.filter(r=>Number(r.dbId||r.employee_id)===Number(id)).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];
 if(row)openAttendanceEditorByKey(recordKey(row));
 else notify('No attendance record was found for this employee in the selected range.','warning');
}
function reviewFromApEmployeeEditor(){const id=apEditingEmployeeId;closeEmployeeEditor();if(id)reviewApEmployeeAttendance(id);}
function reportFromApEmployeeEditor(){const id=apEditingEmployeeId;closeEmployeeEditor();if(id)openApEmployeeReport(id);}
function exportFromApEmployeeEditor(){const id=apEditingEmployeeId;closeEmployeeEditor();if(id)exportApEmployeeExcel(id);}
async function reportFromApRecords(){
 apReportField('rptType',document.getElementById('recStatus')?.value==='Late'?'Late Arrivals':document.getElementById('recStatus')?.value==='Absent'?'Absent Employees':'Daily Attendance Register');
 apReportField('rptFrom',document.getElementById('recFrom')?.value||currentDataDate||today());
 apReportField('rptTo',document.getElementById('recTo')?.value||currentDataDate||today());
 apReportField('rptDept',document.getElementById('recDept')?.value||'');apReportField('rptEmployee',document.getElementById('recSearch')?.value||'');
 showScreen('reports',document.querySelector('[data-screen=reports]'));await showReportPreview({status:document.getElementById('recStatus')?.value||''});
}
async function reportFromApLive(){
 apReportField('rptType',document.getElementById('liveStatus')?.value==='Late'?'Late Arrivals':document.getElementById('liveStatus')?.value==='Absent'?'Absent Employees':'Daily Attendance Register');
 apReportField('rptFrom',currentDataDate||today());apReportField('rptTo',currentDataDate||today());
 apReportField('rptDept',document.getElementById('liveDept')?.value||'');apReportField('rptEmployee',document.getElementById('liveSearch')?.value||'');
 showScreen('reports',document.querySelector('[data-screen=reports]'));await showReportPreview({status:document.getElementById('liveStatus')?.value||''});
}
async function ensureApReportExport(format){
 if(!currentReportRows.length){await showReportPreview();if(!currentReportRows.length)return;}
 if(format==='xlsx')await downloadReportExcel();else downloadReportCsv();
}
function printMasterAttendanceReport(){
  const source=(currentReportSourceRows&&currentReportSourceRows.length)
    ? currentReportSourceRows
    : (currentReportRows||[]);
  if(!source.length){notify('Generate a report preview first.','warning');return;}

  const from=document.getElementById('rptFrom')?.value||currentDataDate||today();
  const to=document.getElementById('rptTo')?.value||from;
  const type=document.getElementById('rptType')?.value||'Attendance Report';
  const generated=new Date().toLocaleString();
  const target=document.getElementById('printTemplateRoot');
  if(!target){notify('The master print template is missing.','error');return;}

  const cell=value=>escapeHtml(value===undefined||value===null||value===''?'—':value);
  const dateText=value=>{
    const text=String(value||'');
    if(/^\d{4}-\d{2}-\d{2}$/.test(text))return `${text.slice(5,7)}/${text.slice(8,10)}/${text.slice(0,4)}`;
    return text||'—';
  };
  const statusOf=row=>String(row.status||'').toLowerCase().replaceAll(' ','_');
  const sectionRows=(items)=>items.length?items.map((r,i)=>`<tr><td>${i+1}</td><td>${cell(r.name||r.id)}</td><td>${cell(dateText(r.date))}</td><td>${cell(r.timetable)}</td><td>${cell(r.cin)}</td><td>${cell(r.cout)}</td><td>${cell(r.dept)}</td><td>${cell(r.status)}</td></tr>`).join(''):'<tr><td>1</td><td>NILL</td><td colspan="6"></td></tr>';
  const section=(title,items)=>`<section class="print-section"><h2>${title}</h2><table><thead><tr><th>No.</th><th>Name</th><th>Date</th><th>Timetable</th><th>Clock In</th><th>Clock Out</th><th>Department</th><th>Status</th></tr></thead><tbody>${sectionRows(items)}</tbody></table></section>`;

  const absentRows=source.filter(r=>statusOf(r)==='absent'||String(r.absent||'').toLowerCase()==='true');
  const lateRows=source.filter(r=>statusOf(r)==='late');
  const earlyRows=source.filter(r=>Number(r.early_minutes||0)>0||statusOf(r)==='early_departure');
  const noCheckInRows=source.filter(r=>!r.cin&&!!r.cout);
  const noCheckOutRows=source.filter(r=>!!r.cin&&!r.cout);
  const registerRows=source.map(r=>`<tr><td>${cell(r.id)}</td><td>${cell(r.name)}</td><td>${cell(dateText(r.date))}</td><td>${cell(r.timetable)}</td><td>${cell(r.cin)}</td><td>${cell(r.cout)}</td><td>${cell(r.absent||(statusOf(r)==='absent'?'True':''))}</td><td>${cell(r.dept)}</td></tr>`).join('');

  target.innerHTML=`
    <section class="print-sheet">
      <h1>Police Training Collage</h1>
      <div class="print-meta">Biometric Attendance · Lahore<br>${cell(type)} · Period: ${cell(dateText(from))} to ${cell(dateText(to))} · Generated: ${cell(generated)}</div>
      ${section('Biometric Absent Morning',absentRows)}
      ${section('Biometric Late Arrivals',lateRows)}
      ${section('Early Departure',earlyRows)}
      ${section('Biometric Not Check In',noCheckInRows)}
      ${section('Biometric Not Check Out',noCheckOutRows)}
      <div class="print-signature"><span>Incharge BioMetric<br>Police Training Collage Lahore</span></div>
    </section>
    <section class="print-sheet print-page-break">
      <h1>Police Training Collage</h1>
      <div class="print-meta">Biometric Attendance Register · Lahore<br>Period: ${cell(dateText(from))} to ${cell(dateText(to))} · Generated: ${cell(generated)}</div>
      <h2>Attendance Data</h2>
      <table><thead><tr><th>AC-No.</th><th>Name</th><th>Date</th><th>Timetable</th><th>Clock In</th><th>Clock Out</th><th>Absent</th><th>Department</th></tr></thead>
      <tbody>${registerRows||'<tr><td colspan="8" style="text-align:center">NILL</td></tr>'}</tbody></table>
      <div class="print-signature"><span>Incharge BioMetric<br>Police Training Collage Lahore</span></div>
    </section>`;
  const layout=document.getElementById('printLayout');
  if(layout)layout.setAttribute('aria-hidden','false');
  requestAnimationFrame(()=>window.print());
}

async function printApReport(){if(!currentReportRows.length){await showReportPreview();if(!currentReportRows.length)return;}printMasterAttendanceReport();}
const apDiscColumns=[['work_date','Date'],['name','Employee'],['badge_number','AC-No.'],['department','Department'],['clock_in','Clock In'],['clock_out','Clock Out'],['issue_label','Issue'],['biometric_enrollment','Biometric Setup'],['status','Attendance'],['review_state','Review State'],['resolution','Resolution'],['review_note','Review Note'],['reviewed_by','Reviewed By'],['reviewed_at','Reviewed At']];
async function apAllDiscrepancies(){
 const q=new URLSearchParams({state:document.getElementById('discState')?.value||'all',page:'1',per_page:'50'});
 for(const [param,id] of [['from_date','discFrom'],['to_date','discTo'],['issue','discIssue'],['search','discSearch']]){
   const v=document.getElementById(id)?.value?.trim();if(v)q.set(param,v);
 }
 const result=await apiJSON('/api/discrepancies?'+q);const items=[...(result.items||[])],total=Number(result.total||items.length);
 for(let page=2;items.length<total&&page<=200;page++){
   q.set('page',String(page));const next=await apiJSON('/api/discrepancies?'+q);if(!next.items?.length)break;items.push(...next.items);
 }
 return items;
}
async function exportApDiscrepancies(format){
 try{
  const rows=await apAllDiscrepancies();if(!rows.length){notify('No discrepancies match the current filters.','warning');return;}
  const filename='attendpro-discrepancies-'+(document.getElementById('discFrom')?.value||currentDataDate||today());
  if(format==='xlsx')downloadApGridXlsx('AttendPro Discrepancies',apDiscColumns,rows,filename+'.xlsx');
  else apDownloadGridCsv(apDiscColumns,rows,filename+'.csv');
 }catch(e){notify('Could not export discrepancies: '+e.message,'error');}
}
// CSV can be edited in Excel and imported back into the displayed report; existing
// attendance correction API and its audit/permission rules perform the final save.
function apParseCsv(text){
 const out=[];let row=[],cell='',quotes=false;const content=text.replace(/^\ufeff/,'');
 for(let i=0;i<content.length;i++){
  const ch=content[i];if(quotes){if(ch==='"'&&content[i+1]==='"'){cell+='"';i++;}else if(ch==='"')quotes=false;else cell+=ch;}
  else if(ch==='"')quotes=true;else if(ch===','){row.push(cell);cell='';}
  else if(ch==='\n'){row.push(cell.replace(/\r$/,''));out.push(row);row=[];cell='';}else cell+=ch;
 }
 if(quotes)throw new Error('The CSV file has an unclosed quoted field.');
 if(cell.length||row.length){row.push(cell.replace(/\r$/,''));out.push(row);}return out;
}
async function importApEditedCsv(event){
 const input=event.target, file=input.files?.[0];input.value='';if(!file)return;
 if(!roleAllowed('attendance_edit')){notify('You cannot edit attendance.','error');return;}
 if(!currentReportRows.length||currentReportExportMode!=='attendance'){notify('Preview a detailed attendance report before importing an edited CSV.','warning');return;}
 try{
  const data=apParseCsv(await file.text());if(data.length<2)throw new Error('The CSV file has no attendance rows.');
  const keys=data[0].map(x=>x.trim().toLowerCase());const get=(row,name)=>row[keys.indexOf(name)]?.trim()||'';
  for(const field of ['ac-no.','date','clock in','clock out','status'])if(!keys.includes(field))throw new Error('Missing required column: '+field);
  const lookup=new Map();currentReportRows.forEach((r,index)=>{const key=String(r.id)+'|'+String(r.date);if(!lookup.has(key))lookup.set(key,index);else lookup.set(key,-1);});
  const allowed=new Set(['present','late','absent','on leave','early arrival','not checked in']);let updates=0,skipped=0;
  for(const row of data.slice(1)){
   const key=get(row,'ac-no.')+'|'+get(row,'date'),index=lookup.get(key);
   if(index===undefined||index<0){skipped++;continue;}
   const status=get(row,'status'),cin=get(row,'clock in'),cout=get(row,'clock out');
   if(!allowed.has(status.toLowerCase())||![cin,cout].every(v=>!v||/^([01]\d|2[0-3]):[0-5]\d$/.test(v))){skipped++;continue;}
   const target=currentReportRows[index];target.cin=cin;target.cout=cout;target.status=status;
   if(keys.includes('timetable'))target.timetable=get(row,'timetable');updates++;
  }
  const tableRows=document.querySelectorAll('#reportPreview tbody tr');
  currentReportRows.slice(0,100).forEach((r,index)=>{const tr=tableRows[index];if(!tr||tr.cells.length<9)return;
    for(const [cellIndex,field] of [[3,'timetable'],[4,'cin'],[5,'cout'],[8,'status']])tr.cells[cellIndex].textContent=r[field]||'';
  });
  notify(`Imported ${updates} edited rows. ${skipped} unmatched/invalid rows skipped. Click Save Changes to Supabase to apply corrections.`,updates?'success':'warning');
 }catch(e){notify('CSV import failed: '+e.message,'error');}
}

// Shared AttendPro configuration. This is loaded from the authenticated backend;
// localStorage is not used for organization, shift, department or HR rules.
let apLocalConfig={
 organization:{name:'Al-Rehman Industries Ltd.',short_name:'ARI',hr_contact:'hr@alrehman.com',phone:'+92-42-111-000-000',address:'123 Industrial Area, Lahore, Punjab, Pakistan'},
 shifts:[
  {name:'Morning Shift',start:'08:00',end:'17:00',late_after:'08:10',grace:10},
  {name:'General Shift',start:'09:00',end:'18:00',late_after:'09:10',grace:10},
  {name:'Evening Shift',start:'14:00',end:'23:00',late_after:'14:15',grace:15}
 ],
 departments:[
  {name:'Engineering',head:'Omar Farooq'},{name:'Finance',head:'Zara Sheikh'},
  {name:'HR',head:'Admin Rehman'},{name:'Operations',head:'Khalid Mirza'},
  {name:'Sales',head:'Nadia Pervez'}
 ],
 attendance_rules:{minimum_working_hours:8,late_arrival_threshold_minutes:10,early_departure_threshold_minutes:15,overtime_after_minutes:30},
 notifications:{late_arrivals:true,missing_check_ins:true,missing_check_outs:false,daily_summary_email:true,device_sync_failure:false}
};
let apCurrentConfigEditor=null;
function apDeepCopy(value){return JSON.parse(JSON.stringify(value));}
function apSetValue(id,value){const el=document.getElementById(id);if(el)el.value=value??'';}
function apSetChecked(id,value){const el=document.getElementById(id);if(el)el.checked=!!value;}
function fillApConfigFields(){
 const org=apLocalConfig.organization||{},rules=apLocalConfig.attendance_rules||{},n=apLocalConfig.notifications||{};
 apSetValue('apOrgName',org.name);apSetValue('apOrgShortName',org.short_name);apSetValue('apHrContact',org.hr_contact);
 apSetValue('apOrgPhone',org.phone);apSetValue('apOrgAddress',org.address);
 apSetValue('apMinWorkingHours',rules.minimum_working_hours);apSetValue('apLateThreshold',rules.late_arrival_threshold_minutes);
 apSetValue('apEarlyThreshold',rules.early_departure_threshold_minutes);apSetValue('apOvertimeAfter',rules.overtime_after_minutes);
 apSetChecked('apNotifLate',n.late_arrivals);apSetChecked('apNotifMissingIn',n.missing_check_ins);
 apSetChecked('apNotifMissingOut',n.missing_check_outs);apSetChecked('apNotifDaily',n.daily_summary_email);
 apSetChecked('apNotifDevice',n.device_sync_failure);
}
async function loadApConfig(){
 try{
  const result=await apiJSON('/api/config');
  apLocalConfig={...apDeepCopy(apLocalConfig),...result,
   organization:{...apLocalConfig.organization,...(result.organization||{})},
   attendance_rules:{...apLocalConfig.attendance_rules,...(result.attendance_rules||{})},
   notifications:{...apLocalConfig.notifications,...(result.notifications||{})}};
  fillApConfigFields();renderApSettings();
 }catch(e){notify('Could not load shared settings: '+e.message,'error');}
}
async function persistApConfig(){
 const result=await apiJSON('/api/config',{method:'PUT',body:JSON.stringify(apLocalConfig)});
 if(result.config)apLocalConfig=result.config;
 fillApConfigFields();renderApSettings();
 notify('Settings saved to the shared AttendPro database.','success');
}
function renderApSettings(){
 const shifts=document.getElementById('apShiftSettingsBody');
 if(shifts)shifts.innerHTML=(apLocalConfig.shifts||[]).map((sh,index)=>`<tr><td>${escapeHtml(sh.name)}</td><td>${escapeHtml(sh.start)}</td><td>${escapeHtml(sh.end)}</td><td>${escapeHtml(sh.late_after)}</td><td>${Number(sh.grace)||0} min</td><td><button type="button" class="btn btn-outline btn-sm" data-permission="super_admin" onclick="openApShiftEditor(${index})">Edit</button></td></tr>`).join('')||'<tr><td colspan="6">No shifts configured.</td></tr>';
 const depts=document.getElementById('apDepartmentSettingsBody');
 if(depts)depts.innerHTML=(apLocalConfig.departments||[]).map((d,index)=>`<tr><td>${escapeHtml(d.name)}</td><td>${escapeHtml(d.head)}</td><td>${employees.filter(e=>e.dept===d.name).length}</td><td><button type="button" class="btn btn-outline btn-sm" data-permission="super_admin" onclick="openApDepartmentEditor(${index})">Edit</button></td></tr>`).join('')||'<tr><td colspan="4">No departments configured.</td></tr>';
 applyPermissions();
}
function openApShiftEditor(index=-1){
 if(!roleAllowed('super_admin')){notify('Only Super Admin can change shift settings.','error');return;}
 apCurrentConfigEditor={type:'shift',index};
 const sh=apLocalConfig.shifts[index]||{name:'',start:'09:00',end:'17:00',late_after:'09:10',grace:10};
 document.getElementById('apConfigEditorTitle').textContent=index<0?'Add Shift':'Edit Shift';
 document.getElementById('apConfigEditorFields').innerHTML=[['name','Shift Name','text'],['start','Start','time'],['end','End','time'],['late_after','Late After','time'],['grace','Grace Period (minutes)','number']].map(([key,label,type])=>`<div class="form-group"><label class="form-label">${escapeHtml(label)}<input class="form-input" name="${key}" type="${type}" ${key==='grace'?'min="0" max="120"':''} required value="${escapeHtml(sh[key])}"></label></div>`).join('');
 document.getElementById('apConfigEditorModal').classList.add('open');
}
function openApDepartmentEditor(index=-1){
 if(!roleAllowed('super_admin')){notify('Only Super Admin can change department settings.','error');return;}
 apCurrentConfigEditor={type:'department',index};
 const dep=apLocalConfig.departments[index]||{name:'',head:''};
 document.getElementById('apConfigEditorTitle').textContent=index<0?'Add Department':'Edit Department';
 document.getElementById('apConfigEditorFields').innerHTML=[['name','Department Name'],['head','Department Head']].map(([key,label])=>`<div class="form-group"><label class="form-label">${escapeHtml(label)}<input class="form-input" name="${key}" required maxlength="120" value="${escapeHtml(dep[key])}"></label></div>`).join('');
 document.getElementById('apConfigEditorModal').classList.add('open');
}
function closeApConfigEditor(){document.getElementById('apConfigEditorModal')?.classList.remove('open');apCurrentConfigEditor=null;}
async function saveApConfigEditor(event){
 event.preventDefault();if(!apCurrentConfigEditor)return;
 const {type,index}=apCurrentConfigEditor,body=Object.fromEntries(new FormData(event.target));
 const previous=apDeepCopy(apLocalConfig);
 if(type==='shift'){
  const name=String(body.name||'').trim(),grace=Number(body.grace);
  if(!name||!Number.isInteger(grace)||grace<0||grace>120){notify('Enter a valid shift name and grace period (0–120).','error');return;}
  if(apLocalConfig.shifts.some((s,i)=>i!==index&&s.name.toLowerCase()===name.toLowerCase())){notify('A shift with this name already exists.','error');return;}
  const row={name,start:body.start,end:body.end,late_after:body.late_after,grace};
  if(index>=0)apLocalConfig.shifts[index]=row;else apLocalConfig.shifts.push(row);
 }else{
  const name=String(body.name||'').trim(),head=String(body.head||'').trim();
  if(!name){notify('Department name is required.','error');return;}
  if(apLocalConfig.departments.some((d,i)=>i!==index&&d.name.toLowerCase()===name.toLowerCase())){notify('A department with this name already exists.','error');return;}
  const row={name,head};
  if(index>=0)apLocalConfig.departments[index]=row;else apLocalConfig.departments.push(row);
 }
 try{await persistApConfig();closeApConfigEditor();}
 catch(e){apLocalConfig=previous;fillApConfigFields();renderApSettings();notify('Settings were not saved: '+e.message,'error');}
}
async function saveApGeneralSettings(section){
 const previous=apDeepCopy(apLocalConfig);
 if(section==='organization'){
  apLocalConfig.organization={name:document.getElementById('apOrgName').value.trim(),short_name:document.getElementById('apOrgShortName').value.trim(),
   hr_contact:document.getElementById('apHrContact').value.trim(),phone:document.getElementById('apOrgPhone').value.trim(),address:document.getElementById('apOrgAddress').value.trim()};
 }else if(section==='attendance_rules'){
  apLocalConfig.attendance_rules={minimum_working_hours:Number(document.getElementById('apMinWorkingHours').value),
   late_arrival_threshold_minutes:Number(document.getElementById('apLateThreshold').value),
   early_departure_threshold_minutes:Number(document.getElementById('apEarlyThreshold').value),
   overtime_after_minutes:Number(document.getElementById('apOvertimeAfter').value)};
 }else if(section==='notifications'){
  apLocalConfig.notifications={late_arrivals:document.getElementById('apNotifLate').checked,
   missing_check_ins:document.getElementById('apNotifMissingIn').checked,missing_check_outs:document.getElementById('apNotifMissingOut').checked,
   daily_summary_email:document.getElementById('apNotifDaily').checked,device_sync_failure:document.getElementById('apNotifDevice').checked};
 }
 try{await persistApConfig();}
 catch(e){apLocalConfig=previous;fillApConfigFields();notify('Settings were not saved: '+e.message,'error');}
}
/* Browser-side XLSX/CSV attendance correction import */
// Read standard XLSX files directly in modern browsers, without adding a server API.
// Only attendance fields are applied, and the existing Save to Supabase action audits edits.
async function apReadXlsxSheets(file){
 if(file.size>20*1024*1024)throw new Error('Excel file exceeds 20 MB. Export a smaller date range.');
 const raw=new Uint8Array(await file.arrayBuffer()),dv=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
 let eocd=-1;for(let p=raw.length-22;p>=Math.max(0,raw.length-65557);p--){if(dv.getUint32(p,true)===0x06054b50){eocd=p;break;}}
 if(eocd<0)throw new Error('The Excel file is not a valid XLSX archive.');
 const count=dv.getUint16(eocd+10,true),cdOffset=dv.getUint32(eocd+16,true),items=new Map();let pos=cdOffset;
 for(let i=0;i<count;i++){
   if(dv.getUint32(pos,true)!==0x02014b50)throw new Error('The workbook ZIP directory is damaged.');
   const method=dv.getUint16(pos+10,true),len=dv.getUint32(pos+20,true),nameLen=dv.getUint16(pos+28,true),extraLen=dv.getUint16(pos+30,true),commentLen=dv.getUint16(pos+32,true),local=dv.getUint32(pos+42,true);
   const name=new TextDecoder().decode(raw.slice(pos+46,pos+46+nameLen));
   items.set(name,{method,len,local});pos+=46+nameLen+extraLen+commentLen;
 }
 async function xml(name){
   const record=items.get(name);if(!record)return '';
   const start=record.local;if(dv.getUint32(start,true)!==0x04034b50)throw new Error('Invalid ZIP entry.');
   const payload=start+30+dv.getUint16(start+26,true)+dv.getUint16(start+28,true);
   const bytes=raw.slice(payload,payload+record.len);let decoded;
   if(record.method===0)decoded=bytes;
   else if(record.method===8){
     if(typeof DecompressionStream==='undefined')throw new Error('Your browser does not support XLSX decompression. Save the file as CSV and import that instead.');
     decoded=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
   }else throw new Error('Unsupported compression in XLSX workbook.');
   return new TextDecoder().decode(decoded);
 }
 const parser=new DOMParser();const doc=x=>parser.parseFromString(x,'application/xml');
 const ssText=await xml('xl/sharedStrings.xml');const strings=[];
 if(ssText){for(const item of Array.from(doc(ssText).getElementsByTagNameNS('*','si')))strings.push(Array.from(item.getElementsByTagNameNS('*','t')).map(t=>t.textContent||'').join(''));}
 const names=[...items.keys()].filter(n=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort();
 for(const name of names){
  const fileText=await xml(name);if(!fileText)continue;
  const sheet=doc(fileText),table=[];
  for(const row of Array.from(sheet.getElementsByTagNameNS('*','row'))){
    const values=[];
    for(const cell of Array.from(row.getElementsByTagNameNS('*','c'))){
      const reference=cell.getAttribute('r')||'',colLetters=reference.match(/^[A-Z]+/)?.[0]||'A';
      let col=0;for(const letter of colLetters)col=col*26+letter.charCodeAt(0)-64;col--;
      const type=cell.getAttribute('t'),v=cell.getElementsByTagNameNS('*','v')[0]?.textContent||'';
      values[col]=type==='s'?(strings[Number(v)]||''):type==='inlineStr'?Array.from(cell.getElementsByTagNameNS('*','t')).map(t=>t.textContent||'').join(''):v;
    }
    table.push(values.map(v=>v??''));
  }
  const headerRow=table.findIndex(row=>{
    const vals=row.map(v=>String(v||'').toLowerCase().trim());
    return vals.includes('ac-no.')&&vals.includes('date')&&vals.includes('clock in')&&vals.includes('clock out');
  });
  if(headerRow>=0)return {headers:table[headerRow],rows:table.slice(headerRow+1).filter(row=>row.some(v=>String(v||'').trim()))};
 }
 throw new Error('No attendance sheet found. Use the Attendance Data sheet exported from AttendPro.');
}
function apImportDate(value){
 const text=String(value??'').trim();if(/^\d{4}-\d{2}-\d{2}/.test(text))return text.slice(0,10);
 const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
 if(m)return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
 if(/^\d+(\.\d+)?$/.test(text)){const n=Number(text);if(n>20000&&n<100000)return new Date(Date.UTC(1899,11,30)+Math.floor(n)*86400000).toISOString().slice(0,10);}
 return text;
}
function apImportTime(value){
 const v=String(value??'').trim();if(!v||v==='—')return '';
 if(/^\d\d:\d\d/.test(v))return v.slice(0,5);
 if(/^\d+(\.\d+)?$/.test(v)){const n=Number(v);if(n>=0&&n<1){const mins=Math.round(n*1440)%1440;return String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0');}}
 return v;
}
async function importApEditedReport(event){
 const control=event.target,file=control.files?.[0];if(!file)return;
 if(file.name.toLowerCase().endsWith('.csv'))return importApEditedCsv(event);
 control.value='';
 if(!file.name.toLowerCase().endsWith('.xlsx')){notify('Choose an XLSX or CSV attendance file.','error');return;}
 if(!roleAllowed('attendance_edit')){notify('Supervisor or Super Admin permission is required.','error');return;}
 if(!currentReportRows.length||currentReportExportMode!=='attendance'){notify('Preview an attendance report before importing edits.','warning');return;}
 try{
  const sheet=await apReadXlsxSheets(file),columns=sheet.headers.map(x=>String(x).toLowerCase().trim());
  const get=(row,name)=>row[columns.indexOf(name)]??'';
  const rows=[['AC-No.','Date','Clock In','Clock Out','Status','Timetable']];
  const map=new Map(currentReportRows.map(r=>[String(r.id)+'|'+String(r.date),r]));
  for(const row of sheet.rows){
    const badge=String(get(row,'ac-no.')).trim(),day=apImportDate(get(row,'date'));
    const original=map.get(badge+'|'+day);
    if(!original)continue;
    const status=columns.includes('status')?String(get(row,'status')).trim():String(get(row,'absent')).trim().toLowerCase()==='true'?'Absent':original.status;
    rows.push([badge,day,apImportTime(get(row,'clock in')),apImportTime(get(row,'clock out')),status,String(get(row,'timetable')||'').trim()]);
  }
  if(rows.length===1){notify('No matching attendance rows found in this workbook. Check dates and AC numbers.','warning');return;}
  const csv=rows.map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
  const asCsv=new File([csv],'converted-attendance.csv',{type:'text/csv'});
  await importApEditedCsv({target:{files:[asCsv],value:''}});
 }catch(e){notify('Excel import failed: '+e.message,'error');}
}
