// script.js
// App logic for FLYMILY — soft palette edition
// Note: This is a reasonably complete scaffold implementing the requested spec.
// Some advanced features (PDF/Excel/Word/GPX generation, share-mode, map picking, etc.) are included.

import { app, db, auth,
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut,
  collection, addDoc, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, where, serverTimestamp,
  Timestamp
} from './firebase.js';

// ---------- Utilities ----------
function isPermError(e){
  return e && (e.code === 'permission-denied' || (e.message||'').includes('Missing or insufficient permissions'));
}

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const sleep = ms => new Promise(r=>setTimeout(r, ms));

const toast = (text, type='info') => {
  Toastify({
    text,
    duration: 2200,
    gravity: "top",
    position: "left",
    style: {
      background: type==='error' ? "#ef4444" : (type==='ok' ? "linear-gradient(180deg,#22c55e,#16a34a)" : "linear-gradient(180deg,#7C83FD,#5E66F4)"),
      borderRadius: "12px",
      boxShadow: "0 8px 28px rgba(0,0,0,.16)"
    }
  }).showToast();
};

const fmtDate = (d) => {
  if (!d) return '';
  if (d instanceof Date) return d.toISOString().slice(0,10);
  if (d.seconds) return new Date(d.seconds*1000).toISOString().slice(0,10);
  return d;
};

const uid = () => crypto.getRandomValues(new Uint32Array(4)).join('-');

const clampNumber = (v, fallback=0) => {
  const n = Number(v); return Number.isFinite(n) ? n : fallback;
};

const copyToClipboard = async (text) => {
  try{ await navigator.clipboard.writeText(text); toast('הועתק ללוח ✅','ok'); }
  catch{ toast('שגיאה בהעתקה','error'); }
};

// Currency conversion (cached per trip when locked)
async function fetchRates(base='USD'){
  const res = await fetch(`https://api.exchangerate.host/latest?base=${base}`);
  if(!res.ok) throw new Error('rate fetch failed');
  return await res.json();
}

function convert(amount, from, to, rates){
  if(from === to) return amount;
  // use rates where base is USD. Convert from 'from' to USD, then to 'to'.
  if(!rates || !rates.rates) return amount;
  const r = rates.rates;
  if(!r[from] || !r[to]) return amount;
  const usd = amount / r[from]; // amount in USD
  return usd * r[to];
}

