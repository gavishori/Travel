/* FLYMILY main app (no frameworks). Spec-driven. */

// ---------- Utilities ----------
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const el = (tag, props={}, children=[])=>{
  const e = document.createElement(tag);
  Object.entries(props).forEach(([k,v])=>{
    if(k==='class') e.className = v;
    else if(k.startsWith('on') && typeof v==='function') e.addEventListener(k.slice(2), v);
    else if(k==='html') e.innerHTML = v;
    else if(k==='text') e.textContent = v;
    else e.setAttribute(k, v);
  });
  (Array.isArray(children)?children:[children]).filter(Boolean).forEach(c=>e.append(c));
  return e;
};

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const now = () => Date.now();
const fmtDate = (tsOrIso) => {
  if(!tsOrIso) return '';
  const d = typeof tsOrIso==='string' ? new Date(tsOrIso) : new Date(tsOrIso);
  return dayjs(d).format('YYYY-MM-DD');
};

// Simple in-memory exchange (tweak if needed)
const FX = {
  USD_EUR: 0.92,
  USD_ILS: 3.7,
  toUSD({USD,EUR,ILS}){
    if(typeof USD==='number') return USD;
    if(typeof EUR==='number') return +(EUR/FX.USD_EUR).toFixed(2);
    if(typeof ILS==='number') return +(ILS/FX.USD_ILS).toFixed(2);
    return 0;
  },
  fromUSD(usd){
    return { USD:+usd.toFixed(2), EUR:+(usd*FX.USD_EUR).toFixed(2), ILS:+(usd*FX.USD_ILS).toFixed(2) };
  }
};

// ---------- Data Layer (LocalStorage + Firebase passthrough) ----------
const LocalStore = {
  key: 'flymily.v1',
  read(){
    try { return JSON.parse(localStorage.getItem(this.key)) || { trips:{} }; }
    catch { return { trips:{} }; }
  },
  write(state){ localStorage.setItem(this.key, JSON.stringify(state)); },
};

const Data = {
  mode(){ return (window.AppDataLayer && window.AppDataLayer.mode) || 'local'; },
  async listTrips(){
    if(this.mode()==='firebase') return window.AppDataLayer.listTrips();
    const s = LocalStore.read();
    return Object.values(s.trips).sort((a,b)=>b.updatedAt - a.updatedAt);
  },
  async getTrip(id){
    if(this.mode()==='firebase') return window.AppDataLayer.getTrip(id);
    const s = LocalStore.read(); return s.trips[id] || null;
  },
  async upsertTrip(trip){
    trip.updatedAt = now();
    if(this.mode()==='firebase') return window.AppDataLayer.upsertTrip(trip);
    const s = LocalStore.read(); s.trips[trip.id]=trip; LocalStore.write(s); return trip;
  },
  async deleteTrip(id){
    if(this.mode()==='firebase') return window.AppDataLayer.deleteTrip(id);
    const s = LocalStore.read(); delete s.trips[id]; LocalStore.write(s);
  },
};

// ---------- App State ----------
const App = {
  currentTripId: null,
  shareURL: null, // blob:// ephemeral
};

// ---------- Auth / Splash ----------
async function onReadyAuth(){
  const { user } = (window.AppDataLayer && window.AppDataLayer) || {};
  if(user){
    $('#signOutBtn').hidden = false;
  }
  $('#splash').hidden = true;
  $('#app').hidden = false;
  renderHome();
}

$('#signInBtn').addEventListener('click', async ()=>{
  const ADL = window.AppDataLayer;
  if(!ADL || ADL.mode !== 'firebase'){
    console.warn('Firebase config missing – continuing in local mode');
    $('#splash').hidden = true; $('#app').hidden = false; renderHome();
    return;
  }
  try {
    await ADL.ensureAuth(true);
    await onReadyAuth();
  } catch (e){
    console.warn('Auth failed, continue local:', e);
    $('#splash').hidden = true; $('#app').hidden = false; renderHome();
  }
});
$('#continueLocalBtn').addEventListener('click', ()=>{
  $('#splash').hidden = true; $('#app').hidden = false; renderHome();
});
$('#signOutBtn').addEventListener('click', async ()=>{
  if(window.AppDataLayer && window.AppDataLayer.signOut) await window.AppDataLayer.signOut();
  location.reload();
});

// Theme toggle
$('#themeToggle').addEventListener('click', ()=>{
  document.body.classList.toggle('light');
});

