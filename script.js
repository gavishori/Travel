
// DOUBLE_TAP_GUARD
(function(){let last=0;document.addEventListener('touchend',e=>{const now=Date.now();if(now-last<350){e.preventDefault();}last=now;},{passive:false,capture:true});})();

// Leaflet marker assets
if (typeof L !== 'undefined' && L.Icon && L.Icon.Default) {
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
  });
}

// ---------- Utilities ----------
const el = (id) => document.getElementById(id);
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

function fmtMoney(n, ccy="USD"){
  if(n===null||n===undefined||isNaN(n)) return "—";
  try{ return new Intl.NumberFormat('he-IL',{style:'currency',currency: ccy}).format(Number(n)); }catch(_){
    return `${Number(n).toFixed(2)} ${ccy}`;
  }
}
function todayISO(){ const d=new Date(); return d.toISOString().slice(0,10); }
function linkifyToIcon(text){
  if (!text) return "";
  text = String(text).replace(/\s*\/+?(https?:\/\/)/g, '$1');
  const urlRe = /(https?:\/\/[^\s)\]}>"']+)/g;
  return text.replace(urlRe, (m)=>`<a class="badge" href="${m}" target="_blank" rel="noopener" title="פתח קישור">🔗</a>`);
}

// Theme
(function(){
  const saved = localStorage.getItem('theme') || 'dark';
  if (saved === 'light') document.documentElement.classList.add('light');
  $('#themeToggle')?.addEventListener('click', ()=>{
    const isLight = document.documentElement.classList.toggle('light');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
  });
})();

// ---------- Auth (Email/Password only) ----------
const Auth = (function(){
  function isFirebaseReady(){
    return typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0;
  }
  function user(){ return isFirebaseReady() ? firebase.auth().currentUser : null; }
  function onChange(cb){
    if (!isFirebaseReady()) { cb(null); return; }
    firebase.auth().onAuthStateChanged(cb);
  }
  async function signIn(email, password){
    if (!isFirebaseReady()) throw new Error('Firebase לא מאותחל.');
    return firebase.auth().signInWithEmailAndPassword(email, password);
  }
  async function register(email, password){
    if (!isFirebaseReady()) throw new Error('Firebase לא מאותחל.');
    return firebase.auth().createUserWithEmailAndPassword(email, password);
  }
  async function reset(email){
    if (!isFirebaseReady()) throw new Error('Firebase לא מאותחל.');
    return firebase.auth().sendPasswordResetEmail(email);
  }
  async function signOut(){
    if (!isFirebaseReady()) return;
    await firebase.auth().signOut();
  }
  return { isFirebaseReady, user, onChange, signIn, register, reset, signOut };
})();

