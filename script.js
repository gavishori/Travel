// ---- Lazy loader for heavy export libs with multi-CDN fallback ----
async function loadExternalScript(urls) {
  for (const url of urls) {
    try {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = url;
        s.async = true;
        s.onload = () => res();
        s.onerror = () => { s.remove(); rej(new Error('failed')); };
        document.head.appendChild(s);
      });
      return true;
    } catch (e) { /* try next */ }
  }
  return false;
}
async function ensureJsPDF() {
  if (typeof window.jspdf !== 'undefined' || typeof window.jsPDF !== 'undefined') return true;
  const ok = await loadExternalScript([
    "https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js",
    "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"
  ]);
  if (!ok) return false;
  const ok2 = await loadExternalScript([
    "https://unpkg.com/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js",
    "https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js"
  ]);
  return ok2;
}
async function ensureXLSX() {
  if (typeof window.XLSX !== 'undefined') return true;
  return await loadExternalScript([
    "https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js",
    "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"
  ]);
}
async function ensureDOCX() {
  if (typeof window.docx !== 'undefined') return true;
  return await loadExternalScript([
    "https://unpkg.com/docx@8.5.0/build/index.umd.js",
    "https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js"
  ]);
}
function toast(msg){ const t=document.getElementById('toast'); if(!t) { alert(msg); return; } t.textContent=msg; t.className='toast show'; setTimeout(()=>t.className='toast', 2200); }

// === Currency conversion helpers ===
function rateMatrix(r){
  const USDEUR = Number((r && r.USDEUR) ?? (state?.rates?.USDEUR) ?? 0.92);
  const USDILS = Number((r && r.USDILS) ?? (state?.rates?.USDILS) ?? 3.7);
  const USDLocal = Number((r && r.USDLocal) ?? (state?.rates?.USDLocal) ?? 1);
  const M = {
    USD: { USD:1, EUR:USDEUR, ILS:USDILS, [state.current?.localCurrency]: USDLocal },
    EUR: { USD:1/USDEUR, EUR:1, ILS:USDILS/USDEUR, [state.current?.localCurrency]: USDLocal/USDEUR },
    ILS: { USD:1/USDILS, EUR:USDEUR/USDILS, ILS:1, [state.current?.localCurrency]: USDLocal/USDILS }
  };
  const localCur = state.current?.localCurrency;
  if(localCur && !M[localCur]){
    M[localCur] = { USD:1/USDLocal, EUR:USDEUR/USDLocal, ILS:USDILS/USDLocal, [localCur]:1 };
  }
  return M;
}
function convertAmount(amount, from, to, rates){
  const M = rateMatrix(rates);
  const a = Number(amount)||0;
  if(!M[from] || !M[from][to]) return a; // graceful fallback
  return a * M[from][to];
}
// === Fetch live USD rates once and lock ===
async function fetchRatesOnce(){
  try{
    const localCur = state.current?.localCurrency;
    const to = ['ILS', 'EUR'];
    if (localCur) to.push(localCur);
    const r = await fetch(`https://api.frankfurter.app/latest?from=USD&to=${to.join(',')}`);
    const d = await r.json();
    const USDILS = Number(d && d.rates && d.rates.ILS);
    const USDEUR = Number(d && d.rates && d.rates.EUR);
    const USDLocal = (localCur) ? Number(d && d.rates && d.rates[localCur]) : null;
    if(USDILS && USDEUR){
      const rates = { USDILS, USDEUR, lockedAt: new Date().toISOString() };
      if(USDLocal) rates.USDLocal = USDLocal;
      return rates;
    }
  }catch(e){ console.warn('fetchRatesOnce failed', e); }
  // Fallback to current state rates, still stamp time
  return { USDILS: (state.rates?.USDILS)||3.7, USDEUR: (state.rates?.USDEUR)||0.92, lockedAt: new Date().toISOString() };
}

// === End helpers ===


import { auth, db, FB } from './firebase.js';

// Day.js setup

function esc(s){
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}


// Safe Day.js plugin setup (guards against missing plugins due to blocked CDN)
try {
  if (typeof dayjs!=='undefined') {
    if (window.dayjs_plugin_advancedFormat) { try { dayjs.extend(window.dayjs_plugin_advancedFormat); } catch(e){} }
    if (window.dayjs_plugin_utc) { try { dayjs.extend(window.dayjs_plugin_utc); } catch(e){} }
    if (window.dayjs_plugin_timezone) { try { dayjs.extend(window.dayjs_plugin_timezone); } catch(e){} }
  }
} catch(e) { /* ignore */ }
// App State
const state = {
  user: null,
  trips: [],
  currentTripId: null,
  viewMode: 'grid',
  rates: { USDEUR: 0.92, USDILS: 3.7 },
  maps: { mini: null, big: null, layers: { expenses: null, journal: null }, select: null, selectMarker: null, currentModal: null },
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
  if(btn.dataset.tab==='overview') setTimeout(()=> initMiniMap(state.current||{}), 50);
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


// Date formatting helper used by trip cards
function fmtDate(d){
  if(!d) return '';
  try{ return dayjs(d).format('DD/MM/YYYY'); }
  catch(e){ return String(d||''); }
}
// Add the missing fmtDateTime function
function fmtDateTime(d){
  if(!d) return '';
  try{ return dayjs(d).format('DD/MM/YYYY HH:mm'); }
  catch(e){ return String(d||''); }
}

// Robust sort key for expenses (handles legacy fields)
function expenseSortKey(e){
  const candidates = [e.createdAt, e.date, e.time, e.ts, e.timestamp];
  for (const v of candidates){
    if(!v) continue;
    const d = new Date(v);
    if(!isNaN(d)) return d.getTime();
    const n = Number(v);
    if(!isNaN(n)) return n;
  }
  return 0; // fallback
}
function num(n){
  if (typeof n !== 'number') return '';
  return n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function xErr(e){
  const msg = e?.message || String(e);
  if (msg.includes('auth/invalid-email')) return 'מייל לא תקין';
  if (msg.includes('auth/weak-password')) return 'סיסמה חלשה (6 תווים ומעלה)';
  if (msg.includes('auth/email-already-in-use')) return 'מייל כבר קיים במערכת';
  if (msg.includes('auth/wrong-password') || msg.includes('auth/invalid-credential')) return 'שם משתמש או סיסמה שגויים';
  if (msg.includes('auth/user-not-found')) return 'משתמש לא נמצא';
  return 'שגיאה: ' + msg;
}
function numOrNull(s){
  const n = Number(s);
  return isNaN(n) ? null : n;
}
function getActiveCurrencyFromTrip(t){
  return localStorage.getItem(`flymily_currency_${t.id}`) || 'USD';
}
function setActiveCurrency(cur){
  localStorage.setItem(`flymily_currency_${state.current.id}`, cur);
}
function cycleCurrency(cur){
  const opts = ['USD', 'EUR', 'ILS'];
  const localCur = state.current?.localCurrency;
  if (localCur && !opts.includes(localCur)) {
    opts.unshift(localCur);
  }
  const idx = opts.indexOf(cur);
  return opts[(idx + 1) % opts.length];
}
// Firestore: subscribe to user's trips (no orderBy to avoid index; sort client-side)
async function subscribeTrips(){
  if (!state.user || !state.user.uid) {
    console.warn('subscribeTrips: user not ready; skipping');
    return;
  }
  try { state._unsubTrips && state._unsubTrips(); } catch(_) {}
  const q = FB.query(FB.collection(db, 'trips'), FB.where('ownerUid', '==', state.user.uid));
  state._unsubTrips = FB.onSnapshot(q, (snap)=>{
    state.trips = snap.docs.map(d=>({ id:d.id, ...d.data() })).sort((a,b)=> (b.start||'').localeCompare(a.start||''));
    renderTripList();
  }, (err)=>{
    console.warn('subscribeTrips error', err);
    showToast('אין הרשאה לקרוא נתונים (בדוק התחברות/חוקי Firestore)');
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
  // Update active button state
  $$('.list-actions .btn').forEach(btn => btn.classList.remove('active'));
  $(`#btnView${state.viewMode==='grid' ? 'Grid' : 'List'}`).classList.add('active');
  // Bind menu buttons
  list.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      _rowActionTrip = state.trips.find(t => t.id === btn.dataset.id);
      $('#rowMenuModal').showModal();
    });
  });
}
function cardHTML(t, s){
  const period = `${fmtDate(t.start)} – ${fmtDate(t.end)}`;
  const where = t.__match?.where || [];
  return `<div class="trip-card" data-trip="${t.id}">
    <div>
        <strong>${esc(t.destination||'ללא יעד')}</strong>
    </div>
    <div class="muted">${period}</div>
    <div class="trip-footer-grid">
      <div class="pill">${esc((t.types||'').toString())}</div>
      <button class="menu-btn" data-id="${t.id}" aria-label="פעולות">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-more-vertical"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
      </button>
    </div>
    ${s ? `<div class="muted" style="margin-top:6px;width:100%">התאמות: ${where.map(w=>`<span class="pill" onclick="searchAndNavigate('${t.id}', '${s}', '${w.type}', '${w.itemId}')">${w.label}</span>`).join(' ')}</div>` : ''}
  </div>`;
}
function rowHTML(t, s){
  const period = `${fmtDate(t.start)} – ${fmtDate(t.end)}`;
  const where = t.__match?.where || [];
  return `<div class="trip-row" data-trip="${t.id}">
    <div class="row-main-content">
      <strong>${esc(t.destination||'ללא יעד')}</strong>
      <span class="muted">${period}</span>
      <div class="pill">${esc((t.types||'').toString())}</div>
    </div>
    <button class="menu-btn" data-id="${t.id}" aria-label="פעולות">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-more-vertical"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
    </button>
    ${s ? `<div class="muted" style="grid-column:1/-1;margin-top:4px">התאמות: ${where.map(w=>`<span class="pill" onclick="searchAndNavigate('${t.id}', '${s}', '${w.type}', '${w.itemId}')">${w.label}</span>`).join(' ')}</div>` : ''}
  </div>`;
}