// ---------- Home View ----------
$('.segmented').addEventListener('click', (e)=>{
  if(!e.target.classList.contains('seg')) return;
  $$('.seg').forEach(x=>x.classList.remove('active'));
  e.target.classList.add('active');
  const mode = e.target.dataset.mode;
  $('#tripGrid').hidden = (mode!=='grid');
  $('#tripList').hidden = (mode!=='list');
});

$('#tripSearch').addEventListener('input', ()=> renderHome());

$('#addTripBtn').addEventListener('click', async ()=>{
  const id = uid();
  const trip = {
    id,
    destination: 'טיול ללא שם',
    start: fmtDate(new Date()),
    end: '',
    participants: '',
    tripType: [],
    budget: { USD: 0 },
    budgetLocked: false,
    expenses: {},
    journal: {},
    share: { enabled:false, scope:'full' },
    createdAt: now(), updatedAt: now()
  };
  await Data.upsertTrip(trip);
  renderHome();
});

async function renderHome(){
  const search = $('#tripSearch').value?.trim().toLowerCase() || '';
  const trips = (await Data.listTrips()).filter(t=>{
    const h = [t.destination, t.participants].join(' ').toLowerCase();
    return h.includes(search);
  });

  // Grid
  const grid = $('#tripGrid');
  grid.innerHTML = '';
  trips.forEach(t=>{
    const card = el('div', {class:'trip-card'});
    const title = el('div', {class:'title', text: t.destination});
    title.addEventListener('click', ()=> openTrip(t.id));
    const meta = el('div', {class:'meta', text: `${t.start || '—'} → ${t.end || '—'} • ${t.participants || '—'}`});
    const kebab = el('button', {class:'kebab', 'aria-label':'פעולות'});
    kebab.addEventListener('click', ev=> openKebabMenu(ev.currentTarget, ()=> editTrip(t), ()=> removeTrip(t)));
    card.append(kebab, title, meta);
    grid.append(card);
  });

  // List
  const tbody = $('#tripList tbody'); tbody.innerHTML='';
  trips.forEach(t=>{
    const tr = el('tr');
    const go = ()=> openTrip(t.id);
    tr.append(
      el('td', {}, el('span', {class:'link', text:t.destination, onClick:go})),
      el('td', {}, document.createTextNode(`${t.start || '—'} → ${t.end || '—'}`)),
      el('td', {}, document.createTextNode(t.participants || '—')),
      el('td', {}, document.createTextNode((t.budget?.USD ?? 0)+' USD')),
      el('td', {}, createKebab(()=>editTrip(t), ()=>removeTrip(t)))
    );
    tbody.append(tr);
  });
}

function createKebab(onEdit, onDelete){
  const wrap = el('div', {style:'position:relative'});
  const btn = el('div', {class:'kebab', role:'button', 'aria-label':'פעולות'});
  btn.addEventListener('click', ev=> openKebabMenu(btn, onEdit, onDelete));
  wrap.append(btn);
  return wrap;
}
function openKebabMenu(anchor, onEdit, onDelete){
  closeKebabMenus();
  const tpl = $('#kebabMenuTemplate').cloneNode(true);
  tpl.hidden = false; tpl.id = '';
  tpl.style.top = (anchor.getBoundingClientRect().bottom + window.scrollY + 8)+'px';
  tpl.style.left = (anchor.getBoundingClientRect().left + window.scrollX)+'px';
  document.body.appendChild(tpl);
  tpl.querySelector('[data-action="edit"]').addEventListener('click', ()=>{ onEdit(); closeKebabMenus(); });
  tpl.querySelector('[data-action="delete"]').addEventListener('click', ()=>{ onDelete(); closeKebabMenus(); });
  document.addEventListener('click', closeKebabMenus, {once:true});
}
function closeKebabMenus(){ $$('.kebab-menu').forEach(k=>k.remove()); }

async function editTrip(t){
  // Navigate to meta and focus destination input
  await openTrip(t.id);
  switchTab('meta');
  $('#metaForm [name="destination"]').focus();
}
async function removeTrip(t){
  if(!confirm('למחוק את הטיול?')) return;
  await Data.deleteTrip(t.id);
  if(App.currentTripId===t.id){
    App.currentTripId=null; $('#tripView').hidden=true; $('#homeView').hidden=false;
  }
  renderHome();
}