// ---------- Data Layer ----------
const Store = (function(){
  function useFirebase(){
    return Auth.isFirebaseReady() && Auth.user();
  }
  function db(){ return firebase.firestore(); }

  function loadLS(){
    try{ return JSON.parse(localStorage.getItem('travel_journal_data_v3')) || { trips:{} }; }
    catch{ return { trips:{} }; }
  }
  function saveLS(data){ localStorage.setItem('travel_journal_data_v3', JSON.stringify(data)); }

  async function listTrips(){
    if (useFirebase()){
      const uid = Auth.user().uid;
      const snap = await db().collection('trips').where('ownerUid','==',uid).get();
      return snap.docs.map(d=>({ id:d.id, ...d.data() })).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    }else{
      const data = loadLS();
      return Object.entries(data.trips).map(([id,t])=>({ id, ...t })).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    }
  }

  async function createTrip(meta){
    const now = Date.now();
    const trip = { ...meta, createdAt: now, updatedAt: now, budget: { USD: Number(meta.budgetUSD||0) }, budgetLocked: !!meta.budgetLocked, expenses:{}, journal:{}, share:{enabled:false,scope:'full'} };
    if (useFirebase()){
      const uid = Auth.user().uid;
      const ref = await db().collection('trips').add({ ...trip, ownerUid: uid });
      return { id: ref.id, ...trip, ownerUid: uid };
    }else{
      const data = loadLS();
      const id = 't_' + (crypto.randomUUID ? crypto.randomUUID() : String(now));
      data.trips[id] = trip;
      saveLS(data);
      return { id, ...trip };
    }
  }

  async function getTrip(id){
    if (useFirebase()){
      const doc = await db().collection('trips').doc(id).get();
      if (!doc.exists) return null;
      const t = { id: doc.id, ...doc.data() };
      t.expenses ||= {}; t.journal ||= {}; t.budget ||= {USD:0}; t.share ||= {enabled:false,scope:'full'};
      return t;
    }else{
      const data = loadLS();
      const t = data.trips[id];
      return t ? { id, ...t } : null;
    }
  }

  async function updateTrip(id, updates){
    updates.updatedAt = Date.now();
    if (useFirebase()){
      await db().collection('trips').doc(id).set(updates, { merge:true });
    }else{
      const data = loadLS();
      data.trips[id] = { ...(data.trips[id]||{}), ...updates };
      saveLS(data);
    }
  }

  async function deleteTrip(id){
    if (useFirebase()){
      await db().collection('trips').doc(id).delete();
    }else{
      const data = loadLS();
      delete data.trips[id];
      saveLS(data);
    }
  }

  // --- Expenses ---
  async function listExpenses(tripId){
    const t = await getTrip(tripId); const exp = t?.expenses || {};
    return Object.entries(exp).map(([id,v])=>({ id, ...v })).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  }
  async function addExpense(tripId, entry){
    entry.createdAt = Date.now();
    const t = await getTrip(tripId);
    const id = 'e_' + (crypto.randomUUID ? crypto.randomUUID() : String(entry.createdAt));
    const expenses = { ...(t.expenses||{}), [id]: entry };
    await updateTrip(tripId, { expenses });
    return { id, ...entry };
  }
  async function updateExpense(tripId, expId, updates){
    const t = await getTrip(tripId);
    const expenses = { ...(t.expenses||{}) };
    expenses[expId] = { ...(expenses[expId]||{}), ...updates };
    await updateTrip(tripId, { expenses });
  }
  async function removeExpense(tripId, expId){
    const t = await getTrip(tripId);
    const expenses = { ...(t.expenses||{}) };
    delete expenses[expId];
    await updateTrip(tripId, { expenses });
  }

  // --- Journal ---
  async function listJournal(tripId){
    const t = await getTrip(tripId); const j = t?.journal || {};
    return Object.entries(j).map(([id,v])=>({ id, ...v })).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  }
  async function addJournal(tripId, entry){
    entry.createdAt = Date.now();
    const t = await getTrip(tripId);
    const id = 'j_' + (crypto.randomUUID ? crypto.randomUUID() : String(entry.createdAt));
    const journal = { ...(t.journal||{}), [id]: entry };
    await updateTrip(tripId, { journal });
    return { id, ...entry };
  }
  async function updateJournal(tripId, jId, updates){
    const t = await getTrip(tripId);
    const journal = { ...(t.journal||{}) };
    journal[jId] = { ...(journal[jId]||{}), ...updates };
    await updateTrip(tripId, { journal });
  }
  async function removeJournal(tripId, jId){
    const t = await getTrip(tripId);
    const journal = { ...(t.journal||{}) };
    delete journal[jId];
    await updateTrip(tripId, { journal });
  }

  return { listTrips, createTrip, getTrip, updateTrip, deleteTrip,
           listExpenses, addExpense, updateExpense, removeExpense,
           listJournal, addJournal, updateJournal, removeJournal };
})();

// ---------- App State ----------
const state = {
  trips: [], currentTripId: null, localCurrency: 'USD',
  maps: { main: null },
  sortAsc: false
};

// ---------- Views ----------
async function refreshTrips(){
  const list = el('tripList');
  if (!list) return;
  list.setAttribute('aria-busy','true');
  const trips = await Store.listTrips();
  state.trips = trips;
  const q = (el('tripSearch')?.value||'').trim();
  const items = trips.filter(t=> !q || (t.name||'').includes(q) || (t.destination||'').includes(q));
  list.innerHTML = items.map(t=>{
    const spent = sumExpenses(t);
    const budget = Number(t?.budget?.USD||0);
    const left = budget - spent;
    return `
      <li>
        <div class="trip-title">${t.name||'טיול ללא שם'}</div>
        <div class="muted">${t.destination||'—'}</div>
        <div class="row">
          <div class="stat"><div class="label">תקציב</div><div class="value">${fmtMoney(budget,'USD')}</div></div>
          <div class="stat"><div class="label">הוצאות</div><div class="value ${left<0?'negative':''}">${fmtMoney(spent,'USD')}</div></div>
          <div class="stat"><div class="label">יתרה</div><div class="value ${left<0?'negative':''}">${fmtMoney(left,'USD')}</div></div>
        </div>
        <div class="row">
          <button class="btn primary" data-open-trip="${t.id}">פתח</button>
          <button class="btn ghost" data-del-trip="${t.id}">מחק</button>
        </div>
      </li>
    `;
  }).join('');
  list.removeAttribute('aria-busy');
}