function parseLinks(text){
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (url)=> `<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
}

// ---------- Theme ----------
const btnTheme = $('#btnTheme');
const themeIcon = $('#themeIcon');
const body = document.body;

function applyTheme(t){
  body.setAttribute('data-theme', t);
  localStorage.setItem('flymily-theme', t);
  themeIcon.textContent = (t==='dark' ? 'light_mode' : 'dark_mode');
}
applyTheme(localStorage.getItem('flymily-theme') || 'light');
btnTheme.addEventListener('click', () => {
  const t = body.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  applyTheme(t);
});

// ---------- Auth ----------
const loginScreen = $('#loginScreen');
const btnLogin = $('#btnLogin');
const btnLogout = $('#btnLogout');
const userBadge = $('#userBadge');

const lsEmail = $('#lsEmail');
const lsPass = $('#lsPass');
const lsSignIn = $('#lsSignIn');
const lsSignUp = $('#lsSignUp');
const lsReset = $('#lsReset');
const lsError = $('#lsError');

btnLogin.addEventListener('click', ()=>{
  loginScreen.scrollIntoView({behavior:'smooth'});
});
lsSignIn.addEventListener('click', async ()=>{
  lsError.textContent = '';
  try{
    await signInWithEmailAndPassword(auth, lsEmail.value.trim(), lsPass.value);
    toast('מחובר ✅','ok');
  }catch(e){
    lsError.textContent = e.message;
  }
});
lsSignUp.addEventListener('click', async ()=>{
  lsError.textContent = '';
  try{
    await createUserWithEmailAndPassword(auth, lsEmail.value.trim(), lsPass.value);
    toast('נרשם והתחבר ✅','ok');
  }catch(e){
    lsError.textContent = e.message;
  }
});
lsReset.addEventListener('click', async ()=>{
  lsError.textContent = '';
  try{
    await sendPasswordResetEmail(auth, lsEmail.value.trim());
    toast('נשלח מייל לאיפוס סיסמה ✅','ok');
  }catch(e){
    lsError.textContent = e.message;
  }
});
btnLogout.addEventListener('click', async ()=>{
  await signOut(auth);
  toast('התנתקת','ok');
});

// ---------- Modes ----------
const container = $('#appContainer');
const btnAllTrips = $('#btnAllTrips');
$('#brandHome').addEventListener('click', ()=>enterHomeMode());
btnAllTrips.addEventListener('click', ()=>enterHomeMode());

function enterHomeMode(){
  container.classList.remove('trip-mode');
  container.classList.add('home-mode');
  btnAllTrips.classList.add('hidden');
  $('#tripTabs')?.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  $('#tripTabs')?.querySelector('[data-view="view-overview"]')?.classList.add('active');
  renderHome();
}

function enterTripMode(){
  container.classList.remove('home-mode');
  container.classList.add('trip-mode');
  btnAllTrips.classList.remove('hidden');
}

// Read-only (share) – if share token exists in URL
let isReadOnlyShare = false;
let shareTokenFromURL = null;

// ---------- Data ----------
let currentUser = null;
let currentTripId = null;
let currentTrip = null;
let currentRates = null;  // { base: 'USD', rates: {...}, locked: bool }

const TRIP_TYPES = ['עירוני','בטן גב','טבע','סקי','קולינרי','מוזיאונים','קניות','רומנטי','משפחה','חברים'];


onAuthStateChanged(auth, async (user)=>{
  currentUser = user;
  const isShared = new URLSearchParams(location.search).get('share');
  if(isShared){
    isReadOnlyShare = true;
    shareTokenFromURL = isShared;
  } else {
    isReadOnlyShare = false;
    shareTokenFromURL = null;
  }

  const containerEl = document.getElementById('appContainer');
  const loginEl = document.getElementById('loginScreen');

  if(isReadOnlyShare){
    // Share-mode: skip login, show read-only view with restricted UI
    document.body.classList.add('auth');
    document.body.classList.remove('no-auth');
    loginEl.classList.add('hidden');
    containerEl.classList.remove('hidden');

    btnLogin.classList.add('hidden');
    btnLogout.classList.add('hidden');
    userBadge.classList.add('hidden');
    // Hide sidebar and tabs not allowed
    document.getElementById('sidebar').classList.add('hidden');
    enterHomeMode();
    await openTripFromShareToken(shareTokenFromURL);
    return;
  }

  if(user){
    userBadge.textContent = user.email;
    userBadge.classList.remove('hidden');
    btnLogin.classList.add('hidden');
    btnLogout.classList.remove('hidden');

    document.body.classList.add('auth');
    document.body.classList.remove('no-auth');
    loginEl.classList.add('hidden');
    containerEl.classList.remove('hidden');

    enterHomeMode();
  } else {
    userBadge.classList.add('hidden');
    btnLogout.classList.add('hidden');
    btnLogin.classList.remove('hidden');

    document.body.classList.add('no-auth');
    document.body.classList.remove('auth');
    loginEl.classList.remove('hidden');
    containerEl.classList.add('hidden');

    // Keep home-mode state reset
    enterHomeMode();
  }
});

async function openTripFromShareToken(token){
  // Find a trip with shareToken == token (security note: for demo)
  const tripsRef = collection(db, 'sharedTrips');
  // For simplicity, maintain a mirror collection {token, ownerUid, tripId}
  // Alternatively, scan user's trips by token (not feasible without ownerUid). So we assume mirror exists.
  // If not found, show message.
  try{
    const snap = await getDocs(query(tripsRef, where('token','==', token)));
    if(snap.empty){ toast('קישור שיתוף לא תקין','error'); return; }
    const meta = snap.docs[0].data();
    await openTrip(meta.ownerUid, meta.tripId, true);
  }catch(e){
    console.error(e);
    toast('שגיאה בפתיחת קישור','error');
  }
}

// ---------- Home Mode (trips list) ----------
const tripList = $('#tripList');
const searchTrips = $('#searchTrips');
const btnNewTrip = $('#btnNewTrip');
const btnViewGrid = $('#btnViewGrid');
const btnViewList = $('#btnViewList');
const btnSortTrips = $('#btnSortTrips');
let listIsGrid = true;
let sortAsc = false;
let allTrips = [];

btnViewGrid.addEventListener('click', ()=>{
  listIsGrid = true;
  btnViewGrid.classList.add('active'); btnViewList.classList.remove('active');
  renderTripsList();
});
btnViewList.addEventListener('click', ()=>{
  listIsGrid = false;
  btnViewList.classList.add('active'); btnViewGrid.classList.remove('active');
  renderTripsList();
});
btnSortTrips.addEventListener('click', ()=>{ sortAsc = !sortAsc; renderTripsList(); });
searchTrips.addEventListener('input', renderTripsList);

btnNewTrip.addEventListener('click', ()=> openTripModal());


// --- Legacy loader & migration (if user's trips were stored at top-level /trips) ---
async function scanLegacyTrips(){
  const patterns = [
    {field:'ownerUid'}, {field:'uid'}, {field:'userId'}, {field:'owner'}
  ];
  for(const p of patterns){
    try{
      const qs = await getDocs(query(collection(db,'trips'), where(p.field,'==', currentUser.uid)));
      if(!qs.empty){
        return qs.docs.map(d=>({id:d.id, ...d.data()}));
      }
    }catch(e){ /* ignore permission errors silently */ }
  }
  return [];
}

async function migrateLegacyTrips(){
  toast('מתחיל ייבוא מטיולים קיימים…');
  const found = await scanLegacyTrips();
  if(!found.length){ toast('לא נמצאו טיולים קיימים במסלול הישן', 'error'); return; }
  for(const t of found){
    try{
      // copy meta
      await setDoc(doc(db,'users', currentUser.uid, 'trips', t.id), {
        destination: t.destination || t.dest || '',
        start: t.start || null,
        end: t.end || null,
        people: t.people || t.participants || '',
        types: t.types || t.tripTypes || [],
        budget: t.budget || null,
        createdAt: serverTimestamp()
      }, {merge:true});

      // copy subcollections if exist
      for(const sub of ['expenses','journal']){
        try{
          const subSnap = await getDocs(collection(db,'trips', t.id, sub));
          for(const d of subSnap.docs){
            await setDoc(doc(db,'users', currentUser.uid, 'trips', t.id, sub, d.id), d.data(), {merge:true});
          }
        }catch(e){ /* ignore */ }
      }
    }catch(e){ console.error(e); toast('שגיאה בייבוא טיול ' + (t.destination||t.id),'error'); }
  }
  toast('ייבוא הושלם ✅','ok');
  await renderHome();
}

async function renderHome(){
  if(!currentUser){ tripList.innerHTML = ''; return; }
  // fetch trips
  const tripsRef = collection(db, 'users', currentUser.uid, 'trips');
  try{
    const qs = await getDocs(query(tripsRef, orderBy('start','desc')));
    allTrips = qs.docs.map(d => ({ id:d.id, ...d.data() }));
    if(allTrips.length === 0){
      // Try legacy
      const legacy = await scanLegacyTrips();
      if(legacy.length){
        // Show import CTA in empty state
        window.__legacyTripsFound = true;
      }
    }
    renderTripsList();
  }catch(e){
    if(isPermError(e)){
      tripList.innerHTML = '<div class="card">נדרש להגדיר חוקי Firestore שיאפשרו למשתמש המחובר לקרוא/לכתוב את הנתונים שלו.<br/>ראה הוראות למטה.</div>';
    } else { console.error(e); toast('שגיאה בטעינת נסיעות','error'); }
  }
}

function highlightMatch(text, q){
  if(!q) return text;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
  return text.replace(re, '<mark>$1</mark>');
}

function matchesTrip(t, q){
  if(!q) return true;
  q = q.toLowerCase();
  if((t.destination||'').toLowerCase().includes(q)) return true;
  if((t.people||'').toLowerCase().includes(q)) return true;
  if((t.types||[]).join(',').toLowerCase().includes(q)) return true;
  if((t.searchIndex||'').includes(q)) return true; // optionally stored
  return false;
}

function renderTripsList(){
  tripList.classList.toggle('grid', listIsGrid);
  const q = searchTrips.value.trim();
  let items = [...allTrips];
  if(items.length === 0){
    const legacyNote = (window.__legacyTripsFound ? '<div style="margin-top:8px"><button id="ctaImportLegacy" class="ghost">ייבוא מטיולים קיימים</button></div>' : '');
    tripList.innerHTML = `
      <div class="empty-state">
        אין לכם עדיין נסיעות.
        <div><button id="ctaNewTrip" class="primary"><span class="material-symbols-rounded">add</span> נסיעה חדשה</button></div>
        ${legacyNote}
      </div>`;
    const cta = document.getElementById('ctaNewTrip');
    if(cta){ cta.addEventListener('click', ()=> openTripModal()); }
    const imp = document.getElementById('ctaImportLegacy');
    if(imp){ imp.addEventListener('click', ()=> migrateLegacyTrips()); }
    return;
  }
  items.sort((a,b)=>{
    const da = (a.start?.seconds||0);
    const db = (b.start?.seconds||0);
    return sortAsc ? da - db : db - da;
  });
  if(q) items = items.filter(t=>matchesTrip(t,q));

  tripList.innerHTML = items.map(t=>{
    const sub = `${fmtDate(t.start)}–${fmtDate(t.end)}`;
    const types = (t.types||[]).map(x=>`<span class="badge">${x}</span>`).join('');
    const title = highlightMatch(t.destination||'', q);
    const row = `
      <div class="trip-card" data-id="${t.id}">
        <div class="meta">
          <div class="trip-title">${title || '(ללא יעד)'}</div>
          <div class="trip-sub">${sub}</div>
          <div class="badges">${types}</div>
          ${q ? `<div class="note">התאמה ב: יעד/סוג/משתתפים</div>` : ''}
        </div>
        <div class="actions">
          <button class="menu-btn" data-id="${t.id}">
            <span class="material-symbols-rounded">more_horiz</span>
          </button>
        </div>
      </div>
    `;
    return row;
  }).join('');

  // bind
  $$('.trip-card', tripList).forEach(el=>{
    el.addEventListener('click', (ev)=>{
      if(ev.target.closest('.menu-btn')) return; // menu opens elsewhere
      openTrip(currentUser.uid, el.dataset.id);
    });
  });
  $$('.menu-btn', tripList).forEach(btn=>btn.addEventListener('click', (ev)=>openRowMenu(ev, btn.dataset.id)));
}

const rowMenuModal = $('#rowMenuModal');
let rowMenuTripId = null;
function openRowMenu(ev, id){
  rowMenuTripId = id;
  rowMenuModal.showModal();
}
$('#rowEdit').addEventListener('click', async ()=>{
  rowMenuModal.close();
  const t = allTrips.find(x=>x.id===rowMenuTripId);
  if(t) openTripModal(t);
});
$('#rowDelete').addEventListener('click', async ()=>{
  rowMenuModal.close();
  const ok = await confirmDelete();
  if(!ok) return;
  await deleteDoc(doc(db,'users', currentUser.uid, 'trips', rowMenuTripId));
  toast('הטיול נמחק','ok');
  renderHome();
});

// ---------- Trip Modal ----------
const tripModal = $('#tripModal');
const tripModalTitle = $('#tripModalTitle');
const mdDestination = $('#mdDestination');
const mdStart = $('#mdStart');
const mdEnd = $('#mdEnd');
const mdPeople = $('#mdPeople');
const mdTypes = $('#mdTypes');
const tripModalDelete = $('#tripModalDelete');
const tripModalSave = $('#tripModalSave');

function renderTypes(el, selected=[]){
  el.innerHTML = TRIP_TYPES.map(tp=>{
    const is = selected.includes(tp);
    return `<label class="type-btn"><input type="checkbox" value="${tp}" ${is?'checked':''}/> <span>${tp}</span></label>`;
  }).join('');
}

function getSelectedTypes(){
  return Array.from(mdTypes.querySelectorAll('input[type=checkbox]:checked')).map(i=>i.value);
}

function openTripModal(existing=null){
  tripModalTitle.textContent = existing ? 'עריכת נסיעה' : 'נסיעה חדשה';
  mdDestination.value = existing?.destination || '';
  mdStart.value = fmtDate(existing?.start);
  mdEnd.value = fmtDate(existing?.end);
  mdPeople.value = existing?.people || '';
  renderTypes(mdTypes, existing?.types || []);
  tripModalDelete.classList.toggle('hidden', !existing);
  tripModal.showModal();

  tripModal.addEventListener('close', async ()=>{
    const action = tripModal.returnValue;
    if(action === 'save'){
      if(!currentUser){ toast('יש להתחבר', 'error'); return; }
      const data = {
        destination: mdDestination.value.trim(),
        start: mdStart.value ? Timestamp.fromDate(new Date(mdStart.value)) : null,
        end: mdEnd.value ? Timestamp.fromDate(new Date(mdEnd.value)) : null,
        people: mdPeople.value.trim(),
        types: getSelectedTypes(),
        createdAt: serverTimestamp()
      };
      if(existing){
        await updateDoc(doc(db,'users', currentUser.uid, 'trips', existing.id), data);
        toast('הטיול עודכן','ok');
      } else {
        const docRef = await addDoc(collection(db,'users', currentUser.uid, 'trips'), data);
        toast('טיול נוצר','ok');
        openTrip(currentUser.uid, docRef.id);
      }
      renderHome();
    } else if(action === 'delete' && existing){
      const ok = await confirmDelete();
      if(!ok) return;
      await deleteDoc(doc(db,'users', currentUser.uid, 'trips', existing.id));
      toast('הטיול נמחק','ok');
      renderHome();
    }
  }, {once:true});
}

// ---------- Trip Mode Rendering ----------
const tabs = $('#tripTabs');
tabs?.addEventListener('click', async (ev)=>{
  if(!container.classList.contains('trip-mode')){ toast('בחרו טיול מהרשימה', 'error'); return; }
  const btn = ev.target.closest('.tab');
  if(!btn) return;
  const view = btn.getAttribute('data-view');
  tabs.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  await showView(view);
});

async function showView(view){
  if(!currentTrip){ return; }
  // desktop
  $$('.panel.desktop-only').forEach(p=>p.style.display='none');
  $(`#${view}.desktop-only`)?.style.setProperty('display','block');
  // mobile: open correct accordion
  const det = $(`details[data-view="${view}"]`);
  if(det){ det.open = true; }
  if(view === 'view-overview') renderOverview();
  if(view === 'view-meta') renderMeta();
  if(view === 'view-expenses') renderExpenses();
  if(view === 'view-journal') renderJournal();
  if(view === 'view-map') await renderMap();
  if(view === 'view-share') renderShare();
}