// ---------- Trip View ----------
async function openTrip(id){
  App.currentTripId = id;
  const trip = await Data.getTrip(id);
  $('#tripTitle').textContent = trip.destination || 'טיול';
  $('#homeView').hidden = true; $('#tripView').hidden = false;

  // Fill forms
  fillMeta(trip);
  fillBudget(trip);
  renderOverview(trip);
  renderExpenses(trip);
  renderJournal(trip);
  ensureMap(); renderMap(trip);

  // Share UI
  $('#shareToggle').checked = !!trip.share?.enabled;
  $('#shareScope').value = trip.share?.scope || 'full';
  $('#shareLink').value = '';
}
$('#backToHome').addEventListener('click', ()=>{
  App.currentTripId=null; $('#tripView').hidden=true; $('#homeView').hidden=false; renderHome();
});

// Tabs
$$('.tab').forEach(b=> b.addEventListener('click', ()=> switchTab(b.dataset.tab)));
function switchTab(name){
  $$('.tab').forEach(x=>x.classList.toggle('active', x.dataset.tab===name));
  $$('.tab-panel').forEach(p=>p.classList.toggle('active', p.id===`tab-${name}`));
  if(name==='map'){ setTimeout(()=> map?.invalidateSize?.(), 150); }
}

// Overview
function renderOverview(trip){
  $('#overviewMeta').innerHTML = `
    <div>יעד: <strong>${trip.destination||'—'}</strong></div>
    <div>תאריכים: <strong>${trip.start||'—'} → ${trip.end||'—'}</strong></div>
    <div>משתתפים: <strong>${trip.participants||'—'}</strong></div>
    <div>סוגים: <strong>${(trip.tripType||[]).join(', ')||'—'}</strong></div>
  `;
  const b = FX.fromUSD(trip.budget?.USD||0);
  $('#overviewBudget').innerHTML = `
    <div>USD: <strong>${b.USD.toFixed(2)}</strong></div>
    <div>EUR: <strong>${b.EUR.toFixed(2)}</strong></div>
    <div>ILS: <strong>${b.ILS.toFixed(2)}</strong></div>
    <div>סטטוס: <strong>${trip.budgetLocked?'נעול':'עריכה פתוחה'}</strong></div>
  `;
  const expCount = Object.keys(trip.expenses||{}).length;
  const jrCount = Object.keys(trip.journal||{}).length;
  $('#overviewStats').innerHTML = `
    <div>הוצאות: <strong>${expCount}</strong></div>
    <div>רישומי יומן: <strong>${jrCount}</strong></div>
  `;

  // quick nav buttons
  $$('#tab-overview .actions .btn').forEach(btn=>{
    btn.addEventListener('click', ()=> switchTab(btn.dataset.goto));
  });
}

// Meta form
function fillMeta(trip){
  const f = $('#metaForm');
  f.destination.value = trip.destination||'';
  f.start.value = trip.start||'';
  f.end.value = trip.end||'';
  f.participants.value = trip.participants||'';
  // checkboxes
  f.querySelectorAll('input[name="tripType"]').forEach(ch=>{
    ch.checked = (trip.tripType||[]).includes(ch.value);
  });
}
$('#metaForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const t = await Data.getTrip(App.currentTripId);
  const f = e.currentTarget;
  t.destination = f.destination.value.trim();
  t.start = f.start.value || '';
  t.end = f.end.value || '';
  t.participants = f.participants.value.trim();
  t.tripType = Array.from(f.querySelectorAll('input[name="tripType"]:checked')).map(x=>x.value);
  await Data.upsertTrip(t);
  $('#tripTitle').textContent = t.destination || 'טיול';
  renderOverview(t);
  alert('נשמר');
});
$('#verifyOnMapBtn').addEventListener('click', ()=> switchTab('map'));