function showView(view){
  try {
    // Hide all first (no layout jank)
    $$('.tabview').forEach(v=>{ if (v) v.hidden = true; v && v.classList && v.classList.remove('fade-enter','fade-enter-active'); });
    const el = document.querySelector('#view-' + view);
    if (el) {
      el.hidden = false;
      // micro fade-in to eliminate "flash"
      el.classList.add('fade-enter');
      requestAnimationFrame(()=>{
        el.classList.add('fade-enter-active');
        setTimeout(()=>{ el.classList.remove('fade-enter','fade-enter-active'); }, 220);
      });
    } else {
      console.warn('View not found:', view);
    }
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

// Function to map country to currency
const localCurrencyMap = {
  "תאילנד": "THB", "צרפת": "EUR", "יפן": "JPY", "בריטניה": "GBP", "גרמניה": "EUR", "אוסטרליה": "AUD", "קנדה": "CAD", "מקסיקו": "MXN", "טורקיה": "TRY", "שווייץ": "CHF", "סינגפור": "SGD"
};
function getLocalCurrency(destination){
  if (!destination) return null;
  const destinations = destination.split(',').map(d=>d.trim());
  const localCurrencies = destinations.map(d=>localCurrencyMap[d]).filter(Boolean);
  return localCurrencies.length ? localCurrencies[0] : null;
}

async function loadTrip(){
  const ref = FB.doc(db, 'trips', state.currentTripId);
  const snap = await FB.getDoc(ref);
  if(!snap.exists()) return;
  const t = { id: snap.id, ...snap.data() };
  state.current = t;
  state.current.localCurrency = getLocalCurrency(t.destination);

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
  (function(){ const typesArr = Array.isArray(t.types)?t.types:[]; $$('.metaType').forEach(btn=>{ btn.classList.toggle('active', typesArr.includes(btn.dataset.value)); btn.onclick = ()=> btn.classList.toggle('active'); }); })();
  const budget = t.budget||{ USD:0, EUR:0, ILS:0 };
  $('#bUSD').value = formatInt(budget.USD||0); $('#bEUR').value = formatInt(budget.EUR||0); $('#bILS').value = formatInt(budget.ILS||0); ['bUSD','bEUR','bILS'].forEach(id=> $('#'+id).disabled = !!t.budgetLocked); const be=$('#btnBudgetEdit'); if(be){ be.textContent = t.budgetLocked ? 'ביטול נעילה' : 'קבע תקציב'; be.classList.toggle('locked', !!t.budgetLocked);}
  if(t.rates){ state.rates = t.rates; }
  const _r1=$('#rateUSDEUR'); const _r2=$('#rateUSDILS'); if(_r1) _r1.value = state.rates.USDEUR; if(_r2) _r2.value = state.rates.USDILS;

  renderExpenses(t);
  renderJournal(t);
  initMiniMap(t);
  renderExpenseSummary(t);
}


function renderExpenses(t, order){
  order = (order || state.expenseSort || 'desc');
  const dir = (order === 'asc') ? 1 : -1;
  const body = $('#tblExpenses'); body.innerHTML = '';
  const arr = Object.entries(t.expenses||{})
    .map(([id,e])=>({id, ...e}))
    .sort((a,b)=> dir * (expenseSortKey(a) - expenseSortKey(b)));
  arr.forEach(e=>{
    const tr = document.createElement('tr');
    tr.dataset.id = e.id;
    const linkedDesc = linkifyText(e.desc || '');
    tr.innerHTML = `<td class="menu"><button class="menu-btn" aria-label="פעולות" data-id="${e.id}">...</button></td>
      <td>${linkedDesc}</td><td>${esc(e.category||'')}</td><td>${Number(e.amount||0).toFixed(2)}</td><td>${e.currency||''}</td><td>${fmtDateTime(e.createdAt)}</td>`;
    const menuBtn = tr.querySelector('.menu-btn');
    menuBtn.addEventListener('click', ()=>{ _rowActionExpense = e; $('#rowMenuModal').showModal(); });
    // Prevent the row click event from being triggered by the link
    tr.querySelector('td')?.addEventListener('click', (ev) => {
        if(ev.target.tagName === 'A') {
            ev.stopPropagation();
        }
    });
    body.appendChild(tr);
  });
  // Recent for overview
  $('#tblRecentExpenses').innerHTML = arr.slice(0,5).map(e=>`<tr><td>${linkifyText(e.desc || '')}</td><td>${esc(e.category||'')}</td><td>${Number(e.amount||0).toFixed(2)} ${e.currency||''}</td><td>${fmtDateTime(e.createdAt)}</td></tr>`).join('');
}



function renderJournal(t, order){
  order = (order || state.journalSort || 'desc');
  const dir = (order === 'asc') ? 1 : -1;
  const body = $('#tblJournal'); body.innerHTML = '';
  const arr = Object.entries(t.journal||{})
    .map(([id,j])=>({id, ...j}))
    .sort((a,b)=> dir * (expenseSortKey(a) - expenseSortKey(b)));
  arr.forEach(j=>{
    const tr = document.createElement('tr');
    tr.dataset.id = j.id;
    const linkedText = linkifyText(j.text || '');
    tr.innerHTML = `<td class="menu"><button class="menu-btn" aria-label="פעולות" data-id="${j.id}">...</button></td>
      <td>${fmtDateTime(j.createdAt)}</td><td>${esc(j.placeName||'')}</td><td>${linkedText}</td>`;
    const menuBtn = tr.querySelector('.menu-btn');
    menuBtn.addEventListener('click', ()=>{ _rowActionJournal = j; $('#rowMenuModal').showModal(); });
    // Prevent the row click event from being triggered by the link
    tr.querySelector('td')?.addEventListener('click', (ev) => {
        if(ev.target.tagName === 'A') {
            ev.stopPropagation();
        }
    });
    body.appendChild(tr);
  });
  $('#tblRecentJournal').innerHTML = arr.slice(0,5).map(j=>`<tr><td>${fmtDateTime(j.createdAt)}</td><td>${esc(j.placeName||'')}</td><td>${linkifyText(j.text || '')}</td></tr>`).join('');
}


// New function to find and wrap links in text
function linkifyText(text) {
  if (!text) return '';
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (url) => {
    return `<a href="${esc(url)}" target="_blank" class="external-link">קישור <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-external-link"><path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg></a>`;
  });
}

function renderExpenseSummary(t){
  const order = (state.expenseSort||'desc');
  const budget = t.budget||{USD:0,EUR:0,ILS:0};
  let exps = Object.values(t.expenses||{});
  const mul = (order==='asc'?1:-1);
  exps.sort((a,b)=> mul * (new Date(a.createdAt)-new Date(b.createdAt)));
  // Determine active currency
  let cur = getActiveCurrencyFromTrip(t);
  // Totals across all currencies converted to the active currency
  const paid = exps.reduce((sum, e) => sum + convertAmount(e.amount, e.currency, cur, e.rates || t.rates || state.rates), 0);
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
      <button id="barCurrency" type="button" class="badge">${cur}</button>
    </div>
  
  ${ (cur!=='ILS') ? `<div class="rate-line">1 USD = ₪${Number((t.rates?.USDILS ?? state.rates?.USDILS ?? 3.7)).toFixed(2)} · 1 EUR = ₪${Number(((t.rates?.USDILS ?? state.rates?.USDILS ?? 3.7)/(t.rates?.USDEUR ?? state.rates?.USDEUR ?? 0.92))).toFixed(2)}${t.rates?.lockedAt?` — ננעל ב-${dayjs(t.rates.lockedAt).format('DD/MM/YYYY HH:mm')}`:''}</div>` : ''}
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
  const container = document.getElementById('miniMap');
  if(!container) return;
  if(!state.maps.mini){
    state.maps.mini = L.map(container);
  }
  const m = state.maps.mini;
  if(!state.maps._miniTiles){
    state.maps._miniTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {attribution:'© OpenStreetMap contributors'}).addTo(m);
  }
  if(!state.maps.layers) state.maps.layers = {};
  if(!state.maps.layers.mini){ state.maps.layers.mini = L.layerGroup().addTo(m); }
  state.maps.layers.mini.clearLayers();

  const journal = Object.values((t && t.journal)||{}).filter(j=>j.lat&&j.lng);
  const expenses = Object.values((t && t.expenses)||{}).filter(e=>e.lat&&e.lng);

  expenses.forEach(e=> L.circleMarker([e.lat,e.lng], {radius:6,color:'#ff8c00'}).addTo(state.maps.layers.mini) );
  journal.forEach(j=> L.circleMarker([j.lat,j.lng], {radius:6,color:'#1e90ff'}).addTo(state.maps.layers.mini) );

  const layer = state.maps.layers.mini;
  if(layer.getLayers().length){
    try{ m.fitBounds(layer.getBounds(), { padding:[20,20] }); }catch{}
  } else {
    try{ m.setView([31.5,34.8], 4); }catch{}
  }
  setTimeout(()=> m.invalidateSize(), 100);
}
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
  jrs.forEach(j=> L.circleMarker([j.lat,j.lng], {radius:7,color:'#1e90ff'}).bindPopup(`${esc(j.placeName||'')}: ${linkifyText(j.text || '')}`).addTo(state.maps.layers.journal));
  const all = [...exps.map(e=>[e.lat,e.lng]), ...jrs.map(j=>[j.lat,j.lng])];
  if(all.length){ try{ state.maps.big.fitBounds(all, { padding:[40,40] }); }catch{} }
  setTimeout(()=> state.maps.big.invalidateSize(), 80);
  try{ const se = state.maps.layers.expenses, sj = state.maps.layers.journal; const onE = state.maps.big.hasLayer(se) && se.getLayers && se.getLayers().length>0; const onJ = state.maps.big.hasLayer(sj) && sj.getLayers && sj.getLayers().length>0; $('#btnToggleSpent').classList.toggle('active', onE); $('#btnToggleSpent').setAttribute('aria-pressed', onE); $('#btnToggleVisited').classList.toggle('active', onJ); $('#btnToggleVisited').setAttribute('aria-pressed', onJ); }catch{}
}