async function openTrip(ownerUid, tripId, readOnly=false){
  currentTripId = tripId;
  enterTripMode();
  // Load meta
  const tDoc = await getDoc(doc(db,'users', ownerUid, 'trips', tripId));
  currentTrip = { id: tripId, ownerUid, ...(tDoc.data()||{}) };
  // Load locked rates if exist
  currentRates = currentTrip?.budget?.rates || null;
  await showView('view-overview');
}

// ---------- Overview ----------
async function renderOverview(){
  const root = $('#view-overview');
  if(!currentTrip){ root.innerHTML = ''; return; }

  // fetch last 5 expenses & journal
  const expRef = collection(db,'users', currentTrip.ownerUid, 'trips', currentTrip.id, 'expenses');
  const jrRef  = collection(db,'users', currentTrip.ownerUid, 'trips', currentTrip.id, 'journal');
  let expSnap = {docs:[]}, jrSnap = {docs:[]};
  try{
    [expSnap, jrSnap] = await Promise.all([
      getDocs(query(expRef, orderBy('createdAt','desc'))),
      getDocs(query(jrRef, orderBy('createdAt','desc')))
    ]);
  }catch(e){ if(isPermError(e)) { /* show empty */ } else { console.error(e); } }
  const lastExp = expSnap.docs.slice(0,5).map(d=>({id:d.id,...d.data()}));
  const lastJr  = jrSnap.docs.slice(0,5).map(d=>({id:d.id,...d.data()}));

  root.innerHTML = `
    <div class="row">
      <div class="card" style="flex:1 1 320px">
        <h3>נתוני נסיעה</h3>
        <div class="note">${currentTrip.destination||'(ללא יעד)'} | ${fmtDate(currentTrip.start)}–${fmtDate(currentTrip.end)}</div>
        <div class="note">משתתפים: ${currentTrip.people||'-'}</div>
        <div class="badges" style="margin-top:8px">${(currentTrip.types||[]).map(x=>`<span class="badge">${x}</span>`).join('')}</div>
      </div>

      <div class="card" style="flex:2 1 420px">
        <h3>הוצאות (אחרונות)</h3>
        <table class="table">
          <thead><tr><th>תיאור</th><th>קטגוריה</th><th>סכום</th><th>מטבע</th></tr></thead>
          <tbody>
            ${lastExp.map(e=>`<tr><td>${e.desc||''}</td><td>${e.cat||''}</td><td>${(e.amount||0).toFixed(2)}</td><td>${e.currency||''}</td></tr>`).join('') || '<tr><td colspan="4" class="note">אין נתונים</td></tr>'}
          </tbody>
        </table>
      </div>

      <div class="card" style="flex:2 1 420px">
        <h3>יומן יומי (אחרונים)</h3>
        <table class="table">
          <thead><tr><th>תאריך</th><th>תיאור</th></tr></thead>
          <tbody>
            ${lastJr.map(j=>`<tr><td>${fmtDate(j.createdAt)}</td><td>${j.text? j.text.slice(0,120) : ''}</td></tr>`).join('') || '<tr><td colspan="2" class="note">אין נתונים</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      <h3>הטיול שלי</h3>
      <div id="miniMap" class="map"></div>
    </div>
  `;

  // small map
  await renderMap(true);
}