// Budget
function fillBudget(trip){
  const f = $('#budgetForm');
  const b = FX.fromUSD(trip.budget?.USD||0);
  f.USD.value = b.USD;
  f.EUR.value = b.EUR;
  f.ILS.value = b.ILS;
  setBudgetLocked(trip.budgetLocked);
}
function setBudgetLocked(locked){
  const f = $('#budgetForm'); Array.from(f.elements).forEach(el=>{ if(el.name) el.disabled = locked; });
  $('#toggleBudgetLock').textContent = locked? 'ערוך תקציב' : 'קבע תקציב';
}
$('#toggleBudgetLock').addEventListener('click', async ()=>{
  const t = await Data.getTrip(App.currentTripId);
  t.budgetLocked = !t.budgetLocked;
  await Data.upsertTrip(t);
  setBudgetLocked(t.budgetLocked);
});
$('#budgetForm').addEventListener('input', (e)=>{
  const f = e.currentTarget;
  // Any field update -> recompute USD then refill others to keep in sync
  const USD = FX.toUSD({
    USD: f.USD.value===''?undefined:+f.USD.value,
    EUR: f.EUR.value===''?undefined:+f.EUR.value,
    ILS: f.ILS.value===''?undefined:+f.ILS.value
  });
  const b = FX.fromUSD(USD);
  f.USD.value = b.USD; f.EUR.value=b.EUR; f.ILS.value=b.ILS;
});
$('#budgetForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const t = await Data.getTrip(App.currentTripId);
  t.budget = { USD: +e.currentTarget.USD.value };
  await Data.upsertTrip(t);
  renderOverview(t);
  alert('נשמר');
});

// ---------- Expenses ----------
function renderExpenses(trip){
  const tbody = $('#expenseTbody'); tbody.innerHTML='';
  const rows = Object.entries(trip.expenses||{}).sort((a,b)=> (a[1].createdAt)-(b[1].createdAt));
  rows.forEach(([id,ex])=>{
    const tr = el('tr');
    tr.append(
      el('td', {}, document.createTextNode(ex.date || '')),
      el('td', {}, document.createTextNode(ex.category || '')),
      el('td', {}, document.createTextNode(ex.desc || '')),
      el('td', {}, document.createTextNode((+ex.amount||0).toFixed(2))),
      el('td', {}, document.createTextNode(ex.currency || 'USD')),
      el('td', {}, document.createTextNode(ex.placeName || '')),
      el('td', {}, createKebab(()=> openExpenseDialog(id, ex), async ()=>{
        if(!confirm('למחוק הוצאה?')) return;
        const t = await Data.getTrip(App.currentTripId);
        delete t.expenses[id]; await Data.upsertTrip(t); renderExpenses(t); renderMap(t); renderOverview(t);
      }))
    );
    tbody.append(tr);
  });
}

$('#addExpenseBtn').addEventListener('click', ()=> openExpenseDialog());
function openExpenseDialog(id=null, ex={}){
  const dlg = $('#expenseDialog');
  $('#expenseDialogTitle').textContent = id? 'ערוך הוצאה' : 'הוסף הוצאה';
  const f = $('#expenseForm');
  f.reset();
  f.dataset.id = id || '';
  f.date.value = ex.date || fmtDate(new Date());
  f.category.value = ex.category || '';
  f.desc.value = ex.desc || '';
  f.amount.value = ex.amount ?? '';
  f.currency.value = ex.currency || 'USD';
  f.placeName.value = ex.placeName || '';
  f.lat.value = ex.lat ?? '';
  f.lng.value = ex.lng ?? '';

  f.querySelector('[data-close]').onclick = ()=> dlg.close('cancel');

  $('#expenseClearLocBtn').onclick = ()=>{ f.lat.value=''; f.lng.value=''; };
  $('#expenseCurrentLocBtn').onclick = ()=> navigator.geolocation?.getCurrentPosition((pos)=>{
    f.lat.value = pos.coords.latitude.toFixed(6);
    f.lng.value = pos.coords.longitude.toFixed(6);
  });

  dlg.showModal();
}
$('#expenseForm').addEventListener('close', async (e)=>{
  if(e.target.returnValue!=='default') return; // cancelled
  const f = e.target;
  const id = f.dataset.id || uid();
  const t = await Data.getTrip(App.currentTripId);
  t.expenses ||= {};
  t.expenses[id] = {
    date: f.date.value,
    category: f.category.value.trim(),
    desc: f.desc.value.trim(),
    amount: +f.amount.value,
    currency: f.currency.value.trim() || 'USD',
    placeName: f.placeName.value.trim() || '',
    lat: f.lat.value===''?undefined:+f.lat.value,
    lng: f.lng.value===''?undefined:+f.lng.value,
    createdAt: t.expenses[id]?.createdAt || now()
  };
  await Data.upsertTrip(t);
  renderExpenses(t); renderMap(t); renderOverview(t);
});