$('#btnToggleSpent').addEventListener('click', ()=>{
  const m = state.maps.layers.expenses; if(!m) return; if(state.maps.big.hasLayer(m)){ state.maps.big.removeLayer(m); } else { state.maps.big.addLayer(m); }
});
$('#btnToggleVisited').addEventListener('click', ()=>{
  const m = state.maps.layers.journal; if(!m) return; if(state.maps.big.hasLayer(m)){ state.maps.big.removeLayer(m); } else { state.maps.big.addLayer(m); }
});

// Auth UI
$('#btnLogin').addEventListener('click', ()=> { const s=document.getElementById('loginScreen'); if(s) s.style.display='grid'; const c=document.querySelector('.container'); if(c) c.style.display='none'; });
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
  const types = $$('.metaType.active').map(b=>b.dataset.value);
  const destination = $('#metaDestination').value.trim();
  const localCur = getLocalCurrency(destination);
  await FB.updateDoc(ref, { destination, start: $('#metaStart').value, end: $('#metaEnd').value, people, types, localCurrency: localCur });
  showToast('נשמר'); loadTrip();
});
$('#btnVerifyOnMap').click(() => {
  // ...
});

// Budget edit + currency sync
function syncBudget(from){
  let usd = parseIntSafe($('#bUSD').value);
  let eur = parseIntSafe($('#bEUR').value);
  let ils = parseIntSafe($('#bILS').value);
  if(from==='USD'){ eur = Math.round(usd*state.rates.USDEUR); ils = Math.round(usd*state.rates.USDILS); }
  if(from==='EUR'){ const u = Math.round(eur/state.rates.USDEUR); usd = u; ils = Math.round(u*state.rates.USDILS); }
  if(from==='ILS'){ const u = Math.round(ils/state.rates.USDILS); usd = u; eur = Math.round(u*state.rates.USDEUR); }
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
  const live = await fetchRatesOnce();
  const lockedRates = { USDILS: live.USDILS, USDEUR: live.USDEUR, lockedAt: live.lockedAt };
  if (live.USDLocal) lockedRates.USDLocal = live.USDLocal;
  await FB.updateDoc(ref, { budget, rates: lockedRates, budgetLocked: locking });
  ['bUSD','bEUR','bILS'].forEach(id=> $('#'+id).disabled = locking);
  btn.classList.toggle('locked', locking);
  btn.textContent = locking ? 'ביטול נעילה' : 'קבע תקציב';
  showToast(locking ? 'התקציב נקבע' : 'התקציב פתוח לעריכה');
});
// Expenses CRUD
$('#btnAddExpense').addEventListener('click', ()=> openExpenseModal());
$('#expCancel').addEventListener('click', ()=> $('#expenseModal').close());
$('#expSave').addEventListener('click', saveExpense);