// ---------- Meta ----------
let metaDirty = false;
function markMetaDirty(){ metaDirty = true; }

function budgetBlockHTML(b){
  const locked = b?.locked;
  return `
    <div class="card" style="margin-top:10px">
      <h4>תקציב</h4>
      <div class="row-3">
        <div><label>USD</label><input id="bUSD" type="number" step="0.01" value="${b?.USD ?? ''}"></div>
        <div><label>EUR</label><input id="bEUR" type="number" step="0.01" value="${b?.EUR ?? ''}"></div>
        <div><label>ILS</label><input id="bILS" type="number" step="0.01" value="${b?.ILS ?? ''}"></div>
      </div>
      <div class="btn-row" style="margin-top:8px">
        <button id="btnBudgetLock" class="${locked?'soft':'primary'}">${locked?'ביטול נעילה':'קבע תקציב'}</button>
        <span class="note">שינוי אחד יעדכן את שני המטבעות האחרים לפי שערים נוכחיים/נעולים</span>
      </div>
    </div>
  `;
}

function renderMeta(){
  const root = $('#view-meta');
  if(!currentTrip){ root.innerHTML = ''; return; }
  const b = currentTrip.budget || {};
  const typesBtns = TRIP_TYPES.map(tp=>`
    <button class="chip metaType ${currentTrip.types?.includes(tp)?'active':''}" data-value="${tp}">${tp}</button>
  `).join('');

  root.innerHTML = `
    <div class="row-2">
      <div class="card">
        <h3>פרטי נסיעה</h3>
        <label>יעד</label>
        <input id="metaDestination" type="text" value="${currentTrip.destination||''}" />

        <div class="row-2">
          <div>
            <label>תאריך התחלה</label>
            <input id="metaStart" type="date" value="${fmtDate(currentTrip.start)}" />
          </div>
          <div>
            <label>תאריך סיום</label>
            <input id="metaEnd" type="date" value="${fmtDate(currentTrip.end)}" />
          </div>
        </div>

        <label>משתתפים (מופרדים בפסיק)</label>
        <input id="metaPeople" type="text" value="${currentTrip.people||''}" />

        <label>סוגי טיול</label>
        <div id="metaTypes" class="badges">${typesBtns}</div>

        ${budgetBlockHTML(b)}

        <div class="btn-row" style="margin-top:12px">
          <button id="btnSaveMeta" class="primary">שמור</button>
        </div>
      </div>
    </div>
  `;

  // Bind fields
  ['metaDestination','metaStart','metaEnd','metaPeople'].forEach(id=>{
    $(`#${id}`).addEventListener('input', markMetaDirty);
  });
  $$('#metaTypes .metaType').forEach(btn=>btn.addEventListener('click', ()=>{
    btn.classList.toggle('active'); markMetaDirty();
  }));
  // Budget
  const bUSD = $('#bUSD'), bEUR = $('#bEUR'), bILS = $('#bILS');
  const updateOthers = async (source)=>{
    let usd = clampNumber(bUSD.value);
    let eur = clampNumber(bEUR.value);
    let ils = clampNumber(bILS.value);
    if(currentTrip?.budget?.locked && currentTrip?.budget?.rates){
      const r = currentTrip.budget.rates;
      if(source==='USD'){ bEUR.value = (convert(usd,'USD','EUR',r)).toFixed(2); bILS.value=(convert(usd,'USD','ILS',r)).toFixed(2); }
      if(source==='EUR'){ bUSD.value = (convert(eur,'EUR','USD',r)).toFixed(2); bILS.value=(convert(eur,'EUR','ILS',r)).toFixed(2); }
      if(source==='ILS'){ bUSD.value = (convert(ils,'ILS','USD',r)).toFixed(2); bEUR.value=(convert(ils,'ILS','EUR',r)).toFixed(2); }
    } else {
      const r = await fetchRates('USD'); // base USD
      if(source==='USD'){ bEUR.value = (convert(usd,'USD','EUR',r)).toFixed(2); bILS.value=(convert(usd,'USD','ILS',r)).toFixed(2); }
      if(source==='EUR'){ bUSD.value = (convert(eur,'EUR','USD',r)).toFixed(2); bILS.value=(convert(eur,'EUR','ILS',r)).toFixed(2); }
      if(source==='ILS'){ bUSD.value = (convert(ils,'ILS','USD',r)).toFixed(2); bEUR.value=(convert(ils,'ILS','EUR',r)).toFixed(2); }
    }
  };
  bUSD.addEventListener('input', ()=>{ markMetaDirty(); updateOthers('USD'); });
  bEUR.addEventListener('input', ()=>{ markMetaDirty(); updateOthers('EUR'); });
  bILS.addEventListener('input', ()=>{ markMetaDirty(); updateOthers('ILS'); });

  $('#btnBudgetLock').addEventListener('click', async ()=>{
    if(currentTrip.budget?.locked){
      currentTrip.budget.locked = false;
      toast('נעילה בוטלה','ok');
    } else {
      // lock with current rates
      const r = await fetchRates('USD');
      currentTrip.budget = currentTrip.budget || {};
      currentTrip.budget.rates = r;
      currentTrip.budget.locked = true;
      currentRates = r;
      toast('התקציב ושערי החליפין ננעלו','ok');
    }
    markMetaDirty();
    renderMeta(); // re-render to flip button
  });

  $('#btnSaveMeta').addEventListener('click', async ()=>{
    const dest = $('#metaDestination').value.trim();
    const st = $('#metaStart').value ? Timestamp.fromDate(new Date($('#metaStart').value)) : null;
    const en = $('#metaEnd').value ? Timestamp.fromDate(new Date($('#metaEnd').value)) : null;
    const ppl = $('#metaPeople').value.trim();
    const types = $$('#metaTypes .metaType.active').map(b=>b.dataset.value);
    const bUSDv = clampNumber(bUSD.value,null);
    const bEURv = clampNumber(bEUR.value,null);
    const bILSv = clampNumber(bILS.value,null);
    const budget = {
      USD: bUSDv, EUR: bEURv, ILS: bILSv,
      locked: !!currentTrip?.budget?.locked,
      rates: currentTrip?.budget?.rates || null
    };
    const data = {destination:dest,start:st,end:en,people:ppl,types, budget};
    await updateDoc(doc(db,'users', currentTrip.ownerUid, 'trips', currentTrip.id), data);
    currentTrip = {...currentTrip, ...data};
    metaDirty = false;
    toast('נשמר','ok');
  });
}

