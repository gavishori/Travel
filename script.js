function linkifyToIcon(raw){
  if(!raw) return '';
  const parts = String(raw).split(/(https?:\/\/[^\s)]+)|(^\/https?:\/\/[^\s)]+)/g);
  return parts.filter(Boolean).map(p=>{
    if(/^(?:\/)?https?:\/\//.test(p)){
      const u = p.replace(/^\/+/, '').replace(/[),.;!?]+$/, '');
      const safe = u.replace(/"/g,'&quot;');
      return `<a href="${safe}" target="_blank" rel="noopener" class="link-icon" aria-label="קישור" title="${safe}">🔗</a>`;
    }
    return esc(p);
  }).join('');
}

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

// --- Numeric helpers for budget display (thousands separator, integers only) ---
function formatInt(n){
  n = Math.max(0, Math.floor(Number(n)||0));
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function parseIntSafe(s){
  const n = String(s||'').replace(/[^\d]/g,'');
  return Math.floor(Number(n||0)||0);
}

const showToast = (msg) => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 2600); };

// Mode management: 'home' (pick a trip) vs 'trip' (focus one)
function enterHomeMode(){
  const container = document.querySelector('.container');
  container.classList.add('home-mode');
  container.classList.remove('trip-mode');
  $('#tabs').style.display = 'none';
  $('#btnAllTrips').style.display = 'none';
  state.currentTripId = null;
  showView('welcome');
}
function enterTripMode(){
  const container = document.querySelector('.container');
  container.classList.add('trip-mode');
  container.classList.remove('home-mode');
  $('#tabs').style.display = 'flex';
  $('#btnAllTrips').style.display = 'inline-block';
}
$('#btnAllTrips').addEventListener('click', enterHomeMode);

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
  const container = document.querySelector('.container');
  const login = document.getElementById('loginScreen');
  const btnLogin = $('#btnLogin');
  const btnLogout = $('#btnLogout');
  const badge = $('#userBadge');

  if(user && !state.shared.readOnly){
    // Header
    if (btnLogin) btnLogin.style.display = 'none';
    if (btnLogout) btnLogout.style.display = 'inline-block';
    if (badge) { badge.style.display = 'inline-block'; badge.textContent = user.email || user.displayName || 'משתמש'; }
    // Screens
    if (login) login.style.display = 'none';
    if (container) container.style.display = 'grid';
    subscribeTrips();
    enterHomeMode();
  } else if(!user && !state.shared.readOnly){
    // Header
    if (btnLogin) btnLogin.style.display = 'inline-block';
    if (btnLogout) btnLogout.style.display = 'none';
    if (badge) { badge.style.display = 'none'; badge.textContent=''; }
    // Screens
    if (container) container.style.display = 'none';
    if (login) login.style.display = 'grid';
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
  // Switch to trip-mode so content is visible
  const container = document.querySelector('.container');
  container.classList.remove('home-mode'); container.classList.add('trip-mode');
  // Only journal + map
  $$('#tabs button').forEach(b=>{ if(!['journal','map'].includes(b.dataset.tab)) b.style.display='none'; });
  showView('journal');
  await loadSharedTrip(tripId, token);
}

// Firestore: subscribe to user's trips (no orderBy to avoid index; sort client-side)
async function subscribeTrips(){
  const q = FB.query(FB.collection(db, 'trips'), FB.where('ownerUid', '==', state.user.uid));
  FB.onSnapshot(q, (snap)=>{
    state.trips = snap.docs.map(d=>({ id:d.id, ...d.data() })).sort((a,b)=> (b.start||'').localeCompare(a.start||''));
    renderTripList();
  }, (err)=>{
    console.warn('subscribeTrips error', err);
    showToast('אין הרשאה לקרוא נתונים (בדוק את חוקי Firestore)');
  });
}