function openExpenseModal(e){
  seedExpenseCategories();
  const curSelect = $('#expCurr');
  curSelect.innerHTML = '';
  const currencies = ['USD', 'EUR', 'ILS'];
  const localCur = state.current?.localCurrency;
  if(localCur && !currencies.includes(localCur)){
      currencies.unshift(localCur);
  }
  currencies.forEach(c=>{
    const opt = document.createElement('option');
    opt.value = opt.textContent = c;
    curSelect.appendChild(opt);
  });

  $('#expenseModal').dataset.id = e?.id||'';
  $('#expDesc').value = e?.desc||''; $('#expCat').value = e?.category||''; $('#expAmount').value = e?.amount||'';
  $('#expCurr').value = e?.currency||'USD';
  $('#expLat').value = e?.lat||''; $('#expLng').value = e?.lng||'';
  $('#expDelete').style.display = e? 'inline-block':'none';
  $('#expenseModal').showModal();
}
async function saveExpense(){
  const ref  = FB.doc(db,'trips', state.currentTripId);
  const snap = await FB.getDoc(ref);
  const t    = snap.exists() ? (snap.data()||{}) : {};

  // Lock fresh rates at input-time
  const live = await fetchRatesOnce();
  const currentExpense = t.expenses?.[$('#expenseModal').dataset.id] || {};
  
  // if rates don't exist, set them. otherwise, keep them.
  const expenseRates = currentExpense.rates || { USDILS: live.USDILS, USDEUR: live.USDEUR, lockedAt: live.lockedAt };
  if(live.USDLocal) expenseRates.USDLocal = live.USDLocal;
  
  const id = $('#expenseModal').dataset.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  t.expenses = t.expenses || {};
  t.expenses[id] = {
    desc: $('#expDesc').value.trim(),
    category: $('#expCat').value.trim(),
    amount: Number($('#expAmount').value||0),
    currency: $('#expCurr').value,
    lat: numOrNull($('#expLat').value),
    lng: numOrNull($('#expLng').value),
    createdAt: (t.expenses[id] && t.expenses[id].createdAt) ? t.expenses[id].createdAt : new Date().toISOString(),
    rates: expenseRates // save the specific rates for this expense
  };

  await FB.updateDoc(ref, { expenses: t.expenses, rates: t.rates });
  $('#expenseModal').close();
  showToast('ההוצאה נשמרה (שער ננעל לרגע ההזנה)');
  await loadTrip();
}
$('#lsSignUp').addEventListener('click', async ()=>{
  try{
    await FB.createUserWithEmailAndPassword(auth, $('#lsEmail').value.trim(), $('#lsPass').value);
    $('#lsError').textContent = '';
  }catch(e){ $('#lsError').textContent = xErr(e); }
});
$('#lsReset').addEventListener('click', async ()=>{

// Safe HTML escape

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
  const dst = (t.destination||''); if(dst.toLowerCase().includes(s)){ score+=5; where.push({label:`<span class="match-source">יעד:</span> ${snippet(dst,s)}`, type:'meta', itemId:null}); }
  const types = (Array.isArray(t.types)? t.types.join(', '): (t.types||'')); if(types.toLowerCase().includes(s)){ score+=2; where.push({label:`<span class="match-source">סוגים:</span> ${snippet(types,s)}`, type:'meta', itemId:null}); }
  const people = (Array.isArray(t.people)? t.people.join(', '): (t.people||'')); if(people.toLowerCase().includes(s)){ score+=1; where.push({label:`<span class="match-source">משתתפים:</span> ${snippet(people,s)}`, type:'meta', itemId:null}); }
  const ex = Object.entries(t.expenses||{}); let exHits = 0; ex.forEach(([id, e])=>{ if((e.desc||'').toLowerCase().includes(s) || (e.category||'').toLowerCase().includes(s)){ exHits++; where.push({label:`<span class="match-source">הוצאות:</span> ${snippet(e.desc||e.category||'', s)}`, type:'expense', itemId:id});} });
  if(exHits) score += Math.min(3, exHits);
  const jr = Object.entries(t.journal||{}); let jrHits = 0; jr.forEach(([id, j])=>{ if((j.text||'').toLowerCase().includes(s) || (j.placeName||'').toLowerCase().includes(s)){ jrHits++; where.push({label:`<span class="match-source">יומן:</span> ${snippet(j.text||j.placeName||'', s)}`, type:'journal', itemId:id});} });
  if(jrHits) score += Math.min(3, jrHits);
  return { hit: score>0, score, where };
}
// Add the new function to highlight and scroll to the element
function highlightAndScroll(element, s){
  if(!element) return;
  const text = element.innerHTML;
  element.innerHTML = text.replace(new RegExp(`(${s})`, 'gi'), '<mark>$1</mark>');
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function searchAndNavigate(tripId, query, type, itemId){
  openTrip(tripId).then(()=>{
    if(type === 'expense'){
      document.querySelector('#tabs button[data-tab="expenses"]').click();
      setTimeout(()=>{
        const el = document.querySelector(`#tblExpenses tr[data-id="${itemId}"]`);
        if(el) highlightAndScroll(el, query);
      }, 300);
    } else if(type === 'journal'){
      document.querySelector('#tabs button[data-tab="journal"]').click();
      setTimeout(()=>{
        const el = document.querySelector(`#tblJournal tr[data-id="${itemId}"]`);
        if(el) highlightAndScroll(el, query);
      }, 300);
    } else if (type === 'meta') {
      document.querySelector('#tabs button[data-tab="meta"]').click();
      setTimeout(()=>{
        const el = document.querySelector('#view-meta .dest-col');
        if(el) highlightAndScroll(el, query);
      }, 300);
    }
  });
}

// Global modal state for row actions
let _rowActionExpense = null;
let _rowActionJournal = null;
let _rowActionTrip = null; // New global state for trip actions
(() => {
  const modal = document.getElementById('rowMenuModal');
  if (!modal) return;
  const btnEdit = document.getElementById('rowMenuEdit');
  const btnDel = document.getElementById('rowMenuDelete');
  const btnCancel = document.getElementById('rowMenuCancel');

  if (btnEdit) btnEdit.addEventListener('click', ()=>{
    if (_rowActionExpense) { openExpenseModal(_rowActionExpense); }
    else if (_rowActionJournal) { openJournalModal(_rowActionJournal); }
    else if (_rowActionTrip) { openTrip(_rowActionTrip.id); } // Open trip on edit
    modal.close(); _rowActionExpense = _rowActionJournal = _rowActionTrip = null;
  });

  if (btnDel) btnDel.addEventListener('click', ()=>{
    if (_rowActionExpense) {
      showConfirm('האם אתה בטוח שברצונך למחוק הוצאה זו?', () => deleteExpense(_rowActionExpense.id));
    }
    else if (_rowActionJournal) {
      showConfirm('האם אתה בטוח שברצונך למחוק רישום זה?', () => deleteJournal(_rowActionJournal.id));
    }
    else if (_rowActionTrip) {
      showConfirm('האם אתה בטוח שברצונך למחוק טיול זה? פעולה זו אינה הפיכה.', () => deleteTrip(_rowActionTrip.id));
    }
    modal.close(); _rowActionExpense = _rowActionJournal = _rowActionTrip = null;
  });

  if (btnCancel) btnCancel.addEventListener('click', ()=>{
    modal.close(); _rowActionExpense = _rowActionJournal = _rowActionTrip = null;
  });
})();

/* ---------- Confirm Modal (generic) ---------- */
function showConfirm(msg, onYes){
  const m = document.getElementById('confirmDeleteModal');
  if(!m){ if(onYes) onYes(); return; }
  const body = m.querySelector('.body p') || m.querySelector('.body');
  if(body) body.textContent = msg || 'לאשר?';
  m.showModal();
  m._yesHandler = ()=>{
    try{ onYes && onYes(); } finally { m.close(); }
  };
}
(function bindConfirmButtons(){
  const m = document.getElementById('confirmDeleteModal');
  if(!m) return;
  const yes = document.getElementById('confirmDeleteYes');
  const no  = document.getElementById('confirmDeleteNo');
  if(yes) yes.onclick = ()=>{ m._yesHandler ? m._yesHandler() : m.close(); };
  if(no)  no.onclick  = ()=> m.close();
})();

// New delete trip function
async function deleteTrip(id) {
  if (!id) return;
  const ref = FB.doc(db, 'trips', id);
  await FB.deleteDoc(ref);
  showToast('הטיול נמחק בהצלחה');
  enterHomeMode();
}

function handleGlobalDeleteClicks(e){
  const el = e.target.closest && e.target.closest('[data-confirm="delete-expense"]');
  if(!el) return;
  e.preventDefault();
  const expId = document.getElementById('expenseModal')?.dataset?.id;
  if(!expId) return;
  showConfirm('לאשר מחיקה?', async ()=>{
    try{
      const tid = state.currentTripId;
      if(!tid) return;
      const ref = FB.doc(db,'trips', tid);
      const snap = await FB.getDoc(ref);
      const t = snap.data() || {};
      if(t.expenses && t.expenses[expId]){
        delete t.expenses[expId];
        await FB.updateDoc(ref, { expenses: t.expenses });
      }
    }catch(err){ alert(typeof xErr==='function' ? xErr(err) : (err?.message||err)); }
    finally{
      document.getElementById('expenseModal')?.close();
      document.getElementById('confirmDeleteModal')?.close();
      if(state.currentTripId) openTrip(state.currentTripId);
    }
  });
}
document.addEventListener('click', handleGlobalDeleteClicks);

// Added a separate delete function for expenses
async function deleteExpense(id){
  const tid = state.currentTripId;
  if(!tid || !id) return;
  const ref = FB.doc(db,'trips', tid);
  const snap = await FB.getDoc(ref);
  const t = snap.data() || {};
  if(t.expenses && t.expenses[id]){
    delete t.expenses[id];
    await FB.updateDoc(ref, { expenses: t.expenses });
    showToast('הוצאה נמחקה');
    await loadTrip();
  }
}

// Added a new delete function for journal entries
async function deleteJournal(id){
  const tid = state.currentTripId;
  if(!tid || !id) return;
  const ref = FB.doc(db,'trips', tid);
  const snap = await FB.getDoc(ref);
  const t = snap.data() || {};
  if(t.journal && t.journal[id]){
    delete t.journal[id];
    await FB.updateDoc(ref, { journal: t.journal });
    showToast('רישום יומן נמחק');
    await loadTrip();
  }
}

function handleGlobalCurrencyClick(e){
  const btn = e.target.closest && e.target.closest('#barCurrency');
  if(!btn) return;
  const t = state.current;
  if(!t) return;
  let cur = getActiveCurrencyFromTrip(t);
  cur = cycleCurrency(cur);
  setActiveCurrency(cur);
  try{
    const ref = FB.doc(db,'trips', t.id || state.currentTripId);
    FB.updateDoc(ref, { baseCurrency: cur }).catch(()=>{});
    t.baseCurrency = cur;
  }catch(_){}
  try{ renderExpenseSummary(t); }catch(_){}
}
document.addEventListener('click', handleGlobalCurrencyClick);


function handleBarSort(e){
  const btn = e.target.closest && e.target.closest('#barSort');
  if(!btn) return;
  e.preventDefault();
  // Toggle state sort order
  toggleExpenseSort();
}
document.addEventListener('click', handleBarSort);


const EXPENSE_CATEGORIES = ['טיסה','לינה','תקשורת','רכב','ביטוח בריאות','מזון - מסעדות / סופר','קניות','אטרקציות','אחר'];
function seedExpenseCategories(){
  const sel = document.getElementById('expCat');
  if(!sel) return;
  if(sel.options && sel.options.length>0) return;
  EXPENSE_CATEGORIES.forEach(lbl=>{
    const opt = document.createElement('option'); opt.value = lbl; opt.textContent = lbl; sel.appendChild(opt);
  });
}


// === UI: add small rate note under amount cells (vs ILS) ===
function getRateToILS(cur, rates){
  const M = rateMatrix(rates || state.rates);
  return (M[cur] && M[cur].ILS) ? M[cur].ILS : 1;
}
function applyRateNotes(){
  const tbls = ['#tblExpenses', '#tblRecentExpenses'];
  tbls.forEach(sel=>{
    const body = document.querySelector(sel);
    if(!body) return;
    Array.from(body.querySelectorAll('tr')).forEach(tr=>{
      const tds = tr.querySelectorAll('td');
      if(tds.length < 5) return;
      const amountTd = tds[3]; // menu, desc, category, amount, currency, date
      const currencyTd = tds[4];
      const cur = (currencyTd?.textContent || '').trim();
      const amount = Number(amountTd.firstChild.nodeValue || 0); // Get the number from the cell
      if(!cur) return;
      if(amountTd.querySelector('.rate-note')) return;
      const rateToILS = getRateToILS(cur, state.rates);
      const convertedAmountILS = amount * rateToILS;
      const note = document.createElement('div');
      note.className = 'rate-note';
      note.textContent = `₪${convertedAmountILS.toFixed(2)}`; // Display the converted amount in ILS
      amountTd.appendChild(note);
    });
  });
}
// Observe changes and apply automatically
(function(){
  const target = document.body;
  if(!target) return;
  const obs = new MutationObserver(()=> applyRateNotes());
  obs.observe(target, { childList:true, subtree:true });
  // also run once on load
  window.addEventListener('DOMContentLoaded', applyRateNotes);
  setTimeout(applyRateNotes, 300);
})();
// === End UI rate note ===


// New Map Selection Functionality

// Common function to get current location
function getCurrentLocation(callback) {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        callback(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        showToast('שגיאה בקבלת מיקום: ' + error.message);
      }
    );
  } else {
    showToast('הדפדפן אינו תומך ב-Geolocation.');
  }
}