// Unsaved changes guard (Meta -> other tabs)
const unsavedModal = $('#unsavedChangesModal');
async function guardMetaBefore(view){
  if(!metaDirty) return true;
  return new Promise(res=>{
    unsavedModal.showModal();
    $('#unsavedCancel').onclick = ()=>{ unsavedModal.close('cancel'); res(false); };
    $('#unsavedDiscard').onclick = ()=>{ metaDirty=false; unsavedModal.close('discard'); res(true); };
    $('#unsavedSave').onclick = async ()=>{
      $('#btnSaveMeta').click();
      await sleep(250);
      unsavedModal.close('save');
      res(true);
    };
  });
}

// ---------- Expenses ----------
let expenseCurrencyView = 'USD';
function renderExpenses(){
  const root = $('#view-expenses');
  root.innerHTML = `
    <div class="budget-bar">
      <div class="btn-row">
        <button id="btnSortExpense" class="chip"><span class="material-symbols-rounded">swap_vert</span> מיין</button>
        ${isReadOnlyShare? '' : '<button id="btnAddExpense" class="soft"><span class="material-symbols-rounded">add</span> הוסף</button>'}
      </div>
      <div class="budget-badges">
        <span class="badge-ghost">תקציב: <strong id="bbBudget">0</strong> <span id="barCurrency" class="badge-click">USD</span></span>
        <span class="badge-ghost">שולם: <strong id="bbSpent">0</strong></span>
        <span class="badge-ghost">יתרה: <strong id="bbLeft">0</strong></span>
      </div>
    </div>
    <div style="height:8px"></div>
    <div class="card">
      <table class="table" id="tblExpenses">
        <thead><tr><th>תיאור</th><th>קטגוריה</th><th>סכום</th><th>מטבע</th><th>הערת שער</th><th></th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  $('#barCurrency').addEventListener('click', ()=>{
    expenseCurrencyView = expenseCurrencyView==='USD' ? 'EUR' : expenseCurrencyView==='EUR' ? 'ILS' : 'USD';
    $('#barCurrency').textContent = expenseCurrencyView;
    fillExpensesTable();
  });

  if(!isReadOnlyShare) $('#btnAddExpense')?.addEventListener('click', ()=>openExpenseModal());
  fillExpensesTable();
}

let expensesCache = [];
let expenseSortAsc = false;

async function fillExpensesTable(){
  // fetch
  if(!currentTrip){ return; }
  try{
    const ref = collection(db,'users', currentTrip.ownerUid, 'trips', currentTrip.id, 'expenses');
    const snap = await getDocs(query(ref, orderBy('createdAt','desc')));
    expensesCache = snap.docs.map(d=>({id:d.id, ...d.data()}));
  }catch(e){ if(isPermError(e)) { expensesCache = []; } else { console.error(e); toast('שגיאה בטעינת הוצאות','error'); } }
  renderExpenseRows();
  computeBudgetBar();
  $('#btnSortExpense')?.addEventListener('click', ()=>{
    expenseSortAsc = !expenseSortAsc; renderExpenseRows();
  });
}

function renderExpenseRows(){
  const tb = $('#tblExpenses tbody');
  const items = [...expensesCache].sort((a,b)=>{
    const da = a.createdAt?.seconds||0, db=b.createdAt?.seconds||0;
    return expenseSortAsc ? da-db : db-da;
  });
  tb.innerHTML = items.map(e=>{
    const showAmt = convert(e.amount||0, e.currency||'USD', expenseCurrencyView, currentTrip?.budget?.rates || currentRates || null).toFixed(2);
    const noteILS = convert(e.amount||0, e.currency||'USD', 'ILS', currentTrip?.budget?.rates || currentRates || null).toFixed(2);
    return `<tr data-id="${e.id}">
      <td>${e.desc||''}</td>
      <td>${e.cat||''}</td>
      <td>${showAmt}</td>
      <td>${expenseCurrencyView}</td>
      <td class="note">${noteILS} ILS (מומר)</td>
      <td>${isReadOnlyShare? '' : '<button class="menu-btn exp-menu"><span class="material-symbols-rounded">more_horiz</span></button>'}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" class="note">אין הוצאות</td></tr>';

  if(!isReadOnlyShare) $$('.exp-menu', tb).forEach(btn=>btn.addEventListener('click', (ev)=>{
    const id = ev.target.closest('tr')?.dataset.id;
    const ex = expensesCache.find(x=>x.id===id);
    openExpenseModal(ex);
  }));
}

function computeBudgetBar(){
  const budgetIn = currentTrip?.budget?.[expenseCurrencyView] || 0;
  const spent = expensesCache.reduce((acc,e)=> acc + convert(e.amount||0, e.currency||'USD', expenseCurrencyView, currentTrip?.budget?.rates || currentRates || null), 0);
  $('#bbBudget').textContent = Number(budgetIn||0).toFixed(2);
  $('#bbSpent').textContent = Number(spent).toFixed(2);
  $('#bbLeft').textContent = Number((budgetIn||0) - spent).toFixed(2);
}

// Expense Modal
const expenseModal = $('#expenseModal');
const expDesc = $('#expDesc');
const expCat = $('#expCat');
const expAmount = $('#expAmount');
const expCurrency = $('#expCurrency');
const expLocationName = $('#expLocationName');
const expLat = $('#expLat');
const expLng = $('#expLng');
const expTitle = $('#expenseTitle');
const expSave = $('#expSave');
const expDelete = $('#expDelete');