function renderTripList(){
  const list = $('#tripList');
  const search = $('#searchTrips').value?.trim();
  let items = [...state.trips];
  let s = null;
  if(search){
    s = search.toLowerCase();
    items = items.map(t=> ({...t, __match: matchInfo(t, s)}))
                 .filter(t=> t.__match.hit)
                 .sort((a,b)=> b.__match.score - a.__match.score);
  }
  list.className = state.viewMode==='grid' ? 'grid' : 'list';
  list.innerHTML = items.map(t=> state.viewMode==='grid' ? cardHTML(t, s) : rowHTML(t, s)).join('');
  list.querySelectorAll('[data-trip]').forEach(el=>{
    el.addEventListener('click', ()=> openTrip(el.dataset.trip));
  });
}
function cardHTML(t, s){
  const period = `${fmtDate(t.start)} – ${fmtDate(t.end)}`; const where = t.__match?.where || [];
  return `<div class="trip-card" data-trip="${t.id}">
    <div style="display:flex;justify-content:space-between;gap:8px">
      <div>
        <strong style="font-size:1.1rem">${esc(t.destination||'ללא יעד')}</strong>
        <div class="muted">${period}</div>
      </div>
      <span class="pill">${esc((t.types||'').toString())}</span>
    </div>
    ${s ? `<div class="muted" style="margin-top:6px">התאמות: ${where.map(w=>`<span class="pill">${w}</span>`).join(' ')}</div>` : ''}
  </div>`
}
function rowHTML(t, s){
  const period = `${fmtDate(t.start)} – ${fmtDate(t.end)}`; const where = t.__match?.where || [];
  return `<div class="trip-row" data-trip="${t.id}">
    <div><strong>${esc(t.destination||'ללא יעד')}</strong><div class="muted">${period}</div></div>
    <div class="pill">${esc((t.types||'').toString())}</div>
    ${s ? `<div class="muted" style="grid-column:1/-1;margin-top:4px">התאמות: ${where.map(w=>`<span class="pill">${w}</span>`).join(' ')}</div>` : ''}
  </div>`
}

function showView(view){
  try {
    $$('.tabview').forEach(v=>{ if (v) v.hidden = true; });
    const el = document.querySelector('#view-' + view);
    if (el) { el.hidden = false; } else { console.warn('View not found:', view); }
  } catch(e){ console.warn('showView error', e); }
}

// Open a trip -> Overview tab
async function openTrip(id){
  state.currentTripId = id;
  enterTripMode();
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
  const _md=$('#metaDestination'); if(_md) _md.value = t.destination||'';
  $('#metaStart').value = t.start||'';
  $('#metaEnd').value = t.end||'';
  const _mp=$('#metaPeople'); if(_mp) _mp.value = (t.people||[]).join(', ');
  const metaTypes = document.querySelectorAll('.metaType');
  metaTypes.forEach(btn => {
    btn.classList.remove('active');
    if ((t.types || []).includes(btn.dataset.value)) {
      btn.classList.add('active');
    }
  });

  const budget = t.budget||{ USD:0, EUR:0, ILS:0 };
  $('#bUSD').value = formatInt(budget.USD||0); $('#bEUR').value = formatInt(budget.EUR||0); $('#bILS').value = formatInt(budget.ILS||0); ['bUSD','bEUR','bILS'].forEach(id=> $('#'+id).disabled = !!t.budgetLocked); const be=$('#btnBudgetEdit'); if(be){ be.textContent = t.budgetLocked ? 'ביטול נעילה' : 'קבע תקציב'; be.classList.toggle('locked', !!t.budgetLocked);}
  if(t.rates){ state.rates = t.rates; }
  // Removed exchange rate inputs as per new design

  renderExpenses(t);
  renderJournal(t);
  initMiniMap(t);
  renderExpenseSummary(t);
}

// Add event listener for meta type buttons
document.querySelectorAll('.metaType').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    btn.classList.toggle('active');
  });
});