// Common function for searching a location name
async function searchLocationByName(name, callback, isHebrew) {
  const lang = isHebrew ? 'he' : 'en';
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${name}&format=json&accept-language=${lang}&limit=1`);
    const data = await res.json();
    if (data.length > 0) {
      callback(Number(data[0].lat), Number(data[0].lon), data[0].display_name);
    } else {
      showToast('לא נמצא מיקום עבור השם הזה.');
    }
  } catch (e) {
    showToast('שגיאה בחיפוש מיקום: ' + e.message);
  }
}

// Map modal functionality for both expenses and journal
function openMapSelectModal(lat, lng) {
  const modal = $('#mapSelectModal');
  modal.showModal();
  state.maps.select = L.map('selectMap').setView([lat || 32.0853, lng || 34.7818], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(state.maps.select);
  state.maps.select.invalidateSize();

  if (lat && lng) {
    state.maps.selectMarker = L.marker([lat, lng]).addTo(state.maps.select);
  } else {
    state.maps.selectMarker = L.marker(state.maps.select.getCenter()).addTo(state.maps.select);
  }

  state.maps.select.on('click', (e) => {
    if (state.maps.selectMarker) {
      state.maps.selectMarker.setLatLng(e.latlng);
    } else {
      state.maps.selectMarker = L.marker(e.latlng).addTo(state.maps.select);
    }
  });
}

// Save location from map modal
$('#selectMapSave').addEventListener('click', async () => {
  if (state.maps.selectMarker) {
    const { lat, lng } = state.maps.selectMarker.getLatLng();
    if (state.maps.currentModal === 'expense') {
      $('#expLat').value = lat;
      $('#expLng').value = lng;
      try{
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=he`);
        const data = await res.json();
        const displayName = data.address.country === 'ישראל' ? data.display_name : data.display_name_en || data.display_name;
        $('#expLocationName').value = displayName;
      }catch(e){
        $('#expLocationName').value = '';
      }
    } else if (state.maps.currentModal === 'journal') {
      $('#jrLat').value = lat;
      $('#jrLng').value = lng;
      try{
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=he`);
        const data = await res.json();
        const displayName = data.address.country === 'ישראל' ? data.display_name : data.display_name_en || data.display_name;
        $('#jrLocationName').value = displayName;
      }catch(e){
        $('#jrLocationName').value = '';
      }
    }
  }
  $('#mapSelectModal').close();
  state.maps.select.remove();
  state.maps.select = null;
});

// Cancel map selection
$('#selectMapCancel').addEventListener('click', () => {
  $('#mapSelectModal').close();
  state.maps.select.remove();
  state.maps.select = null;
});

// Expense modal location actions
$('#btnUseCurrentExp').addEventListener('click', () => {
  getCurrentLocation((lat, lng) => {
    $('#expLat').value = lat;
    $('#expLng').value = lng;
    showToast('המיקום הנוכחי נבחר.');
  });
});

$('#expLocationName').addEventListener('input', (e) => {
  const name = e.target.value.trim();
  if (name.length > 2) {
    const isHebrew = state.current?.destination === 'ישראל';
    searchLocationByName(name, (lat, lng, displayName) => {
      $('#expLat').value = lat;
      $('#expLng').value = lng;
      e.target.value = displayName;
    }, isHebrew);
  }
});

$('#btnSelectExpLocation').addEventListener('click', () => {
  state.maps.currentModal = 'expense';
  openMapSelectModal(numOrNull($('#expLat').value), numOrNull($('#expLng').value));
});


// Journal modal location actions
$('#btnAddJournal').addEventListener('click', ()=> openJournalModal());
$('#jrCancel').addEventListener('click', ()=> $('#journalModal').close());
$('#jrSave').addEventListener('click', saveJournal);

function openJournalModal(j) {
  $('#journalModal').dataset.id = j?.id || '';
  $('#jrText').value = j?.text || '';
  $('#jrLocationName').value = j?.placeName || '';
  $('#jrLat').value = j?.lat || '';
  $('#jrLng').value = j?.lng || '';
  $('#jrDelete').style.display = j ? 'inline-block' : 'none';
  $('#journalModal').showModal();
}

async function saveJournal() {
  const ref = FB.doc(db, 'trips', state.currentTripId);
  const snap = await FB.getDoc(ref);
  const t = snap.exists() ? (snap.data() || {}) : {};

  const id = $('#journalModal').dataset.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  t.journal = t.journal || {};
  t.journal[id] = {
    text: $('#jrText').value.trim(),
    placeName: $('#jrLocationName').value.trim(),
    lat: numOrNull($('#jrLat').value),
    lng: numOrNull($('#jrLng').value),
    createdAt: (t.journal[id] && t.journal[id].createdAt) ? t.journal[id].createdAt : new Date().toISOString()
  };

  await FB.updateDoc(ref, { journal: t.journal });
  $('#journalModal').close();
  showToast('רישום יומן נשמר');
  await loadTrip();
}


$('#btnUseCurrentJr').addEventListener('click', () => {
  getCurrentLocation((lat, lng) => {
    $('#jrLat').value = lat;
    $('#jrLng').value = lng;
    showToast('המיקום הנוכחי נבחר.');
  });
});

$('#jrLocationName').addEventListener('input', (e) => {
  const name = e.target.value.trim();
  if (name.length > 2) {
    const isHebrew = state.current?.destination === 'ישראל';
    searchLocationByName(name, (lat, lng, displayName) => {
      $('#jrLat').value = lat;
      $('#jrLng').value = lng;
      e.target.value = displayName;
    }, isHebrew);
  }
});

$('#btnSelectJrLocation').addEventListener('click', () => {
  state.maps.currentModal = 'journal';
  openMapSelectModal(numOrNull($('#jrLat').value), numOrNull($('#jrLng').value));
});

// Expense modal location actions
// These were already defined, just re-ordering for clarity
$('#btnUseCurrentExp').addEventListener('click', () => {
  getCurrentLocation((lat, lng) => {
    $('#expLat').value = lat;
    $('#expLng').value = lng;
    showToast('המיקום הנוכחי נבחר.');
  });
});

$('#btnSelectExpLocation').addEventListener('click', () => {
  state.maps.currentModal = 'expense';
  openMapSelectModal(numOrNull($('#expLat').value), numOrNull($('#expLng').value));
});




function toggleExpenseSort(){
  state.expenseSort = (state.expenseSort === 'asc') ? 'desc' : 'asc';
  if (state.current) {
    renderExpenses(state.current, state.expenseSort);
    // Recompute summary to keep numbers consistent (and to keep the bar wired)
    try{ renderExpenseSummary(state.current); }catch(_){}
  }
}

// -- Sort buttons wiring --
(() => {
  const btnExp = document.querySelector('#btnSortExpenses');
  if (btnExp && !btnExp.dataset.wired) {
    btnExp.dataset.wired = '1';
    btnExp.addEventListener('click', () => {
      toggleExpenseSort();
    });
  }
  const btnJour = document.querySelector('#btnSortJournal');
  if (btnJour && !btnJour.dataset.wired) {
    btnJour.dataset.wired = '1';
    btnJour.addEventListener('click', () => {
      state.journalSort = (state.journalSort === 'asc') ? 'desc' : 'asc';
      if (state.current) renderJournal(state.current, state.journalSort);
    });
  }
})();



// Delegated click handler as a safety net (in case the direct wiring is skipped)
document.addEventListener('click', (ev) => {
  const el = ev.target;
  if (!el) return;
  if (el.id === 'btnSortExpenses') {
    try { toggleExpenseSort(); } catch(e) { console.error('toggleExpenseSort failed', e); }
  }
});



// ===== Mobile Action Sheet toggles =====
document.addEventListener('click', (e) => {
  const openBtn = e.target.closest('[data-open-sheet]');
  const closeBtn = e.target.closest('[data-close-sheet]');
  const backdrop = document.querySelector('.action-sheet-backdrop');
  const sheet = document.querySelector('.action-sheet');

  if (openBtn && sheet && backdrop){
    sheet.classList.add('open'); backdrop.classList.add('open');
  }
  if ((closeBtn || (e.target === backdrop)) && sheet && backdrop){
    sheet.classList.remove('open'); backdrop.classList.remove('open');
  }
});


// ===== MOBILE UX ENHANCEMENTS V2 (≤430px) =====
(function(){
  const isMobile = window.matchMedia && window.matchMedia("(max-width: 430px)").matches;
  if (!isMobile) return;

  // 1) Force LIST view (hide gallery)
  const ensureListView = () => {
    const btns = Array.from(document.querySelectorAll('button, .btn'));
    const listBtn = btns.find(b => /רשימה/.test(b.textContent || ""));
    const galBtn  = btns.find(b => /גלריה/.test(b.textContent || ""));
    if (listBtn && !/active/.test(listBtn.className)) listBtn.click();
    if (galBtn) galBtn.closest?.('.list-actions, .tabs, .chips')?.classList?.add('hide-gallery-toggle');
    if (galBtn) galBtn.style.display = 'none';
  };
  window.addEventListener('load', ensureListView);
  document.addEventListener('DOMContentLoaded', ensureListView);
  setTimeout(ensureListView, 800);

  // 2) Create a compact mobile topbar with icons (menu grid, sort, theme, logout)
  const header = document.querySelector('header') || document.body;
  const bar = document.createElement('div');
  bar.className = 'mobile-topbar';

  const svg = {
    grid:  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 8v-8h8v8h-8z" fill="currentColor"/></svg>',
    sort:  '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M7 6h14v2H7V6zm0 5h10v2H7v-2zm0 5h6v2H7v-2zM3 5v14l4-3.5L3 12l4-3.5L3 5z" fill="currentColor"/></svg>',
    theme: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 3a9 9 0 0 0 0 18 9 9 0 0 0 8.25-5.25A7 7 0 0 1 12 5a7 7 0 0 1 6.22-3.94A9 9 0 0 0 12 3z" fill="currentColor"/></svg>',
    logout:'<svg viewBox="0 0 24 24" width="22" height="22"><path d="M10 17l1.41-1.41L9.83 14H16v-2H9.83l1.58-1.59L10 9l-4 4 4 4zM20 19H12v2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-8v2h8v14z" fill="currentColor"/></svg>'
  };

  function btn(icon, label, onClick){
    const b = document.createElement('button');
    b.className = 'icon-btn';
    b.innerHTML = icon;
    b.setAttribute('aria-label', label);
    b.title = label;
    b.addEventListener('click', onClick);
    return b;
  }

  // Action Sheet structure (menu)
  const backdrop = document.createElement('div'); backdrop.className = 'action-sheet-backdrop';
  const sheet = document.createElement('div'); sheet.className = 'action-sheet';
  sheet.innerHTML = `
    <div class="handle"></div>
    <div class="menu">
      <button class="item" data-section="all">הצג הכל</button>
      <button class="item" data-section="trip">נתוני נסיעה</button>
      <button class="item" data-section="expense">הוצאות</button>
      <button class="item" data-section="journal">יומן יומי</button>
      <button class="item" data-section="map">מפה</button>
      <button class="item" data-close-sheet>ביטול</button>
    </div>`;
  document.body.append(backdrop, sheet);

  const openSheet = () => { sheet.classList.add('open'); backdrop.classList.add('open'); };
  const closeSheet = () => { sheet.classList.remove('open'); backdrop.classList.remove('open'); };

  backdrop.addEventListener('click', closeSheet);
  sheet.addEventListener('click', (e)=>{
    if (e.target.matches('[data-close-sheet]')) closeSheet();
    const sec = e.target.getAttribute('data-section');
    if (sec){
      // Try to find matching tab by text content and click it
      const map = {
        all:/הצג הכל|סקירה כללית/,
        trip:/נתוני נסיעה/,
        expense:/הוצאות/,
        journal:/יומן/,
        map:/מפה/
      };
      const r = map[sec];
      const btn = Array.from(document.querySelectorAll('button,.btn,.tab')).find(b => r.test(b.textContent||""));
      if (btn) btn.click();
      closeSheet();
    }
  });

  // Build the topbar buttons
  const menuBtn = btn(svg.grid, 'תפריטים', openSheet);
  const sortBtn = btn(svg.sort, 'מיין לפי תאריך יציאה', ()=>{
    document.dispatchEvent(new CustomEvent('mobile-sort-toggle'));
    // נסה ללחוץ על כפתור מיון אם קיים
    const sortIcon = Array.from(document.querySelectorAll('button,.btn,[role="button"]')).find(b => /מיין|תאריך יציאה|יציאה/.test(b.textContent||""));
    if (sortIcon) sortIcon.click();
  });
  const themeBtn = btn(svg.theme, 'מצב כהה/בהיר', ()=>{
    const tgl = Array.from(document.querySelectorAll('button,.btn')).find(b => /מצב כהה|מצב בהיר/.test(b.textContent||""));
    if (tgl) tgl.click(); else document.documentElement.toggleAttribute('data-theme', 'light');
  });
  const logoutBtn = btn(svg.logout, 'התנתקות', ()=>{
    try{ window.signOutUser && window.signOutUser(); }catch(e){}
    // fallback: נסה למצוא כפתור התנתקות קיים
    const out = Array.from(document.querySelectorAll('button,.btn')).find(b => /התנתקות|יציאה/.test(b.textContent||""));
    if (out) out.click();
  });

  bar.append(menuBtn, sortBtn, themeBtn, logoutBtn);
  header.appendChild(bar);

  // 3) Replace textual buttons for theme/logout with icons (save space)
  const makeIconOnly = () => {
    Array.from(document.querySelectorAll('button,.btn')).forEach(b => {
      const txt = (b.textContent||"").trim();
      if (/התנתקות/.test(txt)){ b.innerHTML = svg.logout; b.classList.add('icon-btn'); b.setAttribute('aria-label','התנתקות') }
      if (/מצב כהה|מצב בהיר/.test(txt)){ b.innerHTML = svg.theme; b.classList.add('icon-btn'); b.setAttribute('aria-label','מצב כהה/בהיר') }
    });
  };
  setTimeout(makeIconOnly, 300);

})();


// ===== Convert textual 'sort by departure' button to icon-only on mobile =====
(function(){
  const isMobile = window.matchMedia && window.matchMedia("(max-width: 430px)").matches;
  if (!isMobile) return;
  function iconizeSortButtons(){
    const candidates = Array.from(document.querySelectorAll('button,.btn,[role="button"]'))
      .filter(b => /(מיין|תאריך יציאה|יציאה)/.test((b.textContent||'').trim()));
    candidates.forEach(b => {
      if (!b.classList.contains('icon-btn')) {
        b.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M7 6h14v2H7V6zm0 5h10v2H7v-2zm0 5h6v2H7v-2zM3 5v14l4-3.5L3 12l4-3.5L3 5z" fill="currentColor"/></svg>`;
        b.classList.add('icon-btn');
        b.setAttribute('aria-label','מיין לפי תאריך יציאה');
        b.title = 'מיין לפי תאריך יציאה';
      }
    });
  }
  window.addEventListener('load', iconizeSortButtons);
  document.addEventListener('DOMContentLoaded', iconizeSortButtons);
  setTimeout(iconizeSortButtons, 600);
})();