function openExpenseModal(existing=null){
  expTitle.textContent = existing ? 'עריכת הוצאה' : 'הוצאה חדשה';
  expDesc.value = existing?.desc || '';
  expCat.value = existing?.cat || 'אחר';
  expAmount.value = existing?.amount ?? '';
  expCurrency.value = existing?.currency || 'USD';
  expLocationName.value = existing?.locName || '';
  expLat.value = existing?.lat ?? '';
  expLng.value = existing?.lng ?? '';
  expDelete.classList.toggle('hidden', !existing);
  expenseModal.showModal();

  expenseModal.addEventListener('close', async ()=>{
    const action = expenseModal.returnValue;
    if(action === 'save'){
      const payload = {
        desc: expDesc.value.trim(),
        cat: expCat.value,
        amount: clampNumber(expAmount.value, 0),
        currency: expCurrency.value,
        locName: expLocationName.value.trim() || null,
        lat: expLat.value ? Number(expLat.value) : null,
        lng: expLng.value ? Number(expLng.value) : null,
        createdAt: serverTimestamp()
      };
      if(existing){
        await updateDoc(doc(db,'users', currentTrip.ownerUid, 'trips', currentTrip.id, 'expenses', existing.id), payload);
        toast('עודכן','ok');
      }else{
        await addDoc(collection(db,'users', currentTrip.ownerUid, 'trips', currentTrip.id, 'expenses'), payload);
        toast('נוסף','ok');
      }
      await fillExpensesTable();
    } else if(action === 'delete' && existing){
      const ok = await confirmDelete(); if(!ok) return;
      await deleteDoc(doc(db,'users', currentTrip.ownerUid, 'trips', currentTrip.id, 'expenses', existing.id));
      toast('נמחק','ok'); await fillExpensesTable();
    }
  }, {once:true});
}

// ---------- Map Picker (shared with journal) ----------
const mapSelectModal = $('#mapSelectModal');
const btnSavePickedLocation = $('#btnSavePickedLocation');
let selectMap = null;
let selectMarker = null;
let targetLatInput = null;
let targetLngInput = null;
let targetNameInput = null;

$('#btnSelectExpLocation').addEventListener('click', (ev)=>{
  ev.preventDefault();
  openMapPicker(expLat, expLng, expLocationName);
});
$('#btnUseCurrentExp').addEventListener('click', async (ev)=>{
  ev.preventDefault();
  await fillCurrentLocation(expLat, expLng, expLocationName);
});

document.getElementById('btnSelectJrLocation').addEventListener('click', function(ev){
  ev.preventDefault();
  openMapPicker(document.getElementById('jrLat'), document.getElementById('jrLng'), document.getElementById('jrLocationName'));
});
document.getElementById('btnUseCurrentJr').addEventListener('click', function(ev){
  ev.preventDefault();
  fillCurrentLocation(document.getElementById('jrLat'), document.getElementById('jrLng'), document.getElementById('jrLocationName'));
});

async function openMapPicker(latInput, lngInput, nameInput){
  targetLatInput = latInput; targetLngInput = lngInput; targetNameInput = nameInput;
  mapSelectModal.showModal();
  await sleep(50);
  if(!selectMap){
    selectMap = L.map('selectMap').setView([31.771959, 35.217018], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap'
    }).addTo(selectMap);
  }
  if(selectMarker) selectMap.removeLayer(selectMarker);
  const lat = latInput.value ? Number(latInput.value) : 31.78;
  const lng = lngInput.value ? Number(lngInput.value) : 35.21;
  selectMarker = L.marker([lat, lng], {draggable:true}).addTo(selectMap);
  selectMarker.on('dragend', async ()=>{
    const p = selectMarker.getLatLng(); targetLatInput.value = p.lat.toFixed(6); targetLngInput.value = p.lng.toFixed(6);
    try{
      const name = await reverseGeocode(p.lat, p.lng);
      if(name) targetNameInput.value = name;
    }catch{}
  });
  selectMap.setView([lat,lng], 12);
}

btnSavePickedLocation.addEventListener('click', (ev)=>{
  ev.preventDefault();
  if(selectMarker){
    const p = selectMarker.getLatLng();
    targetLatInput.value = p.lat.toFixed(6);
    targetLngInput.value = p.lng.toFixed(6);
  }
  mapSelectModal.close('save');
});

async function fillCurrentLocation(latInput, lngInput, nameInput){
  if(!navigator.geolocation){ toast('Geolocation לא נתמך','error'); return; }
  navigator.geolocation.getCurrentPosition(async (pos)=>{
    const {latitude, longitude} = pos.coords;
    latInput.value = latitude.toFixed(6);
    lngInput.value = longitude.toFixed(6);
    try{
      const name = await reverseGeocode(latitude, longitude);
      if(name) nameInput.value = name;
    }catch{}
    toast('מיקום נקלט','ok');
  }, ()=> toast('לא ניתן לאתר מיקום','error'));
}

async function reverseGeocode(lat, lon){
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`, {
    headers: {'Accept':'application/json'}
  });
  if(!res.ok) return null;
  const j = await res.json();
  return j.display_name || null;
}

// ---------- Journal ----------
function renderJournal(){
  const root = $('#view-journal');
  root.innerHTML = `
    <div class="btn-row" style="margin-bottom:8px">
      ${isReadOnlyShare ? '' : '<button id="btnAddJournal" class="soft"><span class="material-symbols-rounded">add</span> הוסף רישום</button>'}
    </div>
    <div class="card">
      <table class="table" id="tblJournal">
        <thead><tr><th>תאריך</th><th>תיאור</th><th>מיקום</th><th></th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  `;
  if(!isReadOnlyShare) $('#btnAddJournal')?.addEventListener('click', ()=>openJournalModal());
  fillJournalTable();
}

let journalCache = [];
let journalSortAsc = false;

async function fillJournalTable(){
  if(!currentTrip){ return; }
  try{
    const ref = collection(db,'users', currentTrip.ownerUid, 'trips', currentTrip.id, 'journal');
    const snap = await getDocs(query(ref, orderBy('createdAt','desc')));
    journalCache = snap.docs.map(d=>({id:d.id, ...d.data()}));
  }catch(e){ if(isPermError(e)) { journalCache = []; } else { console.error(e); toast('שגיאה בטעינת יומן','error'); } }
  renderJournalRows();
}

function renderJournalRows(){
  const tb = $('#tblJournal tbody');
  const items = [...journalCache].sort((a,b)=>{
    const da = a.createdAt?.seconds||0, db=b.createdAt?.seconds||0;
    return journalSortAsc ? da-db : db-da;
  });
  tb.innerHTML = items.map(j=>{
    const html = parseLinks(j.text||'');
    return `<tr data-id="${j.id}">
      <td>${fmtDate(j.createdAt)}</td>
      <td>${html}</td>
      <td>${j.locName||''}</td>
      <td>${isReadOnlyShare? '' : '<button class="menu-btn jr-menu"><span class="material-symbols-rounded">more_horiz</span></button>'}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="4" class="note">אין רישומים</td></tr>';

  if(!isReadOnlyShare) $$('.jr-menu', tb).forEach(btn=>btn.addEventListener('click', (ev)=>{
    const id = ev.target.closest('tr')?.dataset.id;
    const jr = journalCache.find(x=>x.id===id);
    openJournalModal(jr);
  }));
}

