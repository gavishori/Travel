
import { auth, db, FB } from './firebase.js';

// Day.js setup
dayjs.extend(window.dayjs_plugin_advancedFormat);
dayjs.extend(window.dayjs_plugin_utc);
dayjs.extend(window.dayjs_plugin_timezone);

// App State
const state = {
  user: null,
  trips: [],
  currentTripId: null,
  viewMode: 'grid',
  rates: { USDEUR: 0.92, USDILS: 3.7 },
  maps: { mini: null, big: null, layers: { expenses: null, journal: null } },
  shared: { enabled: false, token: null, readOnly: false }
};

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const showToast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 2600); };

// Theme toggle
$('#btnTheme').addEventListener('click', () => {
  document.body.dataset.theme = (document.body.dataset.theme === 'light' ? 'dark' : 'light');
});

// Tabs logic
$$('#tabs button').forEach(btn => btn.addEventListener('click', () => {
  if (btn.classList.contains('active')) return;
  $$('#tabs button').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  $$('.tabview').forEach(v=>v.hidden = true);
  $('#view-'+btn.dataset.tab).hidden = false;
  if(btn.dataset.tab==='map') setTimeout(initBigMap, 50);
}));

// Auth UI
FB.onAuthStateChanged(auth, async (user) => {
  state.user = user;
  $('#btnLogin').style.display = user ? 'none' : 'inline-block';
  $('#btnLogout').style.display = user ? 'inline-block' : 'none';
  if(user && !state.shared.readOnly){
    subscribeTrips();
  } else if(!user && !state.shared.readOnly){
    $('#tripList').innerHTML = '';
    $('#tabs').style.display = 'none';
    showView('welcome');
  }
});

// Handle share link mode (read-only)
const url = new URL(location.href);
const token = url.searchParams.get('share');
const tripId = url.searchParams.get('tripId');
if (token && tripId) {
  state.shared.readOnly = true;
  state.currentTripId = tripId;
  $('#sidebar').style.display = 'none';
  $('#btnLogin').style.display = 'none';
  $('#btnLogout').style.display = 'none';
  $('#tabs').style.display = 'flex';
  // Only journal + map
  $$('#tabs button').forEach(b=>{ if(!['journal','map'].includes(b.dataset.tab)) b.style.display='none'; });
  showView('journal');
  await loadSharedTrip(tripId, token);
}

// Firestore: subscribe to user's trips
async function subscribeTrips(){
  const q = FB.query(FB.collection(db, 'trips'), FB.where('ownerUid', '==', state.user.uid));
  FB.onSnapshot(q, (snap)=>{
    state.trips = snap.docs.map(d=>({ id:d.id, ...d.data() })).sort((a,b)=> (b.start||'').localeCompare(a.start||''));
    renderTripList();
  });
}

function renderTripList(){
  const list = $('#tripList');
  const search = $('#searchTrips').value?.trim();
  let items = [...state.trips];
  if(search){
    const s = search.toLowerCase();
    items = items.filter(t=> (t.destination||'').toLowerCase().includes(s) || Object.values(t.expenses||{}).some(e=> (e.desc||'').toLowerCase().includes(s)) || Object.values(t.journal||{}).some(j=> (j.text||'').toLowerCase().includes(s)) );
  }
  list.className = state.viewMode==='grid' ? 'grid' : 'list';
  list.innerHTML = items.map(t=> state.viewMode==='grid' ? cardHTML(t) : rowHTML(t)).join('');
  list.querySelectorAll('[data-trip]').forEach(el=>{
    el.addEventListener('click', ()=> openTrip(el.dataset.trip));
  });
}
function cardHTML(t){
  const period = `${fmtDate(t.start)} – ${fmtDate(t.end)}`;
  return `<div class="trip-card" data-trip="${t.id}">
    <div style="display:flex;justify-content:space-between;gap:8px">
      <div>
        <strong style="font-size:1.1rem">${esc(t.destination||'ללא יעד')}</strong>
        <div class="muted">${period}</div>
      </div>
      <span class="pill">${esc((t.types||'').toString())}</span>
    </div>
  </div>`
}
function rowHTML(t){
  const period = `${fmtDate(t.start)} – ${fmtDate(t.end)}`;
  return `<div class="trip-row" data-trip="${t.id}">
    <div><strong>${esc(t.destination||'ללא יעד')}</strong><div class="muted">${period}</div></div>
    <div class="pill">${esc((t.types||'').toString())}</div>
  </div>`
}