// ===== MOBILE TOPBAR REFINEMENT (idempotent, ≤430px) =====
(function(){
  const isMobile = window.matchMedia && window.matchMedia("(max-width: 430px)").matches;
  if (!isMobile) return;

  // Avoid duplicates if script evaluated twice
  if (document.querySelector('.mobile-topbar')) return;

  // Force list view + hide gallery toggle
  (function ensureList(){
    const listBtn = Array.from(document.querySelectorAll('button,.btn')).find(b => /רשימה/.test(b.textContent||""));
    const galBtn  = Array.from(document.querySelectorAll('button,.btn')).find(b => /גלריה/.test(b.textContent||""));
    if (listBtn && !/active/.test(listBtn.className)) listBtn.click();
    if (galBtn){ galBtn.style.display='none'; galBtn.closest?.('.list-actions,.tabs,.chips')?.classList?.add('hide-gallery-toggle'); }
  })();

  // Build compact icon bar
  const svg = {
    grid:'<svg viewBox="0 0 24 24" width="20" height="20"><path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 8v-8h8v8h-8z" fill="currentColor"/></svg>',
    sort:'<svg viewBox="0 0 24 24" width="20" height="20"><path d="M7 6h14v2H7V6zm0 5h10v2H7v-2zm0 5h6v2H7v-2zM3 5v14l4-3.5L3 12l4-3.5L3 5z" fill="currentColor"/></svg>',
    theme:'<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 3a9 9 0 0 0 0 18 9 9 0 0 0 8.25-5.25A7 7 0 0 1 12 5a7 7 0 0 1 6.22-3.94A9 9 0 0 0 12 3z" fill="currentColor"/></svg>',
    logout:'<svg viewBox="0 0 24 24" width="20" height="20"><path d="M10 17l1.41-1.41L9.83 14H16v-2H9.83l1.58-1.59L10 9l-4 4 4 4zM20 19H12v2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-8v2h8v14z" fill="currentColor"/></svg>'
  };
  function icon(label, svgStr, onClick){
    const b = document.createElement('button');
    b.className='icon-btn';
    b.setAttribute('aria-label',label);
    b.title=label;
    b.innerHTML=svgStr;
    b.addEventListener('click', onClick);
    return b;
  }

  // Action sheet
  let backdrop = document.querySelector('.action-sheet-backdrop');
  let sheet = document.querySelector('.action-sheet');
  if (!backdrop){ backdrop = document.createElement('div'); backdrop.className='action-sheet-backdrop'; document.body.append(backdrop); }
  if (!sheet){
    sheet = document.createElement('div');
    sheet.className='action-sheet';
    sheet.innerHTML = `
      <div class="handle"></div>
      <div class="menu">
        <button class="item" data-section="all">הצג הכל</button>
        <button class="item" data-section="trip">נתוני נסיעה</button>
        <button class="item" data-section="expense">הוצאות</button>
        <button class="item" data-section="journal">יומן יומי</button>
        <button class="item" data-section="map">מפה</button>
        <button class="item" data-close-sheet>סגור</button>
      </div>`;
    document.body.append(sheet);
  }
  const openSheet = ()=>{ sheet.classList.add('open'); backdrop.classList.add('open'); };
  const closeSheet = ()=>{ sheet.classList.remove('open'); backdrop.classList.remove('open'); };
  backdrop.onclick = closeSheet;
  sheet.addEventListener('click', (e)=>{ if (e.target.matches('[data-close-sheet]')) closeSheet();
    const sec = e.target.getAttribute('data-section');
    if (!sec) return;
    const map = { all:/הצג הכל|סקירה כללית/, trip:/נתוני נסיעה/, expense:/הוצאות/, journal:/יומן/, map:/מפה/ };
    const btn = Array.from(document.querySelectorAll('button,.btn,.tab')).find(b => map[sec].test(b.textContent||""));
    if (btn) btn.click();
    closeSheet();
  });

  // Click proxies
  const sortProxy = ()=>{
    const sort = Array.from(document.querySelectorAll('button,.btn,[role="button"]')).find(b => /(מיין|תאריך יציאה|יציאה)/.test((b.textContent||"")));
    if (sort) sort.click();
  };
  const themeProxy = ()=>{
    const tgl = Array.from(document.querySelectorAll('button,.btn')).find(b => /מצב כהה|מצב בהיר/.test((b.textContent||"")));
    if (tgl) tgl.click();
  };
  const logoutProxy = ()=>{
    const out = Array.from(document.querySelectorAll('button,.btn')).find(b => /התנתקות|יציאה/.test((b.textContent||"")));
    if (out) out.click();
  };

  // Assemble bar and insert below header
  const bar = document.createElement('div');
  bar.className='mobile-topbar';
  bar.append(
    icon('תפריטים', svg.grid, openSheet),
    icon('מיין לפי תאריך יציאה', svg.sort, sortProxy),
    icon('מצב כהה/בהיר', svg.theme, themeProxy),
    icon('התנתקות', svg.logout, logoutProxy),
  );

  const header = document.querySelector('header');
  (header || document.body).after(bar);

  // Hide verbose originals in mobile to avoid duplication
  Array.from(document.querySelectorAll('button,.btn')).forEach(b => {
    const t = (b.textContent||'').trim();
    if (/התנתקות|מצב כהה|מצב בהיר|גלריה/.test(t)) b.style.display='none';
  });

  // Hide decorative vertical email/logo pills if they overflow
  Array.from(document.querySelectorAll('.vertical-pill,.email-vertical,.brand-vertical')).forEach(el => el.style.display='none');
})();