// Journal modal
const journalModal = $('#journalModal');
const jrText = $('#jrText');
const jrLocationName = $('#jrLocationName');
const jrLat = $('#jrLat');
const jrLng = $('#jrLng');
const jrTitle = $('#journalTitle');
const jrSave = $('#jrSave');
const jrDelete = $('#jrDelete');

function openJournalModal(existing=null){
  jrTitle.textContent = existing ? 'עריכת רישום' : 'רישום חדש';
  jrText.value = existing?.text || '';
  jrLocationName.value = existing?.locName || '';
  jrLat.value = existing?.lat ?? '';
  jrLng.value = existing?.lng ?? '';
  jrDelete.classList.toggle('hidden', !existing);
  journalModal.showModal();

  journalModal.addEventListener('close', async ()=>{
    const action = journalModal.returnValue;
    if(action === 'save'){
      const payload = {
        text: jrText.value.trim(),
        locName: jrLocationName.value.trim() || null,
        lat: jrLat.value ? Number(jrLat.value) : null,
        lng: jrLng.value ? Number(jrLng.value) : null,
        createdAt: serverTimestamp()
      };
      if(existing){
        await updateDoc(doc(db,'users', currentTrip.ownerUid, 'trips', currentTrip.id, 'journal', existing.id), payload);
        toast('עודכן','ok');
      }else{
        await addDoc(collection(db,'users', currentTrip.ownerUid, 'trips', currentTrip.id, 'journal'), payload);
        toast('נוסף','ok');
      }
      await fillJournalTable();
    } else if(action === 'delete' && existing){
      const ok = await confirmDelete(); if(!ok) return;
      await deleteDoc(doc(db,'users', currentTrip.ownerUid, 'trips', currentTrip.id, 'journal', existing.id));
      toast('נמחק','ok'); await fillJournalTable();
    }
  }, {once:true});
}

// ---------- Maps ----------
let bigMap = null;
let miniMap = null;
let markersSpent = [];
let markersVisited = [];

async function renderMap(small=false){
  // load points
  const [exps, jrs] = await Promise.all([
    getDocs(query(collection(db,'users', currentTrip.ownerUid, 'trips', currentTrip.id, 'expenses'))),
    getDocs(query(collection(db,'users', currentTrip.ownerUid, 'trips', currentTrip.id, 'journal')))
  ]);
  const expPts = exps.docs.map(d=>d.data()).filter(x=>x.lat && x.lng);
  const jrPts  = jrs.docs.map(d=>d.data()).filter(x=>x.lat && x.lng);

  const mapId = small ? 'miniMap' : 'bigMap';
  const mapEl = document.getElementById(mapId);
  if(!mapEl){ // mount container if needed
    $('#view-map').innerHTML = `<div id="bigMap" class="map"></div>
      <div class="btn-row" style="margin-top:8px">
        <button id="btnToggleSpent" class="chip"><span class="material-symbols-rounded">payments</span> איפה ביזבזתי</button>
        <button id="btnToggleVisited" class="chip"><span class="material-symbols-rounded">hiking</span> איפה טיילתי</button>
      </div>`;
  }

  const theMap = L.map(mapId).setView([31.771959, 35.217018], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  }).addTo(theMap);

  function addMarkers(points, color){
    return points.map(p=>{
      const m = L.circleMarker([p.lat, p.lng], {radius:7, color:color, fillColor:color, fillOpacity:.7}).addTo(theMap);
      m.bindPopup(p.locName || 'ללא שם');
      return m;
    });
  }

  const spent = addMarkers(expPts, '#F59E0B');     // orange
  const visited = addMarkers(jrPts, '#60A5FA');   // blue

  if(small){
    miniMap = theMap;
  }else{
    bigMap = theMap;
    markersSpent = spent;
    markersVisited = visited;
    // Fit bounds
    const all = [...expPts, ...jrPts];
    if(all.length){
      const bounds = L.latLngBounds(all.map(p=>[p.lat,p.lng]));
      theMap.fitBounds(bounds, {padding:[30,30]});
    }
    // toggles
    $('#btnToggleSpent').addEventListener('click', ()=>{
      const vis = markersSpent[0]?.options.opacity !== 0;
      markersSpent.forEach(m=>m.setStyle({opacity: vis?0:1, fillOpacity: vis?0:0.7}));
    });
    $('#btnToggleVisited').addEventListener('click', ()=>{
      const vis = markersVisited[0]?.options.opacity !== 0;
      markersVisited.forEach(m=>m.setStyle({opacity: vis?0:1, fillOpacity: vis?0:0.7}));
    });
  }
}