function showView(view){
  $$('.tabview').forEach(v=>{ if (v) v.hidden = true });
  const el = $('#view-'+view);
  if (el) { el.hidden = /*noop*/; } else { console.warn('View not found:', view); }
}

// Open a trip -> Overview tab
async function openTrip(id){
  state.currentTripId = id;
  $('#tabs').style.display = 'flex';
  $$('#tabs button').forEach(b=>b.classList.remove('active'));
  const first = $('#tabs [data-tab="overview"]');
  first.classList.add('active');
  showView('overview');
  await loadTrip();
}

async function loadTrip(){
  const ref = FB.doc(db, 'trips', state.currentTripId);
  const snap = await FB.getDoc(ref);
  if(!snap.exists()) return;
  const t = { id: snap.id, ...snap.data() };
  state.current = t;
  // Overview meta
  $('#metaSummary').innerHTML = `
    <div><strong>${esc(t.destination||'')}</strong></div>
    <div class="muted">${fmtDate(t.start)} – ${fmtDate(t.end)}</div>
    <div>משתתפים: ${esc((t.people||[]).join(', '))}</div>
    <div>סוגים: ${esc((t.types||[]).join(', '))}</div>
  `;
  // Populate meta form
  $('#metaDestination').value = t.destination||'';
  $('#metaStart').value = t.start||'';
  $('#metaEnd').value = t.end||'';
  $('#metaPeople').value = (t.people||[]).join(', ');
  $('#metaTypes').value = (t.types||[]).join(', ');
  const budget = t.budget||{ USD:0, EUR:0, ILS:0 };
  $('#bUSD').value = budget.USD||0; $('#bEUR').value = budget.EUR||0; $('#bILS').value = budget.ILS||0;
  if(t.rates){ state.rates = t.rates; }
  $('#rateUSDEUR').value = state.rates.USDEUR; $('#rateUSDILS').value = state.rates.USDILS;

  renderExpenses(t);
  renderJournal(t);
  initMiniMap(t);
  renderExpenseSummary(t);
}

function renderExpenses(t){
  const body = $('#tblExpenses'); body.innerHTML = '';
  const arr = Object.entries(t.expenses||{}).map(([id,e])=>({id,...e})).sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''));
  arr.forEach(e=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="menu"><button class="menu-btn">⋮</button><div class="menu-list"><button data-act="edit">ערוך</button><button data-act="del">מחק</button></div></td>
      <td>${esc(e.desc||'')}</td><td>${esc(e.category||'')}</td><td>${Number(e.amount||0).toFixed(2)}</td><td>${e.currency||''}</td><td>${fmtDateTime(e.createdAt)}</td>`;
    const menuBtn = tr.querySelector('.menu-btn');
    const menu = tr.querySelector('.menu-list');
    menuBtn.addEventListener('click',()=>menu.classList.toggle('open'));
    menu.addEventListener('click', (ev)=>{
      const act = ev.target?.dataset?.act; if(!act) return;
      if(act==='edit') openExpenseModal(e); else if(act==='del') deleteExpense(e.id);
      menu.classList.remove('open');
    });
    body.appendChild(tr);
  });
  // Recent for overview
  $('#tblRecentExpenses').innerHTML = arr.slice(0,5).map(e=>`<tr><td>${esc(e.desc||'')}</td><td>${esc(e.category||'')}</td><td>${Number(e.amount||0).toFixed(2)} ${e.currency||''}</td><td>${fmtDateTime(e.createdAt)}</td></tr>`).join('');
}

function renderJournal(t){
  const body = $('#tblJournal'); body.innerHTML = '';
  const arr = Object.entries(t.journal||{}).map(([id,j])=>({id,...j})).sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''));
  arr.forEach(j=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="menu"><button class="menu-btn">⋮</button><div class="menu-list"><button data-act="edit">ערוך</button><button data-act="del">מחק</button></div></td>
      <td>${fmtDateTime(j.createdAt)}</td><td>${esc(j.placeName||'')}</td><td>${esc(j.text||'')}</td>`;
    const menuBtn = tr.querySelector('.menu-btn');
    const menu = tr.querySelector('.menu-list');
    menuBtn.addEventListener('click',()=>menu.classList.toggle('open'));
    menu.addEventListener('click', (ev)=>{
      const act = ev.target?.dataset?.act; if(!act) return;
      if(act==='edit') openJournalModal(j); else if(act==='del') deleteJournal(j.id);
      menu.classList.remove('open');
    });
    body.appendChild(tr);
  });
  $('#tblRecentJournal').innerHTML = arr.slice(0,5).map(j=>`<tr><td>${fmtDateTime(j.createdAt)}</td><td>${esc(j.placeName||'')}</td><td>${esc(j.text||'')}</td></tr>`).join('');
}