function sumExpenses(trip){
  const exp = trip?.expenses || {};
  let total = 0;
  Object.values(exp).forEach(e=>{
    const amt = Number(e.amount||0);
    if (!isNaN(amt)) total += amt;
  });
  return total;
}

async function openTrip(id){
  const t = await Store.getTrip(id);
  if (!t) return;
  state.currentTripId = id;
  $('#tripTitle').textContent = t.name || 'טיול';
  $('#localCcyCell').textContent = t.localCurrency || 'USD';
  renderBudget(t);
  renderRecent(t);
  await renderExpenses();
  await renderJournal();
  setTimeout(initMap, 50);
  $('#view-trips').classList.remove('active');
  $('#view-trip').classList.add('active');
}

function renderBudget(trip){
  const spent = sumExpenses(trip);
  const budget = Number(trip?.budget?.USD||0);
  const left = budget - spent;
  $('#sumBudget').textContent = fmtMoney(budget,'USD');
  $('#sumSpent').textContent  = fmtMoney(spent,'USD');
  const leftCell = $('#sumLeft');
  leftCell.textContent = fmtMoney(left,'USD');
  leftCell.classList.toggle('negative', left < 0);
}

function renderRecent(trip){
  const recent = $('#recentActivity');
  const exp = Object.values(trip.expenses||{}).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,5);
  recent.innerHTML = exp.map(e=>{
    const date = e.date || new Date(e.createdAt||Date.now()).toISOString().slice(0,10);
    return `<li>${e.desc||'—'} — ${fmtMoney(e.amount||0, e.currency||'USD')} <span class="muted">(${date})</span></li>`;
  }).join('') || '<li class="muted">אין פעילות עדיין</li>';
}

async function renderExpenses(){
  const list = $('#expenseList'); if (!list) return;
  const exp = await Store.listExpenses(state.currentTripId);
  const filter = $('#categoryFilter')?.value || '';
  const items = exp.filter(e=> !filter || (e.category||'')===filter);
  list.innerHTML = items.map(e=>{
    const date = e.date || new Date(e.createdAt||Date.now()).toISOString().slice(0,10);
    const time = e.time || '';
    const where = e.place ? ` · <span class="where">${e.place}</span>` : '';
    const link = e.link ? linkifyToIcon(e.link) : '';
    return `
      <li>
        <div class="top">
          <div>
            ${e.desc||'—'}${where}
          </div>
          <div class="badge">${fmtMoney(e.amount||0, e.currency||'USD')}</div>
        </div>
        <div class="bottom">
          <div class="muted">${date}${time? ' · ' + time : ''} · <span class="badge">${e.category||'אחר'}</span> ${link}</div>
          <div class="row-actions">
            <button class="btn small ghost" data-edit-exp="${e.id}">ערוך</button>
            <button class="btn small" data-del-exp="${e.id}">מחק</button>
          </div>
        </div>
      </li>
    `;
  }).join('') || '<li class="muted">אין הוצאות עדיין</li>';
}

async function renderJournal(){
  const list = $('#journalList'); if (!list) return;
  const items = await Store.listJournal(state.currentTripId);
  list.innerHTML = items.map(j=>{
    const date = j.date || new Date(j.createdAt||Date.now()).toISOString().slice(0,10);
    return `<li><div class="top"><strong>${j.title||'ללא כותרת'}</strong></div><div class="bottom"><span class="muted">${date}</span><div class="row-actions"><button class="btn small ghost" data-edit-j="${j.id}">ערוך</button><button class="btn small" data-del-j="${j.id}">מחק</button></div></div><div>${(j.body||'').replace(/</g,'&lt;')}</div></li>`;
  }).join('') || '<li class="muted">אין רשומות עדיין</li>';
}

function initMap(){
  const mapEl = $('#mainMap'); if (!mapEl) return;
  if (!state.maps.main){
    state.maps.main = L.map('mainMap',{ zoomControl:true, scrollWheelZoom:false }).setView([31.77,35.21], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{ attribution:'© OpenStreetMap'}).addTo(state.maps.main);
  }
  Store.getTrip(state.currentTripId).then(t=>{
    const exp = Object.values(t.expenses||{});
    const markers = [];
    exp.forEach(e=>{
      if (typeof e.lat === 'number' && typeof e.lng === 'number'){
        const m = L.marker([e.lat,e.lng]).addTo(state.maps.main).bindPopup(`<b>${e.desc||''}</b><br>${fmtMoney(e.amount||0,e.currency||'USD')}`);
        markers.push(m);
      }
    });
    if (markers.length){
      const group = L.featureGroup(markers);
      state.maps.main.fitBounds(group.getBounds().pad(0.2));
    }
  });
}