// ---------- Journal ----------
function renderJournal(trip){
  const tbody = $('#journalTbody'); tbody.innerHTML='';
  const rows = Object.entries(trip.journal||{}).sort((a,b)=> (a[1].createdAt)-(b[1].createdAt));
  rows.forEach(([id,j])=>{
    const tr = el('tr');
    tr.append(
      el('td', {}, document.createTextNode(j.date || '')),
      el('td', {}, document.createTextNode(j.text || '')),
      el('td', {}, document.createTextNode(j.placeName || '')),
      el('td', {}, createKebab(()=> openJournalDialog(id, j), async ()=>{
        if(!confirm('למחוק רישום?')) return;
        const t = await Data.getTrip(App.currentTripId);
        delete t.journal[id]; await Data.upsertTrip(t); renderJournal(t); renderMap(t); renderOverview(t);
      }))
    );
    tbody.append(tr);
  });
}

$('#addJournalBtn').addEventListener('click', ()=> openJournalDialog());
function openJournalDialog(id=null, j={}){
  const dlg = $('#journalDialog');
  $('#journalDialogTitle').textContent = id? 'ערוך רישום' : 'הוסף רישום';
  const f = $('#journalForm');
  f.reset();
  f.dataset.id = id || '';
  f.date.value = j.date || fmtDate(new Date());
  f.text.value = j.text || '';
  f.placeName.value = j.placeName || '';
  f.lat.value = j.lat ?? '';
  f.lng.value = j.lng ?? '';

  f.querySelector('[data-close]').onclick = ()=> dlg.close('cancel');
  $('#journalClearLocBtn').onclick = ()=>{ f.lat.value=''; f.lng.value=''; };
  $('#journalCurrentLocBtn').onclick = ()=> navigator.geolocation?.getCurrentPosition((pos)=>{
    f.lat.value = pos.coords.latitude.toFixed(6);
    f.lng.value = pos.coords.longitude.toFixed(6);
  });

  dlg.showModal();
}
$('#journalForm').addEventListener('close', async (e)=>{
  if(e.target.returnValue!=='default') return; // cancelled
  const f = e.target;
  const id = f.dataset.id || uid();
  const t = await Data.getTrip(App.currentTripId);
  t.journal ||= {};
  t.journal[id] = {
    date: f.date.value,
    text: f.text.value.trim(),
    placeName: f.placeName.value.trim() || '',
    lat: f.lat.value===''?undefined:+f.lat.value,
    lng: f.lng.value===''?undefined:+f.lng.value,
    createdAt: t.journal[id]?.createdAt || now()
  };
  await Data.upsertTrip(t);
  renderJournal(t); renderMap(t); renderOverview(t);
});

