/* Public landing-page routing. Existing AttendPro application functions and API calls are untouched. */
function aplpPortalScreenFromHash(){
  const match=String(window.location.hash||'').match(/^#portal(?:=([a-z-]+))?$/i);
  const allowed=['dashboard','live','trainees','pts-trainee-attendance','pts-trainee-leave','pts-trainee-osd','employees','pts-staff-leave','pts-staff-osd','pts-duty-rest','records','discrepancies','leave','reports','device','redis','settings','users'];
  return match?(allowed.includes((match[1]||'dashboard').toLowerCase())?(match[1]||'dashboard').toLowerCase():'dashboard'):null;
}
function aplpActivatePortal(screen='dashboard'){
  document.body.classList.remove('aplp-landing-mode');
  const menu=document.getElementById('aplpNav');if(menu)menu.classList.remove('open');
  const toggle=document.getElementById('aplpMenuToggle');if(toggle)toggle.setAttribute('aria-expanded','false');
  const overlay=document.getElementById('loginOverlay');
  const authenticated=(typeof currentUser!=='undefined'&&!!currentUser);
  document.body.classList.toggle('portal-login-open',!authenticated);
  if(authenticated){if(overlay)overlay.classList.remove('open');}
  else if(overlay)overlay.classList.add('open');
  if(screen){
    window.setTimeout(()=>{
      const target=document.querySelector(`[data-screen="${screen}"]`);
      if(typeof showScreen==='function'&&document.getElementById('screen-'+screen))showScreen(screen,target||null);
    },280);
  }
}
function openAttendProPortal(screen='dashboard'){
  const allowed=['dashboard','live','trainees','pts-trainee-attendance','pts-trainee-leave','pts-trainee-osd','employees','pts-staff-leave','pts-staff-osd','pts-duty-rest','records','discrepancies','leave','reports','device','redis','settings','users'];
  const target=allowed.includes(String(screen).toLowerCase())?String(screen).toLowerCase():'dashboard';
  const hash='#portal='+target;
  if(window.location.hash!==hash){window.location.hash=hash;}
  aplpActivatePortal(target);
}
function returnToPublicLanding(){
  document.body.classList.add('aplp-landing-mode');
  document.body.classList.remove('portal-login-open');
  const overlay=document.getElementById('loginOverlay');if(overlay)overlay.classList.remove('open');
  const menu=document.getElementById('aplpNav');if(menu)menu.classList.remove('open');
  const toggle=document.getElementById('aplpMenuToggle');if(toggle)toggle.setAttribute('aria-expanded','false');
  if(window.location.hash.startsWith('#portal'))history.replaceState(null,'',window.location.pathname+window.location.search);
  window.scrollTo({top:0,behavior:'smooth'});
}
function toggleAplpMenu(){
  const menu=document.getElementById('aplpNav'),toggle=document.getElementById('aplpMenuToggle');
  if(!menu)return;const open=menu.classList.toggle('open');if(toggle)toggle.setAttribute('aria-expanded',String(open));
}
window.addEventListener('hashchange',()=>{
  const screen=aplpPortalScreenFromHash();
  if(screen)aplpActivatePortal(screen);
  else if(!document.body.classList.contains('aplp-landing-mode')){
    document.body.classList.add('aplp-landing-mode');
    document.body.classList.remove('portal-login-open');
    const overlay=document.getElementById('loginOverlay');if(overlay)overlay.classList.remove('open');
    const menu=document.getElementById('aplpNav');if(menu)menu.classList.remove('open');
    const toggle=document.getElementById('aplpMenuToggle');if(toggle)toggle.setAttribute('aria-expanded','false');
  }else{
    const menu=document.getElementById('aplpNav');if(menu)menu.classList.remove('open');
  }
});

/* PTC Manawan navigation refresh: group the existing screen links without
   changing any data-screen names, permission flags, or original click handlers. */
function initPtcSidebarNavigation(){
  const nav=document.querySelector('.sb-nav');
  if(!nav||nav.dataset.ptcGrouped==='1')return;
  nav.dataset.ptcGrouped='1';

  // Keep the original category structure. Leave & Permissions already contains
  // trainee/staff leave, OSD and duty-rest links; do not inject a duplicate group.

  const iconPaths={
    dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    live:'<path d="M3 12h3l3-8 5 16 3-8h4"/>',
    trainees:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M20 8v6m3-3h-6"/>',
    'pts-trainee-attendance':'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4m8-4v4M3 10h18m-13 5 2 2 4-4"/>',
    'pts-trainee-leave':'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4m8-4v4M3 10h18m5 5h.01"/>',
    'pts-trainee-osd':'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6m-11 5h6m-6 4h6"/>',
    employees:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    'pts-staff-leave':'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4m8-4v4M3 10h18m4 4 2 2 4-4"/>',
    'pts-staff-osd':'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6m-11 5h6m-6 4h6"/>',
    'pts-duty-rest':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2M5 4l2 2m12-2-2 2"/>',
    records:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6m-11 5h6m-6 4h6"/>',
    discrepancies:'<path d="M12 3 1.5 21h21z"/><path d="M12 9v5m0 4h.01"/>',
    leave:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    reports:'<path d="M3 3v18h18"/><path d="m7 14 4-4 4 3 6-8"/>',
    device:'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>',
    redis:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1a2 2 0 1 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4v.2a2 2 0 1 1-4 0v-.2A2 2 0 0 0 5.8 17.8l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A2 2 0 0 0 1.6 12H1.5a2 2 0 1 1 0-4h.2A2 2 0 0 0 3.1 4.6L3 4.5a2 2 0 1 1 2.8-2.8l.1.1A2 2 0 0 0 9.3.4V.3a2 2 0 1 1 4 0v.2a2 2 0 0 0 3.4 1.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a2 2 0 0 0 1.4 3.4h.2a2 2 0 1 1 0 4h-.2a2 2 0 0 0-1.5 2.9z"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    default:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8m-4-4h8"/>'
  };
  const sectionIcons={
    main:'dashboard',
    'trainee management':'trainees',
    'staff management':'employees',
    'leave & permissions':'leave',
    'attendance & records':'records',
    reports:'reports',
    system:'settings'
  };
  const makeIcon=(key,extraClass='ni')=>{
    const paths=iconPaths[key]||iconPaths.default;
    return `<svg class="${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  };
  const decorateItem=item=>{
    if(!item||!item.classList||!item.classList.contains('nav-item'))return;
    if(!item.querySelector(':scope > svg.ni')){
      const key=item.dataset.screen||'device';
      item.insertAdjacentHTML('afterbegin',makeIcon(key));
    }
    Array.from(item.childNodes).forEach(node=>{
      if(node.nodeType===Node.TEXT_NODE&&node.textContent.trim()){
        const label=document.createElement('span');
        label.className='nav-label';
        label.textContent=node.textContent.trim();
        node.replaceWith(label);
      }
    });
    const label=item.querySelector(':scope > .nav-label')||item.querySelector('.nav-label');
    if(label&&!item.hasAttribute('aria-label'))item.setAttribute('aria-label',label.textContent.trim());
  };

  const children=Array.from(nav.children);
  const fragment=document.createDocumentFragment();
  let group=null,items=null;
  children.forEach(node=>{
    if(node.classList&&node.classList.contains('sb-section')){
      const title=node.textContent.trim();
      const key=title.toLowerCase();
      const slug=key.replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      group=document.createElement('section');
      group.className='sb-nav-group';
      group.dataset.group=slug;
      const toggle=document.createElement('button');
      toggle.type='button';
      toggle.className='sb-section-toggle';
      toggle.setAttribute('aria-expanded','false');
      const controlsId='sb-group-'+slug;
      toggle.setAttribute('aria-controls',controlsId);
      const iconKey=sectionIcons[key]||'default';
      toggle.innerHTML=`<span class="sb-section-icon">${makeIcon(iconKey,'')}</span><span class="sb-section-label"></span><svg class="sb-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
      toggle.querySelector('.sb-section-label').textContent=title;
      items=document.createElement('div');
      items.className='sb-nav-group-items';
      items.id=controlsId;
      const thisGroup=group;
      const thisToggle=toggle;
      toggle.addEventListener('click',()=>{
        const shouldOpen=!thisGroup.classList.contains('is-open');
        nav.querySelectorAll('.sb-nav-group').forEach(other=>setOpen(other,false));
        if(shouldOpen)setOpen(thisGroup,true);
        persistOpenGroups();
      });
      group.append(toggle,items);
      fragment.appendChild(group);
      node.remove();
    }else if(items){
      if(node.classList&&node.classList.contains('nav-item'))decorateItem(node);
      items.appendChild(node);
    }
  });
  nav.replaceChildren(fragment);

  function persistOpenGroups(){
    try{
      const open=Array.from(nav.querySelectorAll('.sb-nav-group.is-open')).map(g=>g.dataset.group);
      localStorage.setItem('attendpro-open-nav-groups',JSON.stringify(open));
    }catch(_){}
  }
  function setOpen(group,open){
    if(!group)return;
    group.classList.toggle('is-open',!!open);
    const btn=group.querySelector('.sb-section-toggle');
    if(btn)btn.setAttribute('aria-expanded',String(!!open));
  }
  let saved=[];
  try{saved=JSON.parse(localStorage.getItem('attendpro-open-nav-groups')||'[]');if(!Array.isArray(saved))saved=[];}catch(_){}
  const active=nav.querySelector('.nav-item.active')||nav.querySelector('[data-screen="dashboard"]');
  const activeGroup=active&&active.closest('.sb-nav-group');
  const savedGroup=saved.length?Array.from(nav.querySelectorAll('.sb-nav-group')).find(g=>g.dataset.group===String(saved[saved.length-1])):null;
  const initialGroup=activeGroup||savedGroup||nav.querySelector('.sb-nav-group[data-group="main"]');
  nav.querySelectorAll('.sb-nav-group').forEach(g=>setOpen(g,g===initialGroup));
  persistOpenGroups();

  const deviceList=nav.querySelector('#deviceNavList');
  if(deviceList){
    new MutationObserver(()=>deviceList.querySelectorAll('.nav-item').forEach(decorateItem)).observe(deviceList,{childList:true,subtree:true});
  }
  nav.addEventListener('click',event=>{
    const item=event.target.closest('.nav-item');
    if(!item)return;
    const parent=item.closest('.sb-nav-group');
    if(parent){nav.querySelectorAll('.sb-nav-group').forEach(other=>setOpen(other,other===parent));persistOpenGroups();}
    if(window.innerWidth<=700)document.body.classList.remove('sidebar-open');
  });
  new MutationObserver(records=>{
    records.forEach(record=>{
      if(record.type==='attributes'&&record.target.classList.contains('nav-item')&&record.target.classList.contains('active')){
        const parent=record.target.closest('.sb-nav-group');
        if(parent){nav.querySelectorAll('.sb-nav-group').forEach(other=>setOpen(other,other===parent));persistOpenGroups();}
      }
    });
  }).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});

  /* On phones, turn the existing hamburger into an off-canvas menu toggle. */
  const originalToggle=window.toggleSidebar;
  if(typeof originalToggle==='function'&&!window.__ptcMobileSidebarWrapped){
    window.__ptcMobileSidebarWrapped=true;
    window.toggleSidebar=function(){
      if(window.innerWidth<=700){
        document.body.classList.toggle('sidebar-open');
        return;
      }
      return originalToggle.apply(this,arguments);
    };
  }
  document.addEventListener('click',event=>{
    if(window.innerWidth<=700&&document.body.classList.contains('sidebar-open')&&event.target.closest('.main')&&!event.target.closest('#sidebarToggle')){
      document.body.classList.remove('sidebar-open');
    }
  });
}

/* If the login overlay opens for any auth/route path, force the app shell off. */
function initPtcLoginIsolation(){
  const overlay=document.getElementById('loginOverlay');
  if(!overlay||overlay.dataset.isolationReady==='1')return;
  overlay.dataset.isolationReady='1';
  const sync=()=>{
    if(overlay.classList.contains('open'))document.body.classList.add('portal-login-open');
    else if(typeof currentUser!=='undefined'&&currentUser)document.body.classList.remove('portal-login-open');
  };
  new MutationObserver(sync).observe(overlay,{attributes:true,attributeFilter:['class']});
  sync();
}

document.addEventListener('DOMContentLoaded',()=>{
  initPtcSidebarNavigation();
  initPtcLoginIsolation();
  setPtsDashboardMode('trainee');
  const year=document.getElementById('aplpYear');if(year)year.textContent=String(new Date().getFullYear());
  const back=document.getElementById('aplpBackTop');
  window.addEventListener('scroll',()=>{if(back)back.classList.toggle('visible',window.scrollY>520);},{passive:true});
  const screen=aplpPortalScreenFromHash();if(screen)aplpActivatePortal(screen);
});