function renderExpenses(t){
  const body = $('#tblExpenses');
  body.innerHTML = '';
  const arr = Object.entries(t.expenses || {})
    .map(([id,e]) => ({ id, ...e }))
    .sort((a,b) => new Date(b.createdAt||0) - new Date(a.createdAt||0));

  arr.forEach(e=>{
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td class="menu"><button class="menu-btn" aria-label="פעולות" data-id="${esc(e.id)}">...</button></td>`+
      `<td>${linkifyToIcon(e.desc||'')}</td>`+
      `<td>${esc(e.category||'')}</td>`+
      `<td>${Number(e.amount||0).toFixed(2)}</td>`+
      `<td>${esc(e.currency||'')}</td>`+
      `<td>${fmtDateTime(e.createdAt)}</td>`;
    const menuBtn = tr.querySelector('.menu-btn');
    if(menuBtn){
      menuBtn.addEventListener('click', ()=>{ _rowActionExpense = e; $('#rowMenuModal').showModal(); });
    }
    body.appendChild(tr);
  });

  if ($('#tblRecentExpenses')){
    $('#tblRecentExpenses').innerHTML = arr.slice(0,5).map(e =>
      `<tr>`+
        `<td>${linkifyToIcon(e.desc||'')}</td>`+
        `<td>${esc(e.category||'')}</td>`+
        `<td>${Number(e.amount||0).toFixed(2)} ${esc(e.currency||'')}</td>`+
        `<td>${fmtDateTime(e.createdAt)}</td>`+
      `</tr>`
    ).join('');
  }
}



function renderJournal(t){
  const body = $('#tblJournal');
  if(!body){ return; }
  body.innerHTML = '';
  const arr = Object.entries(t.journal || {})
    .map(([id,j]) => ({ id, ...j }))
    .sort((a,b) => new Date(b.createdAt||0) - new Date(a.createdAt||0));

  arr.forEach(j=>{
    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td class="menu"><button class="menu-btn" aria-label="פעולות" data-id="${esc(j.id)}">...</button></td>`+
      `<td>${fmtDateTime(j.createdAt)}</td>`+
      `<td>${esc(j.placeName||'')}</td>`+
      `<td>${linkifyToIcon(j.text||'')}</td>`;
    const menuBtn = tr.querySelector('.menu-btn');
    if(menuBtn){
      menuBtn.addEventListener('click', ()=>{ _rowActionJournal = j; $('#rowMenuModalJournal').showModal(); });
    }
    body.appendChild(tr);
  });

  if ($('#tblRecentJournal')){
    $('#tblRecentJournal').innerHTML = arr.slice(0,5).map(j =>
      `<tr>`+
        `<td>${fmtDateTime(j.createdAt)}</td>`+
        `<td>${esc(j.placeName||'')}</td>`+
        `<td>${linkifyToIcon(j.text||'')}</td>`+
      `</tr>`
    ).join('');
  }
}



function renderExpenseSummary(t){
  const budget = t.budget||{USD:0,EUR:0,ILS:0};
  const exps = Object.values(t.expenses||{});
  // Determine active currency
  let cur = getActiveCurrencyFromTrip(t);
  // Totals per currency
  const totals = { USD:0, EUR:0, ILS:0 };
  exps.forEach(e=>{ if(totals[e.currency] != null) totals[e.currency]+= Number(e.amount||0); });
  const paid = (totals[cur]||0);
  const totalBudget = Number(budget[cur]||0);
  const balance = totalBudget - paid;

  const negClass = balance < 0 ? 'neg' : '';
  const html = `
    <div class="budget-bar">
      <div class="bar-actions">
        <button id="barSort" class="btn subtle">מיין</button>
        <button id="barAdd" class="btn subtle">הוסף</button>
      </div>
      <div class="bar-cols">
        <div class="col"><span class="lbl">תקציב</span><span class="val bold">${num(totalBudget)}</span></div>
        <div class="col"><span class="lbl">שולם</span><span class="val">${num(paid)}</span></div>
        <div class="col"><span class="lbl">יתרה</span><span id="balanceVal" class="val ${negClass}">${num(balance)}</span></div>
      </div>
      <button id="barCurrency" class="badge">${cur}</button>
    </div>
  `;
  $('#expenseSummary').innerHTML = html;

  // Hide duplicate external buttons in Expenses tab
  const ext = document.querySelector('#view-expenses .list-actions');
  if (ext) ext.style.display = 'none';

  // Wire actions to existing global handlers (if present)
  const addBtn = document.querySelector('#btnAddExpense');
  const sortBtn = document.querySelector('#btnSortExpenses');
  $('#barAdd')?.addEventListener('click', ()=> addBtn?.click());
  $('#barSort')?.addEventListener('click', ()=> sortBtn?.click());

  // Currency toggle with persistence
  $('#barCurrency')?.addEventListener('click', ()=>{
    cur = cycleCurrency(cur);
    setActiveCurrency(cur);
    renderExpenseSummary(t); // re-render in-place
  });
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

// enable pick-on-map mode
if(state.awaitPickFor){
  const clickOnce = (ev)=>{
    const {lat, lng} = ev.latlng;
    L.circleMarker([lat,lng], {radius:8,color:'#2a8'}).addTo(state.maps.big);
    if(typeof window.setPickedLocation==='function'){
      window.setPickedLocation(lat, lng);
    }
    state.awaitPickFor = null;
    state.maps.big.off('click', clickOnce);
    showToast('נקודה נבחרה');
  };
  state.maps.big.on('click', clickOnce);
  showToast('לחץ על המפה כדי לבחור מיקום');
}

}