// ---------- Map ----------
let map, expensesLayer, journalLayer;
function ensureMap(){
  if(map) return;
  map = L.map('mainMap',{ zoomControl:true }).setView([31.7717, 35.2170], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  // Fix default marker assets (suppress 404s)
  const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
  const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
  const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
  L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

  expensesLayer = L.layerGroup().addTo(map);
  journalLayer = L.layerGroup().addTo(map);

  $('#toggleExpenseLayer').addEventListener('click', ()=>{
    if(map.hasLayer(expensesLayer)){ map.removeLayer(expensesLayer); }
    else { expensesLayer.addTo(map); }
  });
  $('#toggleJournalLayer').addEventListener('click', ()=>{
    if(map.hasLayer(journalLayer)){ map.removeLayer(journalLayer); }
    else { journalLayer.addTo(map); }
  });
}

function renderMap(trip){
  if(!map) return;
  expensesLayer.clearLayers();
  journalLayer.clearLayers();

  const expPoints = Object.values(trip.expenses||{}).filter(e=>e.lat!=null && e.lng!=null);
  const jrPoints  = Object.values(trip.journal||{}).filter(j=>j.lat!=null && j.lng!=null);

  expPoints.forEach(e=>{
    L.circleMarker([e.lat, e.lng], {radius:6, color:'#ff8c00', fill:true, fillOpacity:.8})
      .bindPopup(`<strong>${e.desc||''}</strong><br>${e.amount?.toFixed?.(2)} ${e.currency||''}<br>${e.placeName||''}`)
      .addTo(expensesLayer);
  });
  jrPoints.forEach(j=>{
    L.circleMarker([j.lat, j.lng], {radius:6, color:'#7c4dff', fill:true, fillOpacity:.8})
      .bindPopup(`<strong>${j.text?.slice(0,80) || ''}</strong><br>${j.placeName||''}`)
      .addTo(journalLayer);
  });

  // Fit bounds if we have any points
  const all = [...expPoints, ...jrPoints];
  if(all.length){
    const latlngs = all.map(p=>[p.lat,p.lng]);
    map.fitBounds(latlngs, {padding:[30,30]});
  }
}

// ---------- Export / Import / Share ----------
$('#exportPdfBtn').addEventListener('click', async ()=>{
  const t = await Data.getTrip(App.currentTripId);
  const noExp = $('#exportNoExpenses').checked;
  exportPDF(t, {noExpenses:noExp});
});
$('#exportCsvBtn').addEventListener('click', async ()=>{
  const t = await Data.getTrip(App.currentTripId);
  const noExp = $('#exportNoExpenses').checked;
  exportCSV(t, {noExpenses:noExp});
});
$('#exportGpxBtn').addEventListener('click', async ()=>{
  const t = await Data.getTrip(App.currentTripId);
  const noExp = $('#exportNoExpenses').checked;
  exportGPX(t, {noExpenses:noExp});
});
$('#exportDocBtn').addEventListener('click', async ()=>{
  const t = await Data.getTrip(App.currentTripId);
  exportDOC(t);
});

$('#importJsonBtn').addEventListener('click', async ()=>{
  const file = $('#importJsonInput').files?.[0];
  if(!file) return alert('בחר קובץ JSON');
  const text = await file.text();
  let obj; try { obj = JSON.parse(text); } catch { return alert('JSON לא תקין'); }
  await importTrips(obj);
  alert('ייבוא הושלם');
  if(App.currentTripId){ openTrip(App.currentTripId); } else { renderHome(); }
});

$('#shareToggle').addEventListener('change', async (e)=>{
  const t = await Data.getTrip(App.currentTripId);
  t.share.enabled = e.target.checked;
  await Data.upsertTrip(t);
  updateShareLink(t);
});
$('#shareScope').addEventListener('change', async (e)=>{
  const t = await Data.getTrip(App.currentTripId);
  t.share.scope = e.target.value;
  await Data.upsertTrip(t);
  updateShareLink(t);
});
$('#copyShareLinkBtn').addEventListener('click', ()=>{
  const link = $('#shareLink').value;
  if(!link) return;
  navigator.clipboard?.writeText(link);
  alert('הקישור הועתק');
});
$('#revokeShareLinkBtn').addEventListener('click', async ()=>{
  const t = await Data.getTrip(App.currentTripId);
  t.share.enabled = false;
  await Data.upsertTrip(t);
  if(App.shareURL){ URL.revokeObjectURL(App.shareURL); App.shareURL = null; }
  updateShareLink(t);
});

function updateShareLink(trip){
  const input = $('#shareLink');
  if(!trip.share?.enabled){
    input.value = ''; if(App.shareURL){ URL.revokeObjectURL(App.shareURL); App.shareURL = null; }
    return;
  }
  // Build a read-only HTML and serve via Blob URL (client-only demo)
  const scope = trip.share.scope || 'full';
  const ro = buildReadOnlyHTML(trip, scope);
  const blob = new Blob([ro], {type:'text/html;charset=utf-8'});
  if(App.shareURL) URL.revokeObjectURL(App.shareURL);
  App.shareURL = URL.createObjectURL(blob);
  input.value = App.shareURL;
}

// Export helpers
function download(name, blob){ 
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(()=> URL.revokeObjectURL(a.href), 1500);
}
function exportCSV(trip, {noExpenses}={}){
  let lines = [];
  lines.push(['תאריך','קטגוריה','תיאור','סכום','מטבע','מקום','lat','lng'].join(','));
  if(!noExpenses){
    Object.values(trip.expenses||{}).forEach(e=>{
      lines.push([e.date||'', e.category||'', cleanCSV(e.desc||''), (+e.amount||0).toFixed(2), e.currency||'USD', cleanCSV(e.placeName||''), e.lat??'', e.lng??''].join(','));
    });
  }
  Object.values(trip.journal||{}).forEach(j=>{
    lines.push([j.date||'', 'יומן', cleanCSV(j.text||''), '', '', cleanCSV(j.placeName||''), j.lat??'', j.lng??''].join(','));
  });
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], {type:'text/csv;charset=utf-8'});
  download(`trip_${trip.id}.csv`, blob);
}
function cleanCSV(s){ return `"${String(s).replace(/"/g,'""')}"`; }