// ---------- Events ----------
$('#tripSearch')?.addEventListener('input', refreshTrips);

$('#bnAdd')?.addEventListener('click', async ()=>{
  const t = await Store.createTrip({ name:'טיול חדש', destination:'', budgetUSD:0 });
  await refreshTrips();
  openTrip(t.id);
});

$('#backToTrips')?.addEventListener('click', ()=>{
  $('#view-trip').classList.remove('active');
  $('#view-trips').classList.add('active');
  refreshTrips();
});

// Tabs
$$('.tabs .tab').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    $$('.tabs .tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    $$('.panel').forEach(p=>p.classList.remove('active'));
    $('#panel-'+btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab==='map') setTimeout(initMap, 30);
  });
});

// Bottom nav
$('#bottomNav')?.addEventListener('click',(e)=>{
  const btn = e.target.closest('[data-nav]'); if (!btn) return;
  $$('#bottomNav .bn-item').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const view = btn.dataset.nav;
  if (view==='trips'){ $('#view-trips').classList.add('active'); $('#view-trip').classList.remove('active'); refreshTrips(); }
  if (view==='settings'){ if (state.currentTripId) { $('#view-trip').classList.add('active'); $('#view-trips').classList.remove('active'); $('.tab[data-tab="settings"]').click(); } }
});

// Open trip & delete
$('#tripList')?.addEventListener('click', (e)=>{
  const openBtn = e.target.closest('[data-open-trip]');
  const delBtn = e.target.closest('[data-del-trip]');
  if (openBtn){ openTrip(openBtn.dataset.openTrip); }
  if (delBtn){ if (confirm('למחוק את הטיול?')){ Store.deleteTrip(delBtn.dataset.delTrip).then(refreshTrips); } }
});

// Add expense
$('#quickAddExpense')?.addEventListener('click', ()=> openExpenseDialog());
$('#addExpense')?.addEventListener('click', ()=> openExpenseDialog());
$('#categoryFilter')?.addEventListener('change', renderExpenses);

// Expense list actions
$('#expenseList')?.addEventListener('click', (e)=>{
  const edit = e.target.closest('[data-edit-exp]');
  const del  = e.target.closest('[data-del-exp]');
  if (edit){ openExpenseDialog(edit.dataset.editExp); }
  if (del){ if (confirm('למחוק הוצאה?')){ Store.removeExpense(state.currentTripId, del.dataset.delExp).then(renderExpenses).then(()=>Store.getTrip(state.currentTripId).then(renderBudget)); } }
});

// Journal actions
$('#addJournal')?.addEventListener('click', ()=>{ openJournalDialog(); });
$('#journalList')?.addEventListener('click', (e)=>{
  const edit = e.target.closest('[data-edit-j]');
  const del  = e.target.closest('[data-del-j]');
  if (edit){ openJournalDialog(edit.dataset.editJ); }
  if (del){ if (confirm('למחוק רשומה?')){ Store.removeJournal(state.currentTripId, del.dataset.delJ).then(renderJournal); } }
});

// Settings save/delete
$('#saveTripMeta')?.addEventListener('click', async ()=>{
  const updates = {
    name: $('#tripNameInput').value.trim(),
    destination: $('#tripDestInput').value.trim(),
    budget: { USD: Number($('#tripBudgetInput').value||0) },
    budgetLocked: $('#lockBudget').checked
  };
  await Store.updateTrip(state.currentTripId, updates);
  const t = await Store.getTrip(state.currentTripId);
  renderBudget(t); $('#tripTitle').textContent = t.name || 'טיול';
  alert('נשמר ✓');
});
$('#deleteTrip')?.addEventListener('click', async ()=>{
  if (!state.currentTripId) return;
  if (confirm('למחוק את הטיול וצמודיו?')){
    await Store.deleteTrip(state.currentTripId);
    $('#view-trip').classList.remove('active');
    $('#view-trips').classList.add('active');
    refreshTrips();
  }
});

// Auth button
$('#openAuth')?.addEventListener('click', async ()=>{
  if (Auth.user()){
    if (confirm('להתנתק?')){
      await Auth.signOut();
    }
  } else {
    $('#authDialog').showModal();
  }
});
$$('dialog [data-close]').forEach(b=> b.addEventListener('click', (e)=> e.target.closest('dialog').close() ));