function renderExpenseSummary(t){
  const budget = t.budget||{USD:0,EUR:0,ILS:0};
  const exps = Object.values(t.expenses||{});
  const totals = { USD:0, EUR:0, ILS:0 };
  exps.forEach(e=>{ if(totals[e.currency] != null) totals[e.currency]+= Number(e.amount||0); });
  const html = `
    <div><strong>תקציב:</strong> USD ${num(budget.USD)} | EUR ${num(budget.EUR)} | ILS ${num(budget.ILS)}</div>
    <div><strong>הוצאות:</strong> USD ${num(totals.USD)} | EUR ${num(totals.EUR)} | ILS ${num(totals.ILS)}</div>
    <div><strong>יתרה:</strong> USD ${num(budget.USD - totals.USD)} | EUR ${num(budget.EUR - totals.EUR)} | ILS ${num(budget.ILS - totals.ILS)}</div>
  `;
  $('#expenseSummary').innerHTML = html;
}

// Mini map
function initMiniMap(t){
  if(!state.maps.mini){
    state.maps.mini = L.map('miniMap');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'©OSM'}).addTo(state.maps.mini);
  }
  const m = state.maps.mini;
  const journal = Object.values(t.journal||{}).filter(j=>j.lat&&j.lng);
  const expenses = Object.values(t.expenses||{}).filter(e=>e.lat&&e.lng);
  const group = [];
  expenses.slice(-5).forEach(e=> group.push(L.circleMarker([e.lat,e.lng], {radius:6,color:'#ff8c00'})) );
  journal.slice(-5).forEach(j=> group.push(L.circleMarker([j.lat,j.lng], {radius:6,color:'#1e90ff'})) );
  const layer = L.layerGroup(group).addTo(m);
  try{ m.fitBounds(layer.getBounds(), { padding:[20,20] }); }catch{}
  setTimeout(()=> m.invalidateSize(), 80);
}

// Big map with toggles
function initBigMap(){
  if(!state.current) return;
  if(!state.maps.big){
    state.maps.big = L.map('bigMap');
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'©OSM'}).addTo(state.maps.big);
    state.maps.layers.expenses = L.layerGroup().addTo(state.maps.big);
    state.maps.layers.journal = L.layerGroup().addTo(state.maps.big);
  } else {
    state.maps.layers.expenses.clearLayers();
    state.maps.layers.journal.clearLayers();
  }
  const t = state.current;
  const exps = Object.values(t.expenses||{}).filter(e=>e.lat&&e.lng);
  const jrs = Object.values(t.journal||{}).filter(j=>j.lat&&j.lng);
  exps.forEach(e=> L.circleMarker([e.lat,e.lng], {radius:7,color:'#ff8c00'}).bindPopup(`${esc(e.desc||'')}: ${num(e.amount)} ${e.currency}`).addTo(state.maps.layers.expenses));
  jrs.forEach(j=> L.circleMarker([j.lat,j.lng], {radius:7,color:'#1e90ff'}).bindPopup(`${esc(j.placeName||'')}: ${esc(j.text||'')}`).addTo(state.maps.layers.journal));
  const all = [...exps.map(e=>[e.lat,e.lng]), ...jrs.map(j=>[j.lat,j.lng])];
  if(all.length){ try{ state.maps.big.fitBounds(all, { padding:[40,40] }); }catch{} }
  setTimeout(()=> state.maps.big.invalidateSize(), 80);
}

$('#btnToggleSpent').addEventListener('click', ()=>{
  const m = state.maps.layers.expenses; if(!m) return; if(state.maps.big.hasLayer(m)){ state.maps.big.removeLayer(m); } else { state.maps.big.addLayer(m); }
});
$('#btnToggleVisited').addEventListener('click', ()=>{
  const m = state.maps.layers.journal; if(!m) return; if(state.maps.big.hasLayer(m)){ state.maps.big.removeLayer(m); } else { state.maps.big.addLayer(m); }
});