// ===== Build two-row mobile toolbar (email chip + icons), idempotent, ≤430px =====
(function(){
  const isMobile = window.matchMedia && window.matchMedia("(max-width: 430px)").matches;
  if (!isMobile) return;
  if (document.querySelector(".mobile-toolbar")) return;

  // Utilities
  const qAll = sel => Array.from(document.querySelectorAll(sel));
  const clickByText = (rx) => qAll("button,.btn,[role='button']").find(b => rx.test((b.textContent||"").trim()))?.click();

  // Email
  const email = (window.currentUserEmail || qAll(".user-email,.email-chip,.chip").map(n=>n.textContent).find(t=>/@/.test(t||"")) || "").trim() || "התחבר";

  // SVG icons (simple, lightweight)
  const I = {
    logout:'<svg viewBox="0 0 24 24" width="20" height="20"><path d="M10 17l1.41-1.41L9.83 14H16v-2H9.83l1.58-1.59L10 9l-4 4 4 4zM20 19H12v2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-8v2h8v14z" fill="currentColor"/></svg>',
    theme:'<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 3a9 9 0 0 0 0 18 9 9 0 0 0 8.25-5.25A7 7 0 0 1 12 5a7 7 0 0 1 6.22-3.94A9 9 0 0 0 12 3z" fill="currentColor"/></svg>',
    grid:'<svg viewBox="0 0 24 24" width="20" height="20"><path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 8v-8h8v8h-8z" fill="currentColor"/></svg>',
    sort:'<svg viewBox="0 0 24 24" width="20" height="20"><path d="M7 6h14v2H7V6zm0 5h10v2H7v-2zm0 5h6v2H7v-2zM3 5v14l4-3.5L3 12l4-3.5L3 5z" fill="currentColor"/></svg>'
  };

  const iconBtn = (svg, label, handler) => {
    const b = document.createElement("button");
    b.className = "icon-btn";
    b.innerHTML = svg;
    b.setAttribute("aria-label", label);
    b.title = label;
    b.addEventListener("click", handler);
    return b;
  };

  // Toolbar DOM
  const toolbar = document.createElement("div");
  toolbar.className = "mobile-toolbar";
  toolbar.innerHTML = `
    <div class="topline">
      <div class="email-chip" title="החשבון שלך">${email}</div>
      <div class="actions"></div>
    </div>
    <div class="menugrid"></div>
  `;

  // Attach after header
  (document.querySelector("header") || document.body).after(toolbar);

  // Actions row
  const actions = toolbar.querySelector(".actions");
  actions.append(
    iconBtn(I.logout, "התנתקות/התחברות", () => clickByText(/התנתקות|התחברות|יציאה/)),
    iconBtn(I.theme, "מצב כהה/בהיר", () => clickByText(/מצב כהה|מצב בהיר/))
  );

  // Menu row
  const menu = toolbar.querySelector(".menugrid");
  // Menu opens the existing Action Sheet if present; else tries to click any "תפריט/עוד"
  const openMenu = () => {
    const backdrop = document.querySelector(".action-sheet-backdrop");
    const sheet = document.querySelector(".action-sheet");
    if (sheet && backdrop){ sheet.classList.add("open"); backdrop.classList.add("open"); return; }
    clickByText(/תפריט|עוד/);
  };
  const sortClick = () => clickByText(/מיין|תאריך יציאה|יציאה/);
  menu.append(
    iconBtn(I.grid, "תפריטים", openMenu),
    iconBtn(I.sort, "מיין לפי תאריך יציאה", sortClick)
  );

  // Mobile: force list, hide gallery toggle
  const listBtn = qAll("button,.btn").find(b => /רשימה/.test(b.textContent||""));
  if (listBtn && !/active/.test(listBtn.className)) listBtn.click();
  const galBtn  = qAll("button,.btn").find(b => /גלריה/.test(b.textContent||""));
  if (galBtn){ galBtn.style.display = "none"; galBtn.closest?.(".list-actions,.tabs,.chips")?.classList?.add("hide-gallery-toggle"); }

  // Hide verbose originals in mobile to avoid duplication
  qAll("button,.btn").forEach(b => {
    const t = (b.textContent||"").trim();
    if (/התנתקות|מצב כהה|מצב בהיר|גלריה/.test(t)) b.style.display="none";
  });
})();


// ===== Mobile toolbar: add Search and full-screen overlay (≤430px) =====
(function(){
  const isMobile = window.matchMedia && window.matchMedia("(max-width: 430px)").matches;
  if (!isMobile) return;

  // If our two-row toolbar exists, add a Search icon to the actions row
  const toolbar = document.querySelector('.mobile-toolbar');
  if (toolbar && !toolbar.querySelector('#btn-search')){
    const actions = toolbar.querySelector('.actions');
    const searchBtn = document.createElement('button');
    searchBtn.className = 'icon-btn';
    searchBtn.id = 'btn-search';
    searchBtn.setAttribute('aria-label','חיפוש');
    searchBtn.title = 'חיפוש';
    searchBtn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.71.71l.27.28v.79L20 21.5 21.5 20l-6-6zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor"/></svg>';
    actions.prepend(searchBtn);

    // Build overlay once
    if (!document.querySelector('.search-overlay')){
      const overlay = document.createElement('div'); overlay.className = 'search-overlay';
      const sheet = document.createElement('div'); sheet.className = 'search-sheet';
      sheet.innerHTML = `
        <div class="row">
          <input class="search-input" type="search" placeholder="חפש נסיעה / מילה" />
          <button class="icon-btn search-close" aria-label="סגור">
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M18.3 5.71L12 12.01 5.7 5.7 4.29 7.11l6.3 6.29-6.3 6.29 1.41 1.41L12 14.83l6.29 6.27 1.41-1.41-6.29-6.29 6.3-6.29z" fill="currentColor"/></svg>
          </button>
        </div>
        <div class="search-results"></div>
      `;
      overlay.appendChild(sheet);
      document.body.appendChild(overlay);

      // Wiring
      const input = sheet.querySelector('.search-input');
      const close = sheet.querySelector('.search-close');
      const results = sheet.querySelector('.search-results');
      const open = () => {
        overlay.classList.add('open');
        setTimeout(()=>input.focus(), 10);
        // Optionally preload with current list titles
        results.innerHTML = '';
        const items = Array.from(document.querySelectorAll('.trip-card .title, .trip .title, .card .title')).map(n=>n.textContent.trim()).filter(Boolean);
        if (items.length){
          results.innerHTML = items.slice(0,20).map(t=>`<div class="item" style="padding:10px 8px;border-bottom:1px solid var(--border)">${t}</div>`).join('');
        }
      };
      const closeFn = () => overlay.classList.remove('open');
      searchBtn.addEventListener('click', () => {
        // Prefer to focus existing search input if present on page
        const existing = document.querySelector('input[type="search"], .search input');
        if (existing && existing.offsetParent !== null){
          existing.scrollIntoView({behavior:'smooth', block:'center'});
          existing.focus();
        } else {
          open();
        }
      });
      close.addEventListener('click', closeFn);
      overlay.addEventListener('click', (e)=>{ if (e.target === overlay) closeFn(); });
      input.addEventListener('input', () => {
        const q = input.value.trim();
        if (!q){ results.innerHTML = ''; return; }
        const matches = Array.from(document.querySelectorAll('.trip-card, .trip, .card'))
          .map(card => ({card, text:(card.textContent||'').replace(/\s+/g,' ').trim()}))
          .filter(x => x.text.includes(q));
        results.innerHTML = matches.slice(0,30).map(x=>`<div class="item" style="padding:10px 8px;border-bottom:1px solid var(--border)">${x.text.substring(0,120)}…</div>`).join('');
      });
    }
  }
})();


// ===== Mobile light/dark toggle via data-mobile-theme on <html> =====
(function(){
  const isMobile = window.matchMedia && window.matchMedia("(max-width: 430px)").matches;
  if (!isMobile) return;
  const btn = document.querySelector('#btn-theme');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const html = document.documentElement;
    html.setAttribute('data-mobile-theme', html.getAttribute('data-mobile-theme') === 'light' ? '' : 'light');
  }, { capture: true });
})();