// Auth actions
$('#authSignIn')?.addEventListener('click', async ()=>{
  const email = $('#authEmail').value.trim();
  const pass  = $('#authPassword').value;
  const errEl = $('#authError');
  errEl.textContent = '';
  try{
    await Auth.signIn(email, pass);
    $('#authDialog').close();
  }catch(err){
    errEl.textContent = normAuthErr(err);
  }
});
$('#authRegister')?.addEventListener('click', async ()=>{
  const email = $('#authEmail').value.trim();
  const pass  = $('#authPassword').value;
  const errEl = $('#authError');
  errEl.textContent = '';
  try{
    await Auth.register(email, pass);
    $('#authDialog').close();
  }catch(err){
    errEl.textContent = normAuthErr(err);
  }
});
$('#authReset')?.addEventListener('click', async ()=>{
  const email = $('#authEmail').value.trim();
  const errEl = $('#authError');
  errEl.textContent = '';
  try{
    await Auth.reset(email);
    errEl.textContent = 'קישור לאיפוס סיסמה נשלח למייל.';
  }catch(err){
    errEl.textContent = normAuthErr(err);
  }
});

function normAuthErr(e){
  const code = e && e.code || '';
  if (code.includes('auth/invalid-email')) return 'אימייל לא תקין.';
  if (code.includes('auth/user-not-found')) return 'משתמש לא נמצא. אפשר להירשם.';
  if (code.includes('auth/wrong-password')) return 'סיסמה שגויה.';
  if (code.includes('auth/weak-password')) return 'סיסמה חלשה. השתמש/י בסיסמה חזקה יותר.';
  if (code.includes('auth/email-already-in-use')) return 'האימייל כבר בשימוש.';
  return e && e.message ? e.message : 'שגיאת התחברות.';
}

// Auth state -> UI
Auth.onChange(async (user)=>{
  $('#authStatus').textContent = user ? (user.email || 'מחובר') : 'אורח';
  $('#openAuth').textContent = user ? 'התנתק' : 'התחברות';
  await refreshTrips();
});

// Populate currency choices
function populateCurrencies(selectEl, ensure){
  const base = new Set(['USD','EUR','ILS']);
  if (ensure) base.add(ensure);
  selectEl.innerHTML = Array.from(base).map(c=>`<option>${c}</option>`).join('');
}

// Expense dialog helpers
async function openExpenseDialog(expId){
  const d = $('#expenseDialog');
  const form = $('#expenseForm');
  form.reset();
  populateCurrencies($('#expenseCurrency'));
  let editing = null;
  if (expId){
    const exp = (await Store.listExpenses(state.currentTripId)).find(x=>x.id===expId);
    if (exp){
      editing = expId;
      form.desc.value = exp.desc||'';
      form.category.value = exp.category||'אחר';
      form.amount.value = exp.amount||'';
      form.currency.value = exp.currency||'USD';
      form.date.value = exp.date||todayISO();
      form.time.value = exp.time||'';
      form.place.value = exp.place||'';
      form.link.value = exp.link||'';
    }
  }else{
    form.date.value = todayISO();
    form.time.value = new Date().toTimeString().slice(0,5);
  }
  d.showModal();
  form.onsubmit = async (e)=>{
    e.preventDefault();
    const entry = {
      desc: form.desc.value.trim(),
      category: form.category.value,
      amount: Number(form.amount.value||0),
      currency: form.currency.value,
      date: form.date.value,
      time: form.time.value,
      place: form.place.value.trim(),
      link: form.link.value.trim()
    };
    if (editing){
      await Store.updateExpense(state.currentTripId, editing, entry);
    }else{
      await Store.addExpense(state.currentTripId, entry);
    }
    d.close();
    const t = await Store.getTrip(state.currentTripId);
    renderBudget(t);
    renderExpenses();
  };
}

// Journal dialog
async function openJournalDialog(jId){
  const d = $('#journalDialog');
  const form = $('#journalForm');
  form.reset();
  let editing = null;
  if (jId){
    const j = (await Store.listJournal(state.currentTripId)).find(x=>x.id===jId);
    if (j){
      editing = jId;
      form.title.value = j.title||'';
      form.body.value  = j.body||'';
    }
  }
  d.showModal();
  form.onsubmit = async (e)=>{
    e.preventDefault();
    const entry = { title: form.title.value.trim(), body: form.body.value.trim() };
    if (editing){ await Store.updateJournal(state.currentTripId, editing, entry); }
    else { await Store.addJournal(state.currentTripId, entry); }
    d.close(); renderJournal();
  };
}

// Init
document.addEventListener('DOMContentLoaded', async ()=>{
  await refreshTrips();
});