// Auth modal
$('#btnLogin').addEventListener('click', ()=> $('#authModal').showModal());
$('#authCancel').addEventListener('click', ()=> $('#authModal').close());
$('#authSignIn').addEventListener('click', async ()=>{
  try{
    const email = $('#authEmail').value.trim(); const pass = $('#authPass').value;
    await FB.signInWithEmailAndPassword(auth, email, pass);
    $('#authModal').close(); showToast('מחובר ✅');
  }catch(e){ $('#authError').textContent = xErr(e); }
});
$('#authSignUp').addEventListener('click', async ()=>{
  try{
    const email = $('#authEmail').value.trim(); const pass = $('#authPass').value;
    await FB.createUserWithEmailAndPassword(auth, email, pass);
    $('#authModal').close(); showToast('נרשם והתחבר ✅');
  }catch(e){ $('#authError').textContent = xErr(e); }
});
$('#authReset').addEventListener('click', async ()=>{
  try{ await FB.sendPasswordResetEmail(auth, $('#authEmail').value.trim()); showToast('נשלח מייל לאיפוס'); }catch(e){ $('#authError').textContent = xErr(e); }
});
$('#btnLogout').addEventListener('click', async ()=>{ await FB.signOut(auth); showToast('התנתקת'); });

// New trip modal
$('#btnNewTrip').addEventListener('click', ()=>{ $('#tripModal').showModal(); });
$('#tripCancel').addEventListener('click', ()=> $('#tripModal').close());
$('#tripSave').addEventListener('click', async ()=>{
  const dest = $('#tripDest').value.trim(); const start = $('#tripStart').value; const end = $('#tripEnd').value;
  if(!dest||!start||!end) return showToast('אנא מלא יעד ותאריכים');
  const id = crypto.randomUUID();
  await FB.setDoc(FB.doc(db, 'trips', id), {
    ownerUid: state.user.uid, destination: dest, start, end,
    createdAt: new Date().toISOString(), expenses:{}, journal:{},
    budget:{USD:0,EUR:0,ILS:0}, rates:{...state.rates}, share:{enabled:false}
  });
  $('#tripModal').close(); showToast('נוצרה נסיעה');
});

// Sidebar actions
$('#searchTrips').addEventListener('input', renderTripList);
let sortAsc = false; $('#btnSortTrips').addEventListener('click', ()=>{
  sortAsc = !sortAsc; state.trips.sort((a,b)=> sortAsc ? (a.start||'').localeCompare(b.start||'') : (b.start||'').localeCompare(a.start||'')); renderTripList();
});
$('#btnViewGrid').addEventListener('click', ()=>{ state.viewMode='grid'; renderTripList(); });
$('#btnViewList').addEventListener('click', ()=>{ state.viewMode='list'; renderTripList(); });

// Meta save, verify, budgets
$('#btnSaveMeta').addEventListener('click', async ()=>{
  const ref = FB.doc(db, 'trips', state.currentTripId);
  const people = $('#metaPeople').value.split(',').map(s=>s.trim()).filter(Boolean);
  const types = $('#metaTypes').value.split(',').map(s=>s.trim()).filter(Boolean);
  await FB.updateDoc(ref, { destination: $('#metaDestination').value.trim(), start: $('#metaStart').value, end: $('#metaEnd').value, people, types });
  showToast('נשמר'); loadTrip();
});
$('#btnVerifyOnMap').addEventListener('click', ()=>{
  $$('#tabs button').forEach(b=>b.classList.remove('active'));
  $('#tabs [data-tab="map"]').classList.add('active');
  showView('map'); setTimeout(initBigMap, 50);
});