// ===== Mobile toolbar: single-instance enforcement & cleanup =====
(function(){
  const isMobile = window.matchMedia && window.matchMedia("(max-width: 430px)").matches;
  if (!isMobile) return;

  // prevent multiple initializations across older snippets
  if (window.__flymilyMobileBarInit) {
    // keep only the first toolbar
    const bars = document.querySelectorAll('.mobile-topbar');
    bars.forEach((el, i) => { if (i > 0) el.remove(); });
    return;
  }
  window.__flymilyMobileBarInit = true;

  // remove any older injected bars before we build a clean one
  document.querySelectorAll('.mobile-topbar').forEach(el => el.remove());

  // hide vertical decorative elements that break width
  document.querySelectorAll('.vertical-pill,.email-vertical,.brand-vertical').forEach(el => el.style.display='none');

  // --- build two-row toolbar ---
  const qAll = sel => Array.from(document.querySelectorAll(sel));
  const clickByText = (rx) => qAll("button,.btn,[role='button']").find(b => rx.test((b.textContent||"").trim()))?.click();
  const email = (window.currentUserEmail || qAll(".user-email,.email-chip,.chip").map(n=>n.textContent).find(t=>/@/.test(t||"")) || "").trim() || "התחבר";

  const I = {
    logout:'<svg viewBox="0 0 24 24" width="20" height="20"><path d="M10 17l1.41-1.41L9.83 14H16v-2H9.83l1.58-1.59L10 9l-4 4 4 4zM20 19H12v2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-8v2h8v14z" fill="currentColor"/></svg>',
    theme:'<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 3a9 9 0 0 0 0 18 9 9 0 0 0 8.25-5.25A7 7 0 0 1 12 5a7 7 0 0 1 6.22-3.94A9 9 0 0 0 12 3z" fill="currentColor"/></svg>',
    grid:'<svg viewBox="0 0 24 24" width="20" height="20"><path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 8v-8h8v8h-8z" fill="currentColor"/></svg>',
    sort:'<svg viewBox="0 0 24 24" width="20" height="20"><path d="M7 6h14v2H7V6zm0 5h10v2H7v-2zm0 5h6v2H7v-2zM3 5v14l4-3.5L3 12l4-3.5L3 5z" fill="currentColor"/></svg>',
    search:'<svg viewBox="0 0 24 24" width="20" height="20"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.71.71l.27.28v.79L20 21.5 21.5 20l-6-6zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor"/></svg>'
  };

  const icon = (svg, label, onClick) => {
    const b = document.createElement('button');
    b.className = 'icon-btn';
    b.innerHTML = svg;
    b.title = label;
    b.setAttribute('aria-label', label);
    b.addEventListener('click', onClick);
    return b;
  };

  const bar = document.createElement('div');
  bar.className = 'mobile-topbar';
  bar.innerHTML = `
    <div class="topline">
      <div class="email-chip" title="החשבון שלך">${email}</div>
      <div class="actions"></div>
    </div>
    <div class="menugrid"></div>
  `;
  (document.querySelector('header') || document.body).after(bar);

  const actions = bar.querySelector('.actions');
  actions.append(
    icon(I.logout,'התנתקות/התחברות', ()=>clickByText(/התנתקות|התחברות|יציאה/)),
    icon(I.theme,'מצב כהה/בהיר', ()=>clickByText(/מצב כהה|מצב בהיר/)),
    icon(I.search,'חיפוש', ()=>{
      const existing = document.querySelector('input[type="search"], .search input');
      if (existing && existing.offsetParent !== null){ existing.scrollIntoView({behavior:'smooth', block:'center'}); existing.focus(); }
      else { document.querySelector('#btn-search')?.click(); }
    })
  );

  const menu = bar.querySelector('.menugrid');
  menu.append(
    icon(I.grid,'תפריטים', ()=>{
      const backdrop = document.querySelector('.action-sheet-backdrop');
      const sheet = document.querySelector('.action-sheet');
      if (sheet && backdrop){ sheet.classList.add('open'); backdrop.classList.add('open'); }
    }),
    icon(I.sort,'מיין לפי תאריך יציאה', ()=>clickByText(/מיין|תאריך יציאה|יציאה/))
  );

  // enforce list view, hide gallery
  const galBtn  = qAll("button,.btn").find(b => /גלריה/.test(b.textContent||""));
  if (galBtn){ galBtn.style.display='none'; galBtn.closest?.('.list-actions,.tabs,.chips')?.classList?.add('hide-gallery-toggle'); }
  const listBtn = qAll("button,.btn").find(b => /רשימה/.test(b.textContent||""));
  if (listBtn && !/active/.test(listBtn.className)) listBtn.click();

  // hide original verbose controls
  qAll('button,.btn').forEach(b=>{
    const t=(b.textContent||'').trim();
    if(/התנתקות|מצב כהה|מצב בהיר|גלריה/.test(t)) b.style.display='none';
  });
})();




// ===== FLYMILY Mobile Toolbar v3 (fixed, single instance, ≤430px) =====
(function () {
  const isMobile = matchMedia("(max-width:430px)").matches;
  if (!isMobile) return;

  if (window.__flymilyMobileBarInit) return;
  window.__flymilyMobileBarInit = true;
  document.querySelectorAll(".mobile-toolbar").forEach(el => el.remove());

  // Helpers (define ONCE)
  const $all = (sel)=>Array.from(document.querySelectorAll(sel));
  const clickByText = (rx)=>$all("button,.btn,[role='button']").find(b=>rx.test((b.textContent||"").trim()))?.click();

  // Hide vertical decorations that break mobile layout
  document.querySelectorAll(".vertical-pill,.email-vertical,.brand-vertical").forEach(el => el.style.display="none");

  // Resolve email
  const email =
    (window.currentUserEmail ||
     $all(".user-email,.email-chip,.chip").map(n=>n.textContent).find(t=>/@/.test(t||"")) || ""
    ).trim() || "התחבר";

  // Icons
  const I = {
    logout:'<svg viewBox="0 0 24 24" width="20" height="20"><path d="M10 17l1.41-1.41L9.83 14H16v-2H9.83l1.58-1.59L10 9l-4 4 4 4zM20 19H12v2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-8v2h8v14z" fill="currentColor"/></svg>',
    theme:'<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 3a9 9 0 0 0 0 18 9 9 0 0 0 8.25-5.25A7 7 0 0 1 12 5a7 7 0 0 1 6.22-3.94A9 9 0 0 0 12 3z" fill="currentColor"/></svg>',
    grid:'<svg viewBox="0 0 24 24" width="20" height="20"><path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 8v-8h8v8h-8z" fill="currentColor"/></svg>',
    sort:'<svg viewBox="0 0 24 24" width="20" height="20"><path d="M7 6h14v2H7V6zm0 5h10v2H7v-2zm0 5h6v2H7v-2zM3 5v14l4-3.5L3 12l4-3.5L3 5z" fill="currentColor"/></svg>',
    search:'<svg viewBox="0 0 24 24" width="20" height="20"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.71.71l.27.28v.79L20 21.5 21.5 20l-6-6zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor"/></svg>'
  };
  const iconBtn = (svg,label,fn)=>{
    const b=document.createElement("button");
    b.className="icon-btn"; b.innerHTML=svg; b.title=label; b.setAttribute("aria-label",label);
    b.addEventListener("click",fn); return b;
  };

  // Build toolbar
  const bar = document.createElement("div");
  bar.className = "mobile-toolbar";
  bar.innerHTML = `
    <div class="topline">
      <div class="email-chip" title="החשבון שלך">${email}</div>
      <div class="actions"></div>
    </div>
    <div class="menugrid"></div>`;
  (document.querySelector("header")||document.body).after(bar);

  // Top actions
  const actions = bar.querySelector(".actions");
  actions.append(
    iconBtn(I.logout,"התנתקות/התחברות",()=>clickByText(/התנתקות|התחברות|יציאה/)),
    iconBtn(I.theme,"מצב כהה/בהיר",()=>{
      if (!clickByText(/מצב כהה|מצב בהיר/)) {
        const html=document.documentElement;
        html.setAttribute("data-mobile-theme", html.getAttribute("data-mobile-theme")==="light" ? "" : "light");
      }
    }),
    iconBtn(I.search,"חיפוש",()=>{
      const existing=document.querySelector('input[type="search"], .search input');
      if (existing && existing.offsetParent!==null){ existing.scrollIntoView({behavior:"smooth",block:"center"}); existing.focus(); }
      else document.querySelector(".search-overlay")?.classList.add("open");
    })
  );

  // Bottom menu
  const menu = bar.querySelector(".menugrid");
  menu.append(
    iconBtn(I.grid,"תפריטים",()=>{
      const backdrop=document.querySelector(".action-sheet-backdrop");
      const sheet=document.querySelector(".action-sheet");
      if (sheet && backdrop){ sheet.classList.add("open"); backdrop.classList.add("open"); }
    }),
    iconBtn(I.sort,"מיין לפי תאריך יציאה",()=>{
      // Try existing sort button
      if (clickByText(/מיין|תאריך יציאה|יציאה/)) return;
      // Fallback DOM sort
      const cards = $all(".trip-card,[data-depart]");
      const parse = s => (s||"").match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/) ?
        new Date(RegExp.$3.length===2?("20"+RegExp.$3):RegExp.$3, RegExp.$2-1, RegExp.$1).getTime() : 0;
      cards.sort((a,b)=>{
        const da=+a.dataset.depart || parse(a.textContent);
        const db=+b.dataset.depart || parse(b.textContent);
        return db-da;
      });
      const list = cards[0]?.parentElement;
      if (list) cards.forEach(c=>list.appendChild(c));
    })
  );

  // List-only on mobile
  const galBtn = $all("button,.btn").find(b=>/גלריה/.test(b.textContent||""));
  if (galBtn){ galBtn.style.display="none"; galBtn.closest?.(".list-actions,.tabs,.chips")?.classList?.add("hide-gallery-toggle"); }
  const listBtn = $all("button,.btn").find(b=>/רשימה/.test(b.textContent||""));
  if (listBtn && !/active/.test(listBtn.className)) listBtn.click();

  // Hide verbose originals to avoid UI duplication
  $all("button,.btn").forEach(b=>{
    const t=(b.textContent||"").trim();
    if (/התנתקות|מצב כהה|מצב בהיר|גלריה/.test(t)) b.style.display="none";
  });

  bar.style.zIndex = "999";
})();


// === Collapsible menus (for nested actions) ===
document.addEventListener('click', (e)=>{
  const t = e.target.closest('[data-collapse]');
  if(!t) return;
  const host = t.closest('.collapsible');
  if(!host) return;
  host.classList.toggle('is-open');
  const content = host.querySelector('.collapsible__content');
  if (content && host.classList.contains('is-open')){
    content.style.maxHeight = Math.min(content.scrollHeight, 480) + 'px';
  } else if (content){
    content.style.maxHeight = '0px';
  }
});

// === Action Sheet (idempotent, no flicker) ===
document.addEventListener('click', (e) => {
  const openBtn = e.target.closest('[data-open-sheet]');
  const closeBtn = e.target.closest('[data-close-sheet]');
  const backdrop = document.querySelector('.action-sheet-backdrop');
  const sheet = document.querySelector('.action-sheet');
  if (!sheet || !backdrop) return;

  if (openBtn){
    if (!sheet.classList.contains('open')){
      sheet.classList.add('open');
      backdrop.classList.add('open');
    }
  }
  if (closeBtn || e.target === backdrop){
    sheet.classList.remove('open');
    backdrop.classList.remove('open');
  }
}, { capture:true });