$('#btnToggleSpent').addEventListener('click', ()=>{
  const m = state.maps.layers.expenses; if(!m) return; if(state.maps.big.hasLayer(m)){ state.maps.big.removeLayer(m); } else { state.maps.big.addLayer(m); }
});
$('#btnToggleVisited').addEventListener('click', ()=>{
  const m = state.maps.layers.journal; if(!m) return; if(state.maps.big.hasLayer(m)){ state.maps.big.removeLayer(m); } else { state.maps.big.addLayer(m); }
});


// Auth modal
$('#btnLogin').addEventListener('click', ()=> {
  const s = document.querySelector('#authModal');
  if(s && s.showModal) s.showModal();
  const c = document.querySelector('.container');
  if(c) c.style.display='none';
});
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
  try{
    await FB.sendPasswordResetEmail(auth, $('#authEmail').value.trim());
    showToast('נשלח מייל לאיפוס');
  }catch(e){ $('#authError').textContent = xErr(e); }
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
  const types = $$('.metaType.active').map(btn => btn.dataset.value);
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
  let usd = parseIntSafe($('#bUSD').value);
  let eur = parseIntSafe($('#bEUR').value);
  let ils = parseIntSafe($('#bILS').value);
  if(from==='USD'){ eur = Math.round(usd*state.rates.USDEUR); ils = Math.round(usd*state.rates.USDILS); }
  if(from==='EUR'){ const u = Math.round(eur/state.rates.USDEUR); usd = u; ils = Math.round(u*state.rates.USDILS); }
  if(from==='ILS'){ const u = Math.round(ils/state.rates.USDILS); usd = u; eur = Math.round(u*state.rates.USDILS); }
  $('#bUSD').value = formatInt(usd); $('#bEUR').value = formatInt(eur); $('#bILS').value = formatInt(ils);
}
['bUSD','bEUR','bILS'].forEach(id=> $('#'+id).addEventListener('input', ()=> syncBudget(id.replace('b','')) ));
if($('#rateUSDEUR')) $('#rateUSDEUR').addEventListener('input', e=> state.rates.USDEUR = Number(e.target.value||0.92));
if($('#rateUSDILS')) $('#rateUSDILS').addEventListener('input', e=> state.rates.USDILS = Number(e.target.value||3.7));
$('#btnBudgetEdit').addEventListener('click', async ()=>{
  const btn = $('#btnBudgetEdit');
  const locking = !btn.classList.contains('locked');
  const ref = FB.doc(db,'trips', state.currentTripId);
  const budget = { USD: parseIntSafe($('#bUSD').value), EUR: parseIntSafe($('#bEUR').value), ILS: parseIntSafe($('#bILS').value) };
  await FB.updateDoc(ref, { budget, rates: {...state.rates}, budgetLocked: locking });
  ['bUSD','bEUR','bILS'].forEach(id=> $('#'+id).disabled = locking);
  btn.classList.toggle('locked', locking);
  btn.textContent = locking ? 'ביטול נעילה' : 'קבע תקציב';
  showToast(locking ? 'התקציב נקבע' : 'התקציב פתוח לעריכה');
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
  populatePlacesDatalist();
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
  const jr = Object.values(t.journal||{}).sort((a,b)=> new Date(a.createdAt||0) - new Date(b.createdAt||0));
  doc.text('יומן', 40, 90);
  doc.autoTable({ startY: 100, head:[['תאריך','מקום','תיאור']], body: jr.map(j=>[fmtDateTime(j.createdAt), j.placeName||'', j.text||'']) });
  if(withExp){
    const ex = Object.values(t.expenses||{}).sort((a,b)=> new Date(a.createdAt||0) - new Date(b.createdAt||0));
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
  const jr = Object.values(t.journal||{}).sort((a,b)=> new Date(a.createdAt||0) - new Date(b.createdAt||0));
  const ex = Object.values(t.expenses||{}).sort((a,b)=> new Date(a.createdAt||0) - new Date(b.createdAt||0));
  const doc = new Document({ sections:[{ properties:{}, children:[
    new Paragraph({ text:`דוח נסיעה — ${t.destination||''}`, heading:HeadingLevel.HEADING_1 }),
    new Paragraph({ text:`${fmtDate(t.start)} – ${fmtDate(t.end)}` }),
    new Paragraph({ text:`יומן`, heading:HeadingLevel.HEADING_2 }),
    tableFrom([['תאריך','מקום','תיאור']], jr.map(j=>[fmtDateTime(j.createdAt), j.placeName||'', j.text||''])),
    ...(withExp? [ new Paragraph({ text:`הוצאות`, heading:HeadingLevel.HEading_2 }), tableFrom([['תיאור','קטגוריה','סכום','מטבע','תאריך']], ex.map(e=>[e.desc||'', e.category||'', String(num(e.amount)), e.currency||'', fmtDateTime(e.createdAt)])) ]: [])
  ]}]});
  function tableFrom(head, rows){
    return new Table({ width:{size:100, type:WidthType.PERCENTAGE}, rows:[ new TableRow({ children: head[0].map(h=> new TableCell({ children:[new Paragraph({ text:h })] })) }), ...rows.map(r=> new TableRow({ children: r.map(c=> new TableCell({ children:[new Paragraph({ text: String(c) })] })) })) ]});
  }
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `FLYMILY_${slug(t.destination)}.docx`);
}

function exportGPX(){
  const t = state.current; if(!t) return;
  const jr = Object.values(t.journal||{}).filter(j=>j.lat&&j.lng).sort((a,b)=> new Date(a.createdAt||0) - new Date(b.createdAt||0));
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

// === Budget Bar Helpers ===
function getSavedCurrencyKey(){
  return state.currentTripId ? `flymily.currency.${state.currentTripId}` : 'flymily.currency';
}
function getActiveCurrencyFromTrip(t){
  // priority: explicit baseCurrency -> saved localStorage -> first non-zero budget -> 'EUR'
  if (t && t.baseCurrency && ['USD','EUR','ILS'].includes(t.baseCurrency)) return t.baseCurrency;
  const saved = localStorage.getItem(getSavedCurrencyKey());
  if (saved && ['USD','EUR','ILS'].includes(saved)) return saved;
  if (t && t.budget){
    for (const c of ['USD','EUR','ILS']){
      if (Number(t.budget[c]||0) > 0) return c;
    }
  }
  return 'EUR';
}
function setActiveCurrency(cur){
  if (!['USD','EUR','ILS'].includes(cur)) return;
  localStorage.setItem(getSavedCurrencyKey(), cur);
}
function cycleCurrency(cur){
  const order = ['USD','EUR','ILS'];
  const i = order.indexOf(cur);
  return order[(i+1)%order.length];
}
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

// Login screen actions
$('#lsSignIn').addEventListener('click', async ()=>{
  try{
    await FB.signInWithEmailAndPassword(auth, $('#lsEmail').value.trim(), $('#lsPass').value);
    $('#lsError').textContent = ''; 
  }catch(e){ $('#lsError').textContent = xErr(e); }
});
$('#lsSignUp').addEventListener('click', async ()=>{
  try{
    await FB.createUserWithEmailAndPassword(auth, $('#lsEmail').value.trim(), $('#lsPass').value);
    $('#lsError').textContent = '';
  }catch(e){ $('#lsError').textContent = xErr(e); }
});
$('#lsReset').addEventListener('click', async ()=>{
  try{ await FB.sendPasswordResetEmail(auth, $('#lsEmail').value.trim()); showToast('נשלח מייל לאיפוס'); }catch(e){ $('#lsError').textContent = xErr(e); }
});

function mark(text, s){
  if(!s) return esc(text||''); const t = String(text); const i = t.toLowerCase().indexOf(s); if(i<0) return esc(t);
  return esc(t.slice(0,i)) + '<mark>' + esc(t.slice(i,i+s.length)) + '</mark>' + esc(t.slice(i+s.length));
}
function snippet(text, s, len=60){
  if(!text) return ''; const t = String(text); const idx = t.toLowerCase().indexOf(s);
  if(idx<0) return esc(t.slice(0,len));
  const start = Math.max(0, idx - Math.floor(len/3)); const end = Math.min(t.length, idx + s.length + Math.floor(len/3));
  const seg = t.slice(start, end); const pre = start>0 ? '…' : ''; const post = end<t.length ? '…' : '';
  return pre + mark(seg, s) + post;
}
function matchInfo(t, s){
  let score = 0, where = [];
  const dst = (t.destination||''); if(dst.toLowerCase().includes(s)){ score+=5; where.push(`יעד: ${snippet(dst,s)}`); }
  const types = (Array.isArray(t.types)? t.types.join(', '): (t.types||'')); if(types.toLowerCase().includes(s)){ score+=2; where.push(`סוגים: ${snippet(types,s)}`); }
  const people = (Array.isArray(t.people)? t.people.join(', '): (t.people||'')); if(people.toLowerCase().includes(s)){ score+=1; where.push(`משתתפים: ${snippet(people,s)}`); }
  const ex = Object.values(t.expenses||{}); let exHits = 0; ex.forEach(e=>{ if((e.desc||'').toLowerCase().includes(s) || (e.category||'').toLowerCase().includes(s)){ exHits++; where.push(`הוצאות: ${snippet(e.desc||e.category||'', s)}`);} });
  if(exHits) score += Math.min(3, exHits);
  const jr = Object.values(t.journal||{}); let jrHits = 0; jr.forEach(j=>{ if((j.text||'').toLowerCase().includes(s) || (j.placeName||'').toLowerCase().includes(s)){ jrHits++; where.push(`יומן: ${snippet(j.text||j.placeName||'', s)}`);} });
  if(jrHits) score += Math.min(3, jrHits);
  return { hit: score>0, score, where };
}

// Global modal state for row actions
let _rowActionExpense = null;
let _rowActionJournal = null;
(() => {
  const modal = document.getElementById('rowMenuModal');
  if (!modal) return;
  const btnEdit = document.getElementById('rowMenuEdit');
  const btnDel = document.getElementById('rowMenuDelete');
  const btnCancel = document.getElementById('rowMenuCancel');
  if (btnEdit) btnEdit.addEventListener('click', ()=>{
    if (_rowActionExpense) { openExpenseModal(_rowActionExpense); }
    else if (_rowActionJournal) { openJournalModal(_rowActionJournal); }
    modal.close(); _rowActionExpense = _rowActionJournal = null;
  });
  if (btnDel) btnDel.addEventListener('click', ()=>{
    if (_rowActionExpense) { deleteExpense(_rowActionExpense.id); }
    else if (_rowActionJournal) { deleteJournal(_rowActionJournal.id); }
    modal.close(); _rowActionExpense = _rowActionJournal = null;
  });
  if (btnCancel) btnCancel.addEventListener('click', ()=>{
    modal.close(); _rowActionExpense = _rowActionJournal = null;
  });
})();

// ---- Journal place autocomplete + location helpers ----
// NEW: Search an external service for places
async function searchPlaces(query) {
  if (query.length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=10&accept-language=he`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching search results:', error);
    return [];
  }
}

// NEW: Populate the datalist with live search results
const jrPlaceInput = document.getElementById('jrPlace');
if (jrPlaceInput) {
  jrPlaceInput.addEventListener('input', async (e) => {
    const query = e.target.value;
    const results = await searchPlaces(query);
    const datalist = document.getElementById('placesList');
    datalist.innerHTML = '';
    results.forEach(result => {
      const option = document.createElement('option');
      option.value = result.display_name;
      // You can store more data here if needed, like lat/lng
      // option.dataset.lat = result.lat;
      // option.dataset.lng = result.lon;
      datalist.appendChild(option);
    });
  });
}

const geoBtn = document.getElementById('jrGeoBtn');
if (geoBtn) geoBtn.addEventListener('click', ()=>{
  if(!navigator.geolocation){ showToast('אין גישה למיקום בדפדפן'); return; }
  navigator.geolocation.getCurrentPosition((pos)=>{
    const {latitude, longitude} = pos.coords;
    const latEl = document.getElementById('jrLat'); const lngEl = document.getElementById('jrLng');
    if(latEl) latEl.value = latitude.toFixed(6);
    if(lngEl) lngEl.value = longitude.toFixed(6);
    showToast('המיקום מולא מהGPS');
  }, ()=> showToast('נכשלה קריאת מיקום'));
});

const pickBtn = document.getElementById('jrPickOnMap');
if (pickBtn) pickBtn.addEventListener('click', ()=>{
  state.awaitPickFor = 'journal';
  const mapTab = document.querySelector('#tabs [data-tab="map"]');
  if(mapTab){ mapTab.click(); showToast('בחר נקודה על המפה — נשלים אוטומטית ביומן'); }
  else { showToast('לא נמצאה מפה במערכת'); }
});

window.setPickedLocation = function(lat,lng,address){
  const latEl = document.getElementById('jrLat'); const lngEl = document.getElementById('jrLng'); const placeEl = document.getElementById('jrPlace');
  if(state.awaitPickFor==='journal'){
    if(placeEl && address) placeEl.value = address;
    if(latEl) latEl.value = +lat;
    if(lngEl) lngEl.value = +lng;
    state.awaitPickFor = null;
    const jm = document.getElementById('journalModal'); if(jm && !jm.open){ jm.showModal(); }
    showToast('המיקום נבחר על המפה');
  } else if(state.awaitPickFor==='expense'){
    const eLat = document.getElementById('expLat'); const eLng = document.getElementById('expLng');
    if(eLat) eLat.value = +lat; if(eLng) eLng.value = +lng;
    state.awaitPickFor = null;
    showToast('מיקום עודכן בהוצאה');
  }
};

// Expense modal: geo/pick hooks
const expGeoBtn = document.getElementById('expGeoBtn');
if (expGeoBtn) expGeoBtn.addEventListener('click', ()=>{
  if(!navigator.geolocation){ showToast('אין גישה למיקום בדפדפן'); return; }
  navigator.geolocation.getCurrentPosition((pos)=>{
    const {latitude, longitude} = pos.coords;
    const latEl = document.getElementById('expLat'); const lngEl = document.getElementById('expLng');
    if(latEl) latEl.value = latitude.toFixed(6);
    if(lngEl) lngEl.value = longitude.toFixed(6);
    showToast('המיקום מולא מהGPS');
  }, ()=> showToast('נכשלה קריאת מיקום'));
});
const expPickBtn = document.getElementById('expPickOnMap');
if (expPickBtn) expPickBtn.addEventListener('click', ()=>{
  state.awaitPickFor = 'expense';
  const mapTab = document.querySelector('#tabs [data-tab="map"]');
  if(mapTab){ mapTab.click(); showToast('בחר נקודה על המפה — נעדכן בהוצאה'); }
  else { showToast('לא נמצאה מפה במערכת'); }
});