// Budget edit + currency sync
function syncBudget(from){
  const usd = Number($('#bUSD').value||0);
  const eur = Number($('#bEUR').value||0);
  const ils = Number($('#bILS').value||0);
  if(from==='USD'){ $('#bEUR').value = (usd*state.rates.USDEUR).toFixed(2); $('#bILS').value=(usd*state.rates.USDILS).toFixed(2); }
  if(from==='EUR'){ const u = eur / state.rates.USDEUR; $('#bUSD').value=u.toFixed(2); $('#bILS').value=(u*state.rates.USDILS).toFixed(2); }
  if(from==='ILS'){ const u = ils / state.rates.USDILS; $('#bUSD').value=u.toFixed(2); $('#bEUR').value=(u*state.rates.USDEUR).toFixed(2); }
}
['bUSD','bEUR','bILS'].forEach(id=> $('#'+id).addEventListener('input', ()=> syncBudget(id.replace('b','')) ));
$('#rateUSDEUR').addEventListener('input', e=> state.rates.USDEUR = Number(e.target.value||0.92));
$('#rateUSDILS').addEventListener('input', e=> state.rates.USDILS = Number(e.target.value||3.7));
$('#btnBudgetEdit').addEventListener('click', async ()=>{
  const ref = FB.doc(db,'trips', state.currentTripId);
  await FB.updateDoc(ref, { budget: { USD:Number($('#bUSD').value||0), EUR:Number($('#bEUR').value||0), ILS:Number($('#bILS').value||0) }, rates: {...state.rates} });
  showToast('עודכן תקציב'); renderExpenseSummary(state.current);
});

// Expenses CRUD
$('#btnAddExpense').addEventListener('click', ()=> openExpenseModal());
$('#expCancel').addEventListener('click', ()=> $('#expenseModal').close());
$('#expSave').addEventListener('click', saveExpense);
$('#expDelete').addEventListener('click', ()=> deleteExpense($('#expenseModal').dataset.id));

function openExpenseModal(e){
  $('#expenseModal').dataset.id = e?.id||'';
  $('#expDesc').value = e?.desc||''; $('#expCat').value = e?.category||''; $('#expAmount').value = e?.amount||''; $('#expCurr').value = e?.currency||'USD'; $('#expLat').value = e?.lat||''; $('#expLng').value = e?.lng||'';
  $('#expDelete').style.display = e? 'inline-block':'none';
  $('#expenseModal').showModal();
}
async function saveExpense(){
  const ref = FB.doc(db,'trips', state.currentTripId); const snap = await FB.getDoc(ref); const t = snap.data();
  const id = $('#expenseModal').dataset.id || crypto.randomUUID();
  t.expenses = t.expenses || {};
  t.expenses[id] = { desc:$('#expDesc').value.trim(), category:$('#expCat').value.trim(), amount:Number($('#expAmount').value||0), currency:$('#expCurr').value, lat: numOrNull($('#expLat').value), lng: numOrNull($('#expLng').value), createdAt: t.expenses[id]?.createdAt || new Date().toISOString() };
  await FB.updateDoc(ref, { expenses: t.expenses });
  $('#expenseModal').close(); showToast('ההוצאה נשמרה'); loadTrip();
}
async function deleteExpense(id){ if(!id) return; const ref = FB.doc(db,'trips', state.currentTripId); const snap = await FB.getDoc(ref); const t = snap.data(); delete t.expenses[id]; await FB.updateDoc(ref,{ expenses: t.expenses }); showToast('נמחק'); loadTrip(); }

// Journal CRUD
$('#btnAddJournal').addEventListener('click', ()=> openJournalModal());
$('#jrCancel').addEventListener('click', ()=> $('#journalModal').close());
$('#jrSave').addEventListener('click', saveJournal);
$('#jrDelete').addEventListener('click', ()=> deleteJournal($('#journalModal').dataset.id));

function openJournalModal(j){
  $('#journalModal').dataset.id = j?.id||'';
  $('#jrText').value = j?.text||''; $('#jrPlace').value = j?.placeName||''; $('#jrLat').value = j?.lat||''; $('#jrLng').value = j?.lng||'';
  $('#jrDelete').style.display = j? 'inline-block':'none';
  $('#journalModal').showModal();
}
async function saveJournal(){
  const ref = FB.doc(db,'trips', state.currentTripId); const snap = await FB.getDoc(ref); const t = snap.data();
  const id = $('#journalModal').dataset.id || crypto.randomUUID();
  t.journal = t.journal || {};
  t.journal[id] = { text:$('#jrText').value.trim(), placeName:$('#jrPlace').value.trim(), lat: numOrNull($('#jrLat').value), lng: numOrNull($('#jrLng').value), createdAt: t.journal[id]?.createdAt || new Date().toISOString() };
  await FB.updateDoc(ref, { journal: t.journal });
  $('#journalModal').close(); showToast('הרישום נשמר'); loadTrip();
}
async function deleteJournal(id){ if(!id) return; const ref = FB.doc(db,'trips', state.currentTripId); const snap = await FB.getDoc(ref); const t = snap.data(); delete t.journal[id]; await FB.updateDoc(ref,{ journal: t.journal }); showToast('נמחק'); loadTrip(); }