function exportGPX(trip, {noExpenses}={}){
  const pts = [];
  if(!noExpenses){
    Object.values(trip.expenses||{}).forEach(e=>{
      if(e.lat==null||e.lng==null) return;
      pts.push({lat:e.lat,lng:e.lng,name:`${e.desc||''} (${(+e.amount||0).toFixed(2)} ${e.currency||'USD'})`, time:e.date||fmtDate(new Date())});
    });
  }
  Object.values(trip.journal||{}).forEach(j=>{
    if(j.lat==null||j.lng==null) return;
    pts.push({lat:j.lat,lng:j.lng,name:j.text?.slice(0,60)||'יומן', time:j.date||fmtDate(new Date())});
  });
  const lines = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<gpx version="1.1" creator="FLYMILY" xmlns="http://www.topografix.com/GPX/1/1">`);
  pts.forEach(p=>{
    lines.push(`<wpt lat="${p.lat}" lon="${p.lng}"><time>${p.time}T00:00:00Z</time><name>${escapeXml(p.name)}</name></wpt>`);
  });
  lines.push(`</gpx>`);
  const blob = new Blob([lines.join('\n')], {type:'application/gpx+xml'});
  download(`trip_${trip.id}.gpx`, blob);
}
function escapeXml(s){ return String(s).replace(/[<>&'"]/g, c=>({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;' }[c])); }

async function exportPDF(trip, {noExpenses}={}){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:'pt', format:'a4'});
  const pad = 28;

  doc.setFont('helvetica','bold'); doc.setFontSize(16);
  doc.text(`דוח טיול – ${trip.destination||''}`, pad, 40, {align:'right'});
  doc.setFont('helvetica','normal'); doc.setFontSize(11);

  const b = FX.fromUSD(trip.budget?.USD||0);
  const meta = [
    ['יעד', trip.destination||''],
    ['תאריכים', `${trip.start||'—'} → ${trip.end||'—'}`],
    ['משתתפים', trip.participants||'—'],
    ['תקציב (USD/EUR/ILS)', `${b.USD} / ${b.EUR} / ${b.ILS}`],
  ];
  doc.autoTable({ head:[['שדה','ערך']], body:meta, styles:{font:'helvetica'}, startY: 60, margin:{left:pad,right:pad} });

  if(!noExpenses){
    const rows = Object.values(trip.expenses||{}).map(e=>[
      e.date||'', e.category||'', e.desc||'', (+e.amount||0).toFixed(2), e.currency||'USD', e.placeName||''
    ]);
    doc.autoTable({ head:[['תאריך','קטגוריה','תיאור','סכום','מטבע','מקום']], body:rows, startY: doc.lastAutoTable.finalY+18, margin:{left:pad,right:pad} });
  }
  const jrows = Object.values(trip.journal||{}).map(j=>[j.date||'', j.text||'', j.placeName||'']);
  doc.autoTable({ head:[['תאריך','תיאור','מקום']], body:jrows, startY: (doc.lastAutoTable?.finalY||120)+18, margin:{left:pad,right:pad} });

  doc.save(`trip_${trip.id}.pdf`);
}

function exportDOC(trip){
  // Simple RTF (opens in Word) to avoid extra libs
  const esc = (s)=> String(s).replace(/[\\{}]/g, m=>({ '\\':'\\\\','{':'\\{','}':'\\}' }[m]));
  let rtf = '{\\rtf1\\ansi\\deff0\n';
  rtf += `\\b דוח טיול – ${esc(trip.destination||'')}\\b0\\par\n`;
  rtf += `תאריכים: ${esc(trip.start||'—')} → ${esc(trip.end||'—')}\\par\n`;
  rtf += `משתתפים: ${esc(trip.participants||'—')}\\par\n\\par\n`;
  rtf += `\\b הוצאות\\b0\\par\n`;
  Object.values(trip.expenses||{}).forEach(e=>{
    rtf += `${esc(e.date||'')} | ${esc(e.category||'')} | ${esc(e.desc||'')} | ${(+e.amount||0).toFixed(2)} ${esc(e.currency||'USD')} | ${esc(e.placeName||'')}\\par\n`;
  });
  rtf += `\\par\\b יומן יומי\\b0\\par\n`;
  Object.values(trip.journal||{}).forEach(j=>{
    rtf += `${esc(j.date||'')} | ${esc(j.text||'')} | ${esc(j.placeName||'')}\\par\n`;
  });
  rtf += '}';
  download(`trip_${trip.id}.doc`, new Blob([rtf], {type:'application/msword'}));
}

async function importTrips(obj){
  // Accept { trips: Trip[] } or { trips: {id:Trip} } or array of trips
  const arr = Array.isArray(obj) ? obj
    : Array.isArray(obj.trips) ? obj.trips
    : typeof obj.trips==='object' ? Object.values(obj.trips)
    : [];
  for(const t of arr){
    if(!t?.id) t.id = uid();
    // Merge existing
    const existing = await Data.getTrip(t.id);
    const merged = existing ? deepMerge(existing, t) : t;
    merged.updatedAt = now();
    await Data.upsertTrip(merged);
  }
}
function deepMerge(a,b){
  if(Array.isArray(a) && Array.isArray(b)) return b; // replace arrays
  if(isObj(a)&&isObj(b)){
    const out = {...a};
    for(const k of Object.keys(b)){
      out[k] = k in a ? deepMerge(a[k], b[k]) : b[k];
    }
    return out;
  }
  return b;
}
function isObj(x){ return x && typeof x==='object' && !Array.isArray(x); }

// Read-only share HTML
function buildReadOnlyHTML(trip, scope='full'){
  const expRows = scope==='full' ? Object.values(trip.expenses||{}) : [];
  const jrRows  = Object.values(trip.journal||{});
  return `<!doctype html><html dir="rtl" lang="he"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>שיתוף טיול – ${escapeHtml(trip.destination||'')}</title>
    <style>
      body{font-family:Rubik,Arial,Helvetica,sans-serif;background:#0f1115;color:#e6e6ea;margin:1rem}
      h1,h2{margin:.2rem 0}
      .card{background:#1a1f2b;border:1px solid #2a3040;border-radius:16px;padding:1rem;margin:.5rem 0}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #2a3040;padding:.4rem .6rem;text-align:right}
      .muted{color:#a7acb9}
    </style></head><body>
      <h1>שיתוף – ${escapeHtml(trip.destination||'')}</h1>
      <div class="card">
        <h2>פרטי נסיעה</h2>
        <div>תאריכים: ${escapeHtml(trip.start||'—')} → ${escapeHtml(trip.end||'—')}</div>
        <div>משתתפים: ${escapeHtml(trip.participants||'—')}</div>
      </div>
      <div class="card">
        <h2>יומן יומי</h2>
        <table><thead><tr><th>תאריך</th><th>תיאור</th><th>מקום</th></tr></thead><tbody>
          ${jrRows.map(j=>`<tr><td>${escapeHtml(j.date||'')}</td><td>${escapeHtml(j.text||'')}</td><td>${escapeHtml(j.placeName||'')}</td></tr>`).join('')}
        </tbody></table>
      </div>
      ${scope==='full'?`<div class="card">
        <h2>הוצאות</h2>
        <table><thead><tr><th>תאריך</th><th>קטגוריה</th><th>תיאור</th><th>סכום</th><th>מטבע</th><th>מקום</th></tr></thead><tbody>
          ${expRows.map(e=>`<tr><td>${escapeHtml(e.date||'')}</td><td>${escapeHtml(e.category||'')}</td><td>${escapeHtml(e.desc||'')}</td><td>${(+e.amount||0).toFixed(2)}</td><td>${escapeHtml(e.currency||'USD')}</td><td>${escapeHtml(e.placeName||'')}</td></tr>`).join('')}
        </tbody></table>
      </div>`:''}
      <p class="muted">קישור זה הוא לקריאה בלבד ונוצר מהלקוח (זמני).</p>
    </body></html>`;
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

// ---------- Wire up tab quick nav from Overview (after DOM build) ----------
$('#tab-overview').addEventListener('click', (e)=>{
  const btn = e.target.closest('[data-goto]'); if(!btn) return;
  switchTab(btn.dataset.goto);
});

// ---------- Initialize if auth already resolved (e.g., redirect flow) ----------
window.addEventListener('DOMContentLoaded', async ()=>{
  if(window.AppDataLayer && window.AppDataLayer.postRedirectResolved){
    // After iOS redirect flow, auth is ready
    onReadyAuth();
  }
});

// Safety: close menus on ESC
window.addEventListener('keydown', e=>{
  if(e.key==='Escape') closeKebabMenus();
});