// ---------- Share / Import / Export ----------
function renderShare(){
  const root = $('#view-share');
  const shared = currentTrip?.shared?.enabled && currentTrip?.shared?.token;
  const link = shared ? `${location.origin}${location.pathname}?share=${currentTrip.shared.token}` : '';
  root.innerHTML = `
    <div class="card">
      <h3>ייבוא JSON</h3>
      <input id="importFile" type="file" accept=".json,application/json"/>
      <div class="btn-row" style="margin-top:8px">
        <button id="btnImport" class="soft">ייבא</button>
      </div>
    </div>

    <div class="row" style="margin-top:10px">
      <div class="card" style="flex:1 1 320px">
        <h3>ייצוא</h3>
        <label><input id="exportWithExpenses" type="checkbox" checked/> לכלול הוצאות</label>
        <div class="btn-row" style="margin-top:8px; flex-wrap:wrap">
          <button id="btnExportPDF" class="chip"><span class="material-symbols-rounded">picture_as_pdf</span> PDF</button>
          <button id="btnExportExcel" class="chip"><span class="material-symbols-rounded">table</span> Excel</button>
          <button id="btnExportWord" class="chip"><span class="material-symbols-rounded">description</span> Word</button>
          <button id="btnExportGPX" class="chip"><span class="material-symbols-rounded">pin_drop</span> GPX</button>
        </div>
      </div>

      <div class="card" style="flex:1 1 320px">
        <h3>שיתוף</h3>
        <div class="btn-row" style="margin-bottom:8px">
          <button id="btnEnableShare" class="soft">${shared? 'חדש קישור' : 'הפעל שיתוף'}</button>
          <button id="btnDisableShare" class="ghost" ${shared?'':'disabled'}>בטל שיתוף</button>
        </div>
        <input id="shareLink" type="text" readonly value="${link}" placeholder="קישור יופיע כאן כששיתוף פעיל"/>
        <div class="btn-row" style="margin-top:8px">
          <button id="btnCopyShare" class="primary" ${shared?'':'disabled'}>העתק קישור</button>
        </div>
      </div>
    </div>
  `;

  // Import
  $('#btnImport').addEventListener('click', async ()=>{
    const f = $('#importFile').files?.[0];
    if(!f){ toast('לא נבחר קובץ','error'); return; }
    const text = await f.text();
    let json = null;
    try{ json = JSON.parse(text); }catch{ toast('קובץ לא תקין','error'); return; }
    if(!confirm('להחליף את הנתונים בטיול הנוכחי?')) return;
    await setDoc(doc(db,'users', currentTrip.ownerUid, 'trips', currentTrip.id), json, {merge:true});
    toast('יובא בהצלחה','ok');
  });

  // Export
  $('#btnExportPDF').addEventListener('click', ()=>exportPDF());
  $('#btnExportExcel').addEventListener('click', ()=>exportExcel());
  $('#btnExportWord').addEventListener('click', ()=>exportWord());
  $('#btnExportGPX').addEventListener('click', ()=>exportGPX());

  // Share
  $('#btnEnableShare').addEventListener('click', async ()=>{
    const token = uid();
    const shared = {enabled:true, token};
    await updateDoc(doc(db,'users', currentTrip.ownerUid, 'trips', currentTrip.id), {shared});
    // mirror to global collection for share lookup
    await setDoc(doc(db,'sharedTrips', token), {token, ownerUid: currentTrip.ownerUid, tripId: currentTrip.id});
    currentTrip.shared = shared;
    renderShare();
    toast('שיתוף הופעל','ok');
  });
  $('#btnDisableShare').addEventListener('click', async ()=>{
    if(!currentTrip.shared?.token) return;
    await updateDoc(doc(db,'users', currentTrip.ownerUid, 'trips', currentTrip.id), {shared:{enabled:false, token:null}});
    await deleteDoc(doc(db,'sharedTrips', currentTrip.shared.token));
    currentTrip.shared = {enabled:false, token:null};
    renderShare();
    toast('שיתוף בוטל','ok');
  });
  $('#btnCopyShare').addEventListener('click', ()=>{
    if(currentTrip.shared?.token){
      const link = `${location.origin}${location.pathname}?share=${currentTrip.shared.token}`;
      copyToClipboard(link);
    }
  });
}

// ---------- Exporters ----------
async function exportPDF(){
  const { jsPDF } = window.jspdf;
  const docpdf = new jsPDF({orientation:'p', unit:'pt'});
  docpdf.setFont('helvetica','bold'); docpdf.setFontSize(16);
  docpdf.text(`טיול: ${currentTrip.destination||''}`, 40, 40);
  docpdf.setFont('helvetica','normal'); docpdf.setFontSize(12);
  docpdf.text(`תאריכים: ${fmtDate(currentTrip.start)}–${fmtDate(currentTrip.end)}`, 40, 64);
  docpdf.text(`משתתפים: ${currentTrip.people||''}`, 40, 84);

  // Expenses table
  const includeExp = $('#exportWithExpenses').checked;
  if(includeExp && expensesCache.length){
    const rows = expensesCache.map(e=>[e.desc||'', e.cat||'', (e.amount||0).toFixed(2), e.currency||'']);
    docpdf.autoTable({head:[['תיאור','קטגוריה','סכום','מטבע']], body: rows, startY: 110});
  }
  docpdf.save(`flymily_${currentTrip.destination||'trip'}.pdf`);
}

async function exportExcel(){
  const wb = XLSX.utils.book_new();
  // Meta
  const meta = {
    Destination: currentTrip.destination||'',
    Start: fmtDate(currentTrip.start),
    End: fmtDate(currentTrip.end),
    People: currentTrip.people||'',
    Types: (currentTrip.types||[]).join(',')
  };
  const wsMeta = XLSX.utils.json_to_sheet([meta]);
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Meta');

  // Expenses
  if(expensesCache.length){
    const rows = expensesCache.map(e=>({Desc:e.desc, Cat:e.cat, Amount:e.amount, Currency:e.currency, Loc:e.locName}));
    const wsE = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, wsE, 'Expenses');
  }
  // Journal
  if(journalCache.length){
    const rows = journalCache.map(j=>({Date:fmtDate(j.createdAt), Text:j.text, Loc:j.locName}));
    const wsJ = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, wsJ, 'Journal');
  }
  XLSX.writeFile(wb, `flymily_${currentTrip.destination||'trip'}.xlsx`);
}

async function exportWord(){
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = window.docx;
  const docx = new Document({
    sections: [{
      children: [
        new Paragraph({ text: `טיול: ${currentTrip.destination||''}`, heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ text: `תאריכים: ${fmtDate(currentTrip.start)}–${fmtDate(currentTrip.end)}` }),
        new Paragraph({ text: `משתתפים: ${currentTrip.people||''}` }),
        new Paragraph({ text: ' ' }),
        new Paragraph({ text: 'יומן:' }),
        ...journalCache.slice(0,100).map(j=> new Paragraph({ children: [new TextRun({text:`• ${fmtDate(j.createdAt)} — ${j.text||''}`})] }))
      ]
    }]
  });
  const blob = await Packer.toBlob(docx);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `flymily_${currentTrip.destination||'trip'}.docx`;
  a.click();
}

async function exportGPX(){
  const points = [
    ...expensesCache.filter(e=>e.lat && e.lng).map(e=>({lat:e.lat, lon:e.lng, name:e.locName||'Expense'})),
    ...journalCache.filter(j=>j.lat && j.lng).map(j=>({lat:j.lat, lon:j.lng, name:j.locName||'Journal'}))
  ];
  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="FLYMILY">
${points.map(p=>`  <wpt lat="${p.lat}" lon="${p.lon}"><name>${p.name}</name></wpt>`).join('\n')}
</gpx>`;
  const blob = new Blob([gpx], {type:'application/gpx+xml'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `flymily_${currentTrip.destination||'trip'}.gpx`;
  a.click();
}

// ---------- Confirm Delete ----------
const confirmDeleteModal = $('#confirmDeleteModal');
function confirmDelete(){
  return new Promise(res=>{
    confirmDeleteModal.showModal();
    $('#confirmDeleteYes').onclick = ()=>{ confirmDeleteModal.close('delete'); res(true); };
    confirmDeleteModal.addEventListener('close', ()=>{
      res(confirmDeleteModal.returnValue==='delete');
    }, {once:true});
  });
}