// Exporters
$('#btnExportPDF').addEventListener('click', exportPDF);
$('#btnExportExcel').addEventListener('click', exportExcel);
$('#btnExportWord').addEventListener('click', exportWord);
$('#btnExportGPX').addEventListener('click', exportGPX);

function exportPDF(){
  const withExp = $('#exportWithExpenses').value==='yes';
  const t = state.current; if(!t) return;
  const { jsPDF } = window.jspdf; const doc = new jsPDF({orientation:'p',unit:'pt'});
  doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.text(`דוח נסיעה — ${t.destination||''}`, 40, 40);
  doc.setFont('helvetica','normal'); doc.setFontSize(12); doc.text(`${fmtDate(t.start)} – ${fmtDate(t.end)}`, 40, 60);
  const jr = Object.values(t.journal||{}).sort((a,b)=> (a.createdAt||'').localeCompare(b.createdAt||''));
  doc.text('יומן', 40, 90);
  doc.autoTable({ startY: 100, head:[['תאריך','מקום','תיאור']], body: jr.map(j=>[fmtDateTime(j.createdAt), j.placeName||'', j.text||'']) });
  if(withExp){
    const ex = Object.values(t.expenses||{}).sort((a,b)=> (a.createdAt||'').localeCompare(b.createdAt||''));
    doc.text('הוצאות', 40, doc.lastAutoTable.finalY + 30);
    doc.autoTable({ startY: doc.lastAutoTable.finalY + 40, head:[['תיאור','קטגוריה','סכום','מטבע','תאריך']], body: ex.map(e=>[e.desc||'', e.category||'', num(e.amount), e.currency||'', fmtDateTime(e.createdAt)]) });
  }
  doc.save(`FLYMILY_${slug(t.destination)}.pdf`);
}

function exportExcel(){
  const withExp = $('#exportWithExpenses').value==='yes';
  const t = state.current; if(!t) return;
  const wb = XLSX.utils.book_new();
  const jr = Object.values(t.journal||{}).map(j=>({ תאריך:fmtDateTime(j.createdAt), מקום:j.placeName||'', תיאור:j.text||'', lat:j.lat||'', lng:j.lng||'' }));
  const wsJ = XLSX.utils.json_to_sheet(jr); XLSX.utils.book_append_sheet(wb, wsJ, 'יומן');
  if(withExp){
    const ex = Object.values(t.expenses||{}).map(e=>({ תיאור:e.desc||'', קטגוריה:e.category||'', סכום:num(e.amount), מטבע:e.currency||'', תאריך:fmtDateTime(e.createdAt), lat:e.lat||'', lng:e.lng||'' }));
    const wsE = XLSX.utils.json_to_sheet(ex); XLSX.utils.book_append_sheet(wb, wsE, 'הוצאות');
  }
  XLSX.writeFile(wb, `FLYMILY_${slug(t.destination)}.xlsx`);
}

async function exportWord(){
  const withExp = $('#exportWithExpenses').value==='yes';
  const t = state.current; if(!t) return;
  const { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, WidthType } = window.docx;
  const jr = Object.values(t.journal||{}).sort((a,b)=> (a.createdAt||'').localeCompare(b.createdAt||''));
  const ex = Object.values(t.expenses||{}).sort((a,b)=> (a.createdAt||'').localeCompare(b.createdAt||''));
  const doc = new Document({ sections:[{ properties:{}, children:[
    new Paragraph({ text:`דוח נסיעה — ${t.destination||''}`, heading:HeadingLevel.HEADING_1 }),
    new Paragraph({ text:`${fmtDate(t.start)} – ${fmtDate(t.end)}` }),
    new Paragraph({ text:`יומן`, heading:HeadingLevel.HEADING_2 }),
    tableFrom([['תאריך','מקום','תיאור']], jr.map(j=>[fmtDateTime(j.createdAt), j.placeName||'', j.text||''])),
    ...(withExp? [ new Paragraph({ text:`הוצאות`, heading:HeadingLevel.HEADING_2 }), tableFrom([['תיאור','קטגוריה','סכום','מטבע','תאריך']], ex.map(e=>[e.desc||'', e.category||'', String(num(e.amount)), e.currency||'', fmtDateTime(e.createdAt)])) ]: [])
  ]}]});
  function tableFrom(head, rows){
    return new Table({ width:{size:100, type:WidthType.PERCENTAGE}, rows:[ new TableRow({ children: head[0].map(h=> new TableCell({ children:[new Paragraph({ text:h })] })) }), ...rows.map(r=> new TableRow({ children: r.map(c=> new TableCell({ children:[new Paragraph({ text: String(c) })] })) })) ]});
  }
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `FLYMILY_${slug(t.destination)}.docx`);
}

function exportGPX(){
  const t = state.current; if(!t) return;
  const jr = Object.values(t.journal||{}).filter(j=>j.lat&&j.lng).sort((a,b)=> (a.createdAt||'').localeCompare(b.createdAt||''));
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="FLYMILY" xmlns="http://www.topografix.com/GPX/1/1">
<trk><name>${xml( t.destination||'Trip' )}</name><trkseg>
${jr.map(j=>`<trkpt lat="${j.lat}" lon="${j.lng}"><time>${j.createdAt}</time><name>${xml(j.placeName||'')}</name><desc>${xml(j.text||'')}</desc></trkpt>`).join('\n')}
</trkseg></trk></gpx>`;
  const blob = new Blob([gpx], {type:'application/gpx+xml'});
  downloadBlob(blob, `FLYMILY_${slug(t.destination)}.gpx`);
}

// Import JSON
$('#btnImport').addEventListener('click', async ()=>{
  const file = $('#importFile').files?.[0]; if(!file) return showToast('בחר קובץ');
  const text = await file.text();
  let data; try{ data = JSON.parse(text); }catch{ return showToast('קובץ לא תקין'); }
  const id = crypto.randomUUID();
  data.ownerUid = state.user?.uid || 'unknown'; data.createdAt = new Date().toISOString();
  await FB.setDoc(FB.doc(db,'trips', id), data);
  showToast('יובא בהצלחה');
});

// Sharing
$('#btnEnableShare').addEventListener('click', async ()=>{
  const ref = FB.doc(db,'trips', state.currentTripId);
  const token = crypto.randomUUID().replace(/-/g,'');
  await FB.updateDoc(ref, { share: { enabled:true, token } });
  const link = `${location.origin}${location.pathname}?tripId=${state.currentTripId}&share=${token}`;
  $('#shareLink').value = link;
  showToast('שיתוף הופעל');
});
$('#btnDisableShare').addEventListener('click', async ()=>{
  const ref = FB.doc(db,'trips', state.currentTripId);
  await FB.updateDoc(ref, { share: { enabled:false, token: null } });
  $('#shareLink').value = '';
  showToast('השיתוף בוטל');
});
$('#btnCopyShare').addEventListener('click', async ()=>{ const v = $('#shareLink').value; if(!v) return; await navigator.clipboard.writeText(v); showToast('הועתק'); });

// Shared read-only loader
async function loadSharedTrip(id, token){
  const ref = FB.doc(db,'trips', id); const snap = await FB.getDoc(ref); const t = snap.data();
  if(!t?.share?.enabled || t.share.token !== token){ $('#main').innerHTML = '<div class="trip-card">קישור לא תקין או בוטל</div>'; return; }
  state.current = { id, ...t };
  renderJournal(t); initBigMap();
  $('#btnAddJournal').style.display = 'none';
}

// Utilities
function fmtDate(d){ if(!d) return ''; return dayjs(d).format('DD/MM/YYYY'); }
function fmtDateTime(d){ if(!d) return ''; return dayjs(d).format('DD/MM/YYYY HH:mm'); }
function esc(s){ return String(s||'').replace(/[&<>\"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]) ); }
function xml(s){ return esc(s); }
function num(n){ return (Number(n)||0).toFixed(2); }
function numOrNull(v){ const n = Number(v); return isFinite(n) ? n : null; }
function slug(s){ return (s||'trip').toString().replace(/\s+/g,'_').replace(/[^\w\-]/g,''); }
function downloadBlob(blob, name){ const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 2000); }
function xErr(e){ return e?.message?.replace('Firebase:', '').trim() || 'שגיאה'; }

document.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ document.querySelectorAll('dialog[open]').forEach(d=>d.close()); } });

// Firestore rules reference (put in Firebase Console):
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     match /trips/{tripId} {
//       allow read, write: if request.auth != null && request.auth.uid == resource.data.ownerUid;
//       allow read: if resource.data.share.enabled == true;
//     }
//   }
// }
