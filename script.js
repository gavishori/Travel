// === Auth Button Toggle (Login <-> Logout) ===
function wireAuthPrimaryButton(){
  const btn = document.getElementById('btnLogin'); // header primary button
  if(!btn) return;
  if(btn.dataset.authWired==='1') return;
  btn.dataset.authWired='1';
  const doLogout = async (e)=>{
    try{ e?.preventDefault?.(); e?.stopPropagation?.(); }catch(_){}
    try{
      if(typeof FB!=='undefined' && typeof FB.signOut==='function'){ await FB.signOut(FB.auth); }
      else if(typeof signOutUser==='function'){ await signOutUser(); }
      else if(typeof FB?.auth?.signOut==='function'){ await FB.auth.signOut(); }
    }catch(err){ console.error('primary logout failed', err); }
  };
  // Swap handlers on auth changes
  window.__authPrimarySwap = (loggedIn)=>{
    const old = document.getElementById('btnLogin');
    if(!old) return;
    const clone = old.cloneNode(true);
    old.parentNode.replaceChild(clone, old);
    const target = document.getElementById('btnLogin');
    if(!target) return;
    if(loggedIn){
      target.textContent = 'ניתוק';
      target.classList.add('danger');
      target.addEventListener('click', doLogout, {passive:false});
    } else {
      target.textContent = 'התחברות';
      target.classList.remove('danger');
    }
  };
}
document.addEventListener('DOMContentLoaded', wireAuthPrimaryButton);

// --- ensure "מחק נבחרים" button exists in Journal tab even if HTML not updated ---
(function(){
  document.addEventListener('DOMContentLoaded', ()=>{
    const view = document.getElementById('view-journal');
    if(!view) return;
    const actions = view.querySelector('.list-actions');
    if(!actions) return;
    let btn = document.getElementById('btnDeleteSelectedJournal');
    let cancelBtn = document.getElementById('btnCancelSelectionJournal');
    if(!btn){
      btn = document.createElement('button');
      btn.id = 'btnDeleteSelectedJournal';
      btn.className = 'btn danger';
      btn.textContent = 'מחק נבחרים';
      actions.insertBefore(btn, actions.querySelector('#btnSortJournal')?.nextSibling || null);
      if(!cancelBtn){
        cancelBtn = document.createElement('button');
        cancelBtn.id = 'btnCancelSelectionJournal';
        cancelBtn.className = 'btn';
        cancelBtn.textContent = 'בטל בחירה';
        cancelBtn.style.display = 'none';
        actions.insertBefore(cancelBtn, btn.nextSibling);
      }
    }
  });
})();
// --- end ensure button ---

async function loadJournalOnly(){
  const tid = state.currentTripId;
  if(!tid) return;
  const ref = FB.doc(db, 'trips', tid);
  const snap = await FB.getDoc(ref);
  if(!snap.exists()) return;
  const t = snap.data() || {};
  if(!state.current) state.current = { id: tid };
  state.current.journal = t.journal || {};  /*__JR_DT_BLOCK__*/
  const $jrD = document.getElementById('jrDate');
  const $jrT = document.getElementById('jrTime');
  let _jr_dateIso;
  if ($jrD && $jrT && $jrD.value && $jrT.value) {
    _jr_dateIso = new Date(`${$jrD.value}T${$jrT.value}:00`).toISOString();
  } else {
    const curJ = (t.journal && t.journal[id]) || {};
    _jr_dateIso = curJ.dateIso || curJ.createdAt || new Date().toISOString();
  }
  const __jr_dt = new Date(_jr_dateIso);
  const __pad2 = n=>String(n).padStart(2,'0');
  const __jr_dateStr = `${__pad2(__jr_dt.getDate())}/${__pad2(__jr_dt.getMonth()+1)}/${__pad2(__jr_dt.getFullYear())}`;
  const __jr_timeStr = `${__pad2(__jr_dt.getHours())}:${__pad2(__jr_dt.getMinutes())}`;

  renderJournal(state.current, state.journalSort);
}

import { auth, db, FB } from './firebase.js';

// === Textarea auto-resize + safe Enter handling ===
(function(){
  function autoResize(el){
    if(!el) return;
    el.style.height = 'auto';
    const h = Math.min(el.scrollHeight, 420);
    el.style.height = h + 'px';
  }
  function bindAutoResize(el){
    if(!el || el.dataset._autoResizeBound) return;
    el.dataset._autoResizeBound = '1';
    autoResize(el);
    el.addEventListener('input', ()=>autoResize(el));
  }
  // bind on DOM ready and whenever modals open
  document.addEventListener('DOMContentLoaded', ()=>{
    bindAutoResize(document.getElementById('expDesc'));
    // bindAutoResize skipped for contenteditable jrText
  });

  // Enter behavior inside modals:
  //  - Enter never saves by accident
  //  - Ctrl/Cmd + Enter triggers save
  document.addEventListener('keydown', (e)=>{
    const anyOpen = (m)=>{ const d=document.getElementById(m); return d && d.open; };
    if(!(anyOpen('expenseModal')||anyOpen('journalModal'))) return;
    const tag = (document.activeElement && document.activeElement.tagName)||'';
    const isTextarea = tag.toLowerCase()==='textarea';
    if(e.key === 'Enter' && !e.shiftKey){
      if(e.ctrlKey || e.metaKey){
        // commit explicitly
        if(anyOpen('expenseModal')) document.getElementById('expSave')?.click();
        if(anyOpen('journalModal')) document.getElementById('jrSave')?.click();
        e.preventDefault();
      }else if(!isTextarea){
        // prevent accidental submit
        e.preventDefault();
      }
    }
  });

  // Expose to modal openers to (re)bind
  window._bindTextareasForModals = function(){
    bindAutoResize(document.getElementById('expDesc'));
    // bindAutoResize skipped for contenteditable jrText
  };
})();
// === End textarea helpers ===
// === ensureExpenseCurrencyOption: global-safe ===
(function () {
  const root = (typeof window !== 'undefined') ? window : globalThis;
  function ensureExpenseCurrencyOption(localCode) {
    try {
      const lc = localCode ||
        (root.state && (root.state.localCurrency || (root.state.current && root.state.current.localCurrency))) ||
        'USD';
      if (!lc) return;
      const selects = Array.from(document.querySelectorAll(
        'select[id*="curr"], select[name*="curr"], select[id*="Currency"], select[name*="Currency"]'
      ));
      selects.forEach(sel => {
        const exists = Array.from(sel.options).some(o => {
          const t = (o.textContent || o.innerText || '').trim().toUpperCase();
          return o.value === lc || t === lc || t.includes(lc.toUpperCase());
        });
        if (!exists) sel.add(new Option(lc, lc, false, false));
      });
    } catch (e) { console.debug('ensureExpenseCurrencyOption guard:', e); }
  }
  root.ensureExpenseCurrencyOption = ensureExpenseCurrencyOption;
})();

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
function toast(msg){ const t=document.getElementById('toast'); if(!t) { alert(msg); return; } t.textContent=msg; t.className='toast show'; setTimeout(()=>t.classList.remove('show'), 2200); }

// === Currency conversion helpers ===

function rateMatrix(r){
  const USDEUR = Number((r && r.USDEUR) ?? (state?.rates?.USDEUR) ?? 0.92);
  const USDILS = Number((r && r.USDILS) ?? (state?.rates?.USDILS) ?? 3.7);
  const USDLocal = Number((r && r.USDLocal) ?? (state?.rates?.USDLocal) ?? 1);
  const LC = state.current?.localCurrency;
  const M = {
    USD: { USD:1, EUR:USDEUR, ILS:USDILS, ...(LC ? { [LC]: USDLocal } : {}) },
    EUR: { USD:1/USDEUR, EUR:1, ILS:USDILS/USDEUR, ...(LC ? { [LC]: USDLocal/USDEUR } : {}) },
    ILS: { USD:1/USDILS, EUR:USDEUR/USDILS, ILS:1, ...(LC ? { [LC]: USDLocal/USDILS } : {}) }
  };
  if (LC) {
    M[LC] = { 
      USD: USDLocal ? 1/USDLocal : 1,
      EUR: USDLocal && USDEUR ? USDEUR/USDLocal : 1,
      ILS: USDLocal && USDILS ? USDILS/USDLocal : 1,
      [LC]: 1
    };
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

var state = state || {};
// === End helpers ===

function invalidateMap(m){
  try{ if(m && m.invalidateSize){ m.invalidateSize(); } }catch(e){}
}

// === Map popup helpers ===
function switchToTab(tab){
  try{
    const btn = document.querySelector(`#tabs button[data-tab="${tab}"]`);
    if(!btn) return;
    // emulate click
    const currentTab = document.querySelector('#tabs button.active');
    if(currentTab && currentTab.dataset.tab === 'meta' && state.isDirty){
      // if blocked by unsaved modal, just fallback to click which will trigger modal logic
      btn.click();
      return;
    }
    if (btn.dataset.tab !== 'all') { // If switching to a single view, hide others
      document.querySelectorAll('#tabs button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tabview').forEach(v=> v.hidden = true);
      const v = document.querySelector('#view-'+tab);
      if(v) v.hidden = false;
    }
    if(tab==='map') setTimeout(initBigMap,50);
/* patched switchToTab */
try{
  const views = document.querySelectorAll('.tabview');
  views.forEach(v=>{ v.removeAttribute('data-active'); v.hidden = true; });
  const cur = document.getElementById('view-'+tab);
  if(!cur){ console.warn('View not found:', tab); }
  else { cur.setAttribute('data-active','1'); cur.hidden = false; }
}catch(e){ console.error(e); }
/* end patched switchToTab */

    try{
      document.querySelectorAll('.tabview').forEach(v=>v.removeAttribute('data-active'));
      const v = document.querySelector('#view-'+tab);
      if(v){ v.setAttribute('data-active','1'); }
    }catch(e){}

    // toggle no-scroll when entering/leaving share tab
    try{
      const rootEls=[document.documentElement, document.body];
      if(tab==='share'){ rootEls.forEach(el=>el.classList.add('share-open')); }
      else { rootEls.forEach(el=>el.classList.remove('share-open')); }
    }catch(_e){}

    if(tab==='overview') { setTimeout(()=> { try{ initBigMap(); }catch(_){} initMiniMap(state.current||{}); invalidateMap(state.maps?.mini); }, 80);}
  }catch(e){}
}

function focusItemInTab(type, id){
  const tab = (type==='expense') ? 'expenses' : 'journal';
  switchToTab(tab);
  // allow render to complete
  setTimeout(()=>{
    if(type==='expense'){
      const el = document.querySelector(`.exp-item[data-id="${id}"]`);
      if(el){
        el.scrollIntoView({behavior:'smooth', block:'center'});
        el.classList.add('flash-green');
        setTimeout(()=> el.classList.remove('flash-green'), 5000);
      }
      return;
    }
    // Journal: highlight the whole record block (header + notes row)
    const head = document.querySelector(`#tblJournal .exp-item[data-id="${id}"]`);
    const notes = head ? head.nextElementSibling : null;
    const list = [head, notes].filter(Boolean);
    if(list.length){
      (head || list[0]).scrollIntoView({behavior:'smooth', block:'center'});
      list.forEach(n => n.classList.add('flash-green'));
      setTimeout(()=> list.forEach(n => n.classList.remove('flash-green')), 5000);
    }
  }, 150);
}

function attachMapPopup(marker, type, id, dataObj){
  try{
    const isExp = (type==='expense');
    const date = fmtDateTime(dataObj.dateIso || dataObj.createdAt || dataObj.ts || dataObj.date);
    const place = placeLinkHtml(dataObj);
    const amountLine = isExp ? `<div><strong>סכום:</strong> ${esc(dataObj.amount||'')} ${esc(dataObj.currency||'')}</div>` : '';
    const catLine = isExp ? `<div><strong>קטגוריה:</strong> ${esc(dataObj.category||'')}</div>` : '';
    const textLine = !isExp ? `<div class="muted">${linkifyText(dataObj.text||'')}</div>` : '';
    const html = `
      <div class="map-popup">
        <div><strong>${isExp?'הוצאה':'יומן'}</strong></div>
        <div><strong>תאריך:</strong> ${esc(date||'')}</div>
        ${amountLine}
        ${catLine}
        <div><strong>מקום:</strong> ${place}</div>
        ${textLine}
        <div class="popup-actions" style="display:flex;gap:.5rem;margin-top:.5rem;">
          <button class="btn small" data-act="show" data-type="${isExp?'expense':'journal'}" data-id="${id}">הצג</button>
          ${state.shared.readOnly ? '' : `<button class="btn small" data-act="edit" data-type="${isExp?'expense':'journal'}" data-id="${id}">ערוך</button>`}
        </div>
      </div>`;
    marker.bindPopup(html);
    marker.on('popupopen', (ev)=>{
      const root = ev.popup.getElement();
      if(!root) return;
      const showBtn = root.querySelector('button[data-act="show"]');
      if(showBtn){
        showBtn.addEventListener('click', (e)=>{
          e.preventDefault();
          focusItemInTab(showBtn.dataset.type, showBtn.dataset.id);
        });
      }
      const editBtn = root.querySelector('button[data-act="edit"]');
      if(editBtn){
        editBtn.addEventListener('click', (e)=>{
          e.preventDefault();
          const tid = state.currentTripId;
          if(!tid) return;
          const obj = (editBtn.dataset.type==='expense')
            ? (state._lastTripObj?.expenses?.[id])
            : (state._lastTripObj?.journal?.[id]);
          if(editBtn.dataset.type==='expense') openExpenseModal({...obj, id});
          else openJournalModal({...obj, id});
        });
      }
    });
  }catch(e){}
}
// === End map popup helpers ===

// === Filter modal helpers ===
function seedExpenseCategoriesSelect(sel){
  try{
    if(!sel) return;
    sel.innerHTML = '<option value="">הכול</option>';
    const cats = (state.categories?.expenses) || ['טיסה','לינה','תקשורת','רכב','ביטוח בריאות','מזון - מסעדות / סופר','קניות','אטרקציות','תחבורה','אחר'];
    cats.forEach(c=>{
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      sel.appendChild(opt);
    });
  }catch(e){}
}
function openFilterModal(){
  const d = document.getElementById('filterModal');
  if(!d) return;
  seedExpenseCategoriesSelect(document.getElementById('filterCat'));
  document.getElementById('filterCat').value = state.filters?.expenseCat || '';
  d.showModal();
}
function applyExpenseFilter(){
  const val = (document.getElementById('filterCat')?.value)||'';
  state.filters = state.filters || {};
  state.filters.expenseCat = val;
  document.getElementById('filterModal')?.close();
  if(state._lastTripObj) renderExpenses(state._lastTripObj);
}
function clearExpenseFilter(){
  if(state.filters) state.filters.expenseCat = '';
  document.getElementById('filterModal')?.close();
  if(state._lastTripObj) renderExpenses(state._lastTripObj);
}
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('btnFilterExpenses')?.addEventListener('click', openFilterModal);
  document.getElementById('filterApply')?.addEventListener('click', applyExpenseFilter);
  document.getElementById('filterClear')?.addEventListener('click', clearExpenseFilter);
});
// === End Filter modal helpers ===

// --- wiring for Expense Filter buttons (idempotent) ---
function wireExpenseFilterButtons(){
  const b = document.querySelector('#btnFilterExpenses');
  if (b && !b.dataset.wiredFilter) {
    b.dataset.wiredFilter = '1';
    b.addEventListener('click', openFilterModal);
  }
  const a = document.querySelector('#filterApply');
  if (a && !a.dataset.wiredFilter) {
    a.dataset.wiredFilter = '1';
    a.addEventListener('click', applyExpenseFilter);
  }
  const c = document.querySelector('#filterClear');
  if (c && !c.dataset.wiredFilter) {
    c.dataset.wiredFilter = '1';
    c.addEventListener('click', clearExpenseFilter);
  }
}
document.addEventListener('DOMContentLoaded', wireExpenseFilterButtons);


// Initialize small (overview) map with journal + expense markers
function initMiniMap(t){
  try{
    // Create map once
    if(!state.maps.mini){
      state.maps.mini = L.map('miniMap', { zoomControl: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' })
        .addTo(state.maps.mini);
    }
    // Clear previous layers
    if(state.maps.layers?.miniGroup){
      state.maps.mini.removeLayer(state.maps.layers.miniGroup);
    }
    const group = L.layerGroup().addTo(state.maps.mini);
    state.maps.layers = state.maps.layers || {};
    state.maps.layers.miniGroup = group;

    const pts = [];
    // Expenses markers
    Object.entries(t.expenses||{}).forEach(([id,e])=>{
      if(typeof e.lat==='number' && typeof e.lng==='number'){
        pts.push([e.lat, e.lng]);
        L.circleMarker([e.lat,e.lng], { radius:4, color:'#1a73e8' }).addTo(group);
      }
    });
    // Journal markers
    Object.entries(t.journal||{}).forEach(([id,j])=>{
      if(typeof j.lat==='number' && typeof j.lng==='number'){
        pts.push([j.lat, j.lng]);
        ((m=>{attachMapPopup(m,'journal', id, j); m.addTo(group);}))(L.circleMarker([j.lat,j.lng], { radius:4, color:'#34a853' }))
      }
    });

    if(pts.length){
      const b = L.latLngBounds(pts);
      state.maps.mini.fitBounds(b.pad(0.2));
    }else{
      state.maps.mini.setView([32.0853,34.7818], 6);
    }
    invalidateMap(state.maps.mini);
  }catch(e){ console.error('initMiniMap error', e); }
}

// Initialize big map (map tab) and reuse same data set when switching
function initBigMap() {
  const emailSpan = document.getElementById('currentUserEmail');

  try{
    if(!state.maps.big){
      state.maps.big = L.map('bigMap');
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(state.maps.big);
    }
    const ref = state.currentTripId;
    if(!ref){ invalidateMap(state.maps.big); return; }

    state.maps.layers = state.maps.layers || {};
    if(state.maps.layers.expenses){ state.maps.big.removeLayer(state.maps.layers.expenses); }
    if(state.maps.layers.journal){  state.maps.big.removeLayer(state.maps.layers.journal); }

    const expensesLG = L.layerGroup();
    const journalLG  = L.layerGroup();
    state.maps.layers.expenses = expensesLG;
    state.maps.layers.journal  = journalLG;

    const pts = [];
    if(state._lastTripObj){
      const expEntries = _sortByCreated(Object.entries(state._lastTripObj.expenses||{}));
      let expIndex = 1;
      expEntries.forEach(([id,e])=>{
        if(typeof e.lat==='number' && typeof e.lng==='number'){
          pts.push([e.lat,e.lng]);
          ((m=>{attachMapPopup(m,'expense', id, e); m.addTo(expensesLG);})(_numberedMarker(e.lat, e.lng, expIndex++, 'expense')));
        }
      });

      const jourEntries = _sortByCreated(Object.entries(state._lastTripObj.journal||{}));
      let jourIndex = 1;
      jourEntries.forEach(([id,j])=>{
        if(typeof j.lat==='number' && typeof j.lng==='number'){
          pts.push([j.lat,j.lng]);
          ((m=>{attachMapPopup(m,'journal', id, j); m.addTo(journalLG);})(_numberedMarker(j.lat, j.lng, jourIndex++, 'journal')));
        }
      });

      if(pts.length){
        const b = L.latLngBounds(pts);
        state.maps.big.fitBounds(b.pad(0.2));
      } else {
      if(emailSpan){ emailSpan.textContent=''; emailSpan.style.display='none'; }
      if(btnLogin) btnLogin.style.display='inline-block';
      const ub=document.getElementById('userBadge'); if(ub) ub.style.display='none';
        state.maps.big.setView([32.0853,34.7818], 6);
      }
    }

    state.maps.big.addLayer(expensesLG);
    state.maps.big.addLayer(journalLG);
    document.getElementById('btnToggleSpent')?.classList.add('active');
    document.getElementById('btnToggleVisited')?.classList.add('active');
    // --- Map toolbar: toggle visibility of layers + button state ---
    const btnSpent   = document.getElementById('btnToggleSpent');
    const btnVisited = document.getElementById('btnToggleVisited');

    function applyMapToolbarVisibility(){
      if(btnSpent && btnSpent.classList.contains('active')){
        if(!state.maps.big.hasLayer(expensesLG)) state.maps.big.addLayer(expensesLG);
      } else {
        if(state.maps.big.hasLayer(expensesLG)) state.maps.big.removeLayer(expensesLG);
      }
      if(btnVisited && btnVisited.classList.contains('active')){
        if(!state.maps.big.hasLayer(journalLG)) state.maps.big.addLayer(journalLG);
      } else {
        if(state.maps.big.hasLayer(journalLG)) state.maps.big.removeLayer(journalLG);
      }
      invalidateMap(state.maps.big);
    }
    btnSpent?.addEventListener('click', ()=>{ btnSpent.classList.toggle('active'); applyMapToolbarVisibility(); });
    btnVisited?.addEventListener('click', ()=>{ btnVisited.classList.toggle('active'); applyMapToolbarVisibility(); });
    // ensure initial visibility matches default state
    applyMapToolbarVisibility();
    

    invalidateMap(state.maps.big);
  }catch(e){ console.error('initBigMap error', e); }
}







// Create a numbered marker icon
function _numberedMarker(lat, lng, n, kind){
  const cls = (kind==='expense') ? 'red' : 'green';
  const html = `<div class="num-pin ${cls}">${n}</div>`;
  const icon = L.divIcon({ className:'', html, iconSize:[28,28], iconAnchor:[14,28] });
  return L.marker([lat,lng], { icon: icon });
}
// Sort items by created timestamp if possible (fallback to key)
function _sortByCreated(entries){
  return entries.sort((a,b)=>{
    const av = (a[1] && (a[1].createdAt || a[1].ts || a[1].time || a[1].date)) || 0;
    const bv = (b[1] && (b[1].createdAt || b[1].ts || b[1].time || b[1].date)) || 0;
    if(av && bv){
      const an = Number(new Date(av)); const bn = Number(new Date(bv));
      if(!isNaN(an) && !isNaN(bn)) return an - bn;
    }
    // fallback: by key
    return String(a[0]).localeCompare(String(b[0]));
  });
}


// Day.js setup

function esc(s){
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g,'&')
    .replace(/</g,'<')
    .replace(/>/g,'>')
    .replace(/"/g,'"')
    .replace(/'/g,'\'');
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
state = {
  user: null,
  trips: [],
  currentTripId: null,
  viewMode: 'grid',
  rates: { USDEUR: 0.92, USDILS: 3.7 },
  maps: { mini: null, big: null, layers: { expenses: null, journal: null }, select: null, selectMarker: null, currentModal: null },
  shared: { enabled: false, token: null, readOnly: false },
  isDirty: false
};

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// --- Numeric helpers for budget display (thousands separator, integers only) ---

// === Place display helpers (compact link) ===
function _isUrl(s){ return typeof s==='string' && /^https?:\/\//i.test(s.trim()); }
function _dec(s){ try{return decodeURIComponent(s);}catch(_){return s||'';} }
function _extractNameFromUrl(u){
  try{
    const url=new URL(u);
    const q=url.searchParams.get('q')||url.searchParams.get('query');
    if(q){ return _dec(q).replaceAll('+',' ').replace(/[\-_]+/g,' ').trim(); }
    // try /place/<name>/ or last segment
    const segs=_dec(url.pathname).split('/').filter(Boolean);
    const idx=segs.lastIndexOf('place');
    if(idx>=0 && segs[idx+1]) return segs[idx+1].replace(/[\-_]+/g,' ').trim();
    return (segs.pop()||'').replace(/[\-_]+/g,' ').trim();
  }catch(_){ return String(u||''); }
}
function _displayNameCityCountry(raw){
  if(!raw) return '';
  let t=String(raw).trim();
  if(_isUrl(t)) t=_extractNameFromUrl(t);
  t=_dec(t).replace(/[\-_]+/g,' ');
  const parts=t.split(/\s*,\s*|\s*-\s*|\s*\|\s*/).map(s=>s.trim()).filter(Boolean);
  return parts.slice(0,3).join(', ');
}
function placeLinkHtml(e){
  const raw = e && e.locationName;
  if(!raw) return '';
  const name=_displayNameCityCountry(raw);
  let href=null;
  if(e && typeof e.lat==='number' && typeof e.lng==='number' && isFinite(e.lat) && isFinite(e.lng)){
    href=`https://maps.google.com/?q=${e.lat},${e.lng}`;
  }else if(_isUrl(raw)){ href=raw.trim(); }
  if(!href && e && typeof e.lat==='number' && typeof e.lng==='number'){
    href=`https://maps.google.com/?q=${e.lat},${e.lng}`;
  }
  if(href){ return `<a href="${encodeURI(href)}" target="_blank" rel="noopener">${esc(name||raw)}</a>`; }
  return esc(name||raw);
}
// === End helpers ===
function formatInt(n){
  n = Math.floor(Number(n)||0);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function formatIntSigned(n){
  const num = Math.floor(Number(n)||0);
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);
  return sign + abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function parseIntSafe(s){
  const n = String(s||'').replace(/[^\d-]/g,''); // allow minus sign
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
$$('#tabs button').forEach(btn => btn.addEventListener('click', (e) => {
  const currentTab = $('#tabs button.active');
  const nextTab = btn.dataset.tab;
  
  if (currentTab.dataset.tab === 'meta' && state.isDirty) {
    e.preventDefault();
    showUnsavedChangesAlert(nextTab);
    return;
  }

  if (btn.classList.contains('active')) return;
  $$('#tabs button').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  showView(btn.dataset.tab);
  if(btn.dataset.tab==='map') setTimeout(initBigMap, 50);
  if(btn.dataset.tab==='overview') { setTimeout(()=> { try{ initBigMap(); }catch(_){} initMiniMap(state.current||{}); invalidateMap(state.maps?.mini); }, 80);}
}));

// (old Auth UI block removed – using unified handler below)

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
function expenseSortKey(e){ const candidates = [e.dateIso, e.createdAt, e.date, e.time, e.ts, e.timestamp];
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
  return localStorage.getItem(`flymily_currency_${t.id}`) || 'ILS'; // Changed default to ILS to match the image
}
function setActiveCurrency(cur){
  localStorage.setItem(`flymily_currency_${state.current.id}`, cur);
}
// UPDATED `cycleCurrency` to ensure only USD, EUR, ILS are used
function cycleCurrency(cur){
  const opts = ['USD', 'EUR', 'ILS'];
  const idx = opts.indexOf(cur);
  return opts[(idx + 1) % opts.length];
}
// Firestore: subscribe to user's trips (no orderBy to avoid index; sort client-side)
let __subTripsTimer=null;
function subscribeTrips(){
  if(__subTripsTimer){ clearTimeout(__subTripsTimer); __subTripsTimer=null; }
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
    try{ state._unsubTrips && state._unsubTrips(); }catch(_){}
    // If permissions missing, wait a bit and retry once auth is stable
    if(String(err).includes('Missing or insufficient permissions')){
      console.warn('subscribeTrips PERM error – will retry shortly');
      __subTripsTimer = setTimeout(()=>{ try{ subscribeTrips(); }catch(_){} }, 800);
      return;
    }
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
      <div class="pill types-pill" data-trip="${t.id}" data-keyword="${esc((t.types||'').toString())}">${esc((t.types||'').toString())}</div>
      <button class="menu-btn" data-id="${t.id}" aria-label="פעולות">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-more-vertical"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
      </button>
    </div>
    ${s ? `<div class="muted" style="margin-top:6px;width:100%">התאמות: ${where.map(w=>`<span class="pill hl-pill" data-trip="${t.id}" data-term="${s}" data-type="${w.type}" data-item="${w.itemId}">${w.label}</span>`).join(' ')}</div>` : ''}
  </div>`;
}
function rowHTML(t, s){
  const period = `${fmtDate(t.start)} – ${fmtDate(t.end)}`;
  const where = t.__match?.where || [];
  return `<div class="trip-row" data-trip="${t.id}">
    <div class="row-main-content">
      <strong>${esc(t.destination||'ללא יעד')}</strong>
      <span class="muted">${period}</span>
      <div class="pill types-pill" data-trip="${t.id}" data-keyword="${esc((t.types||'').toString())}">${esc((t.types||'').toString())}</div>
    </div>
    <button class="menu-btn" data-id="${t.id}" aria-label="פעולות">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-more-vertical"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
    </button>
    ${s ? `<div class="muted" style="grid-column:1/-1;margin-top:4px">התאמות: ${where.map(w=>`<span class="pill hl-pill" data-trip="${t.id}" data-term="${s}" data-type="${w.type}" data-item="${w.itemId}">${w.label}</span>`).join(' ')}</div>` : ''}
  </div>`;
}

function showView(view){
  try {
    // alias old/new names
    if(view==='overview' && !document.querySelector('#view-overview') && document.querySelector('#view-welcome')){
      view = 'welcome';
    }
    // deactivate all
    document.querySelectorAll('.tabview').forEach(v=>{
      if(!v) return;
      v.removeAttribute('data-active');
      v.setAttribute('hidden','');
    });
    // activate target
    const el = document.querySelector('#view-' + view);
    if (el) {
      el.setAttribute('data-active','1');
      el.removeAttribute('hidden');
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
  "תאילנד": "THB", "צרפת": "EUR", "יפן": "JPY", "בריטניה": "GBP", "גרמניה": "EUR", "אוסטרליה": "AUD", "קנדה": "CAD", "מקסיקו": "MXN", "טורקיה": "TRY", "שווייץ": "CHF", "סינגפור": "SGD", "סין": "CNY"};
function getLocalCurrency(destination){
  if (!destination) return null;
  const destinations = destination.split(',').map(d=>d.trim());
  const localCurrencies = destinations.map(d=>localCurrencyMap[d]).filter(Boolean);
  return localCurrencies.length ? localCurrencies[0] : null;
}

function ensureExpenseCurrencyOption() {
  try{
    const cur = state.current && state.current.localCurrency;
    if (!cur) return;
    const sel = document.getElementById('expCurr');
    if (!sel) return;
    const exists = Array.from(sel.options).some(o => o.value === cur);
    if (!exists) {
      const opt = document.createElement('option');
      opt.value = cur;
      opt.textContent = cur;
      sel.appendChild(opt);
    }
  }catch(e){ console.warn('ensureExpenseCurrencyOption failed', e); }
}

async function loadTrip(){
  const ref = FB.doc(db, 'trips', state.currentTripId);
  const snap = await FB.getDoc(ref);
  if(!snap.exists()) return;
  const t = { id: snap.id, ...snap.data() }; state._lastTripObj = t;
  state.current = t;
  try{ const _r = await fetchRatesOnce(); if(_r) state.rates = _r; }catch(e){}
  state.current.localCurrency = getLocalCurrency(t.destination);
  ensureExpenseCurrencyOption();

  // Overview meta
  $('#metaSummary').innerHTML = `
    <div><strong>${esc(t.destination||'')}</strong></div>
    <div class="muted">${fmtDate(t.start)} – ${fmtDate(t.end)}</div>
    <div>משתתפים: ${esc((t.people||[]).join(', '))}</div>
    <div>סוגים: ${esc((t.types||[]).join(', '))}</div>
    ${(() => {
      const b = t.budget || {};
      const pairs = Object.entries(b).filter(([k,v]) => Number(v) > 0);
      if (!pairs.length) return '';
      const line = pairs.map(([k,v]) => `${k} ${formatInt(v)}`).join(' · ');
      return `<div>תקציב: ${line}</div>`;
    })()}
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
  initMiniMap(t); setTimeout(()=> invalidateMap(state.maps?.mini), 80);
  renderExpenseSummary(t);
  
  // Reset dirty state on successful load
  state.isDirty = false;
}


function renderExpenses(t, order){
  order = (order || state.expenseSort || 'desc');
  const dir = (order === 'asc') ? 1 : -1;
  const body = $('#tblExpenses'); if (body) body.innerHTML = '';
  let arr = Object.entries(t.expenses||{}).map(([id,e])=>({id, ...e}))
    .sort((a,b)=> dir * (expenseSortKey(a) - expenseSortKey(b)));
  // Apply category filter if exists
  try{
    const cat = (state.filters && state.filters.expenseCat) || '';
    if(cat) arr = arr.filter(e=> (e.category||'')===cat);
  }catch(_){}
  
  
  // Ensure sort button is wired (fallback if IIFE missed it)
  (()=>{
    wireExpenseFilterButtons();
    const b = document.querySelector('#btnSortExpenses');
    if (b && !b.dataset.wiredExp) {
      b.dataset.wiredExp = '1';
      b.addEventListener('click', () => {
        toggleExpenseSort();
      });
    }
  })();
arr.forEach(e=>{
    const d = dayjs(e.dateIso || e.createdAt);
    const dateStr = d.isValid() ? d.format('DD/MM/YYYY') : '';
    const timeStr = d.isValid() ? d.format('HH:mm') : '';
    const amount = Number(e.amount||0).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const curr   = e.currency||'';
    
    // Get the exchange rate to ILS for the expense's currency
    let rateToILS = null;
    let rateStr = '';
    const localRates = e.rates || state.rates || {};
    try{
      const M = rateMatrix(localRates);
      rateToILS = (M && curr && M[curr] && M[curr].ILS) ? M[curr].ILS : null;
      if (rateToILS) {
        // Format rate to 4 decimal places
        rateStr = rateToILS.toLocaleString('he-IL',{minimumFractionDigits:4, maximumFractionDigits:4});
      }
    }catch(_){ rateToILS = null; rateStr = ''; }

    const convertedAmountILS = rateToILS ? (Number(e.amount||0) * rateToILS) : null;
    const convertedAmountStr = convertedAmountILS ? convertedAmountILS.toLocaleString('he-IL',{minimumFractionDigits:2, maximumFractionDigits:2}) : '';

    const cat    = esc(e.category||'');
    const desc = (e.descHtml && /(<a|link-icon)/i.test(e.descHtml)) ? e.descHtml : linkifyToIcons(e.descHtml || e.desc || '');
    const locStr = placeLinkHtml(e);
    
    const tr1 = document.createElement('tr');
    tr1.className = 'exp-item';
    tr1.dataset.id = e.id;
    
    // The first row will now have the amount, currency, and converted ILS total.
    tr1.innerHTML = `
      <td class="cell header date"><span class="lbl">תאריך:</span> ${dateStr}</td>
      <td class="cell header time"><span class="lbl">שעה:</span> ${timeStr}</td>
      <td class="cell header category"><span class="lbl">קטגוריה:</span> ${cat}</td>
      <td class="cell header amount">
        <div class="amt-main"><span class="code">${curr}</span> <span class="val">${amount}</span></div>
        <div class="amt-sub muted" dir="rtl">1 ${curr} = ₪ ${rateToILS ? (Math.round(rateToILS * 10000) / 10000).toLocaleString('he-IL', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : 'N/A'}</div>
      </td>
      <td class="cell header currency" dir="rtl">
        <div class="ils-total">₪ ${convertedAmountStr}</div>
      </td>
      <td class="cell header menu-cell">
        <button class="menu-btn" aria-label="פעולות" data-id="${e.id}">...</button>
      </td>
    `;
    
    const tr4 = document.createElement('tr');
    tr4.className = 'exp-item';
    tr4.innerHTML = `<td class="cell notes" colspan="6">${desc||''}</td>`;
    
    // Remove all children from the amount cell except amt-main and amt-sub to prevent duplicates
    const _amtCell = tr1.querySelector('.cell.header.amount');
    if (_amtCell){
        const amtMain = _amtCell.querySelector('.amt-main');
        const amtSub = _amtCell.querySelector('.amt-sub');
        Array.from(_amtCell.children).forEach(ch => { 
            if (ch !== amtMain && ch !== amtSub) ch.remove(); 
        });
    }

    body.appendChild(tr1);
    body.appendChild(tr4);

    const menuBtn = tr1.querySelector('.menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', ()=>{ _rowActionExpense = e; $('#rowMenuModal').showModal(); });
    }
  });
}



function renderJournal(t, order){
  try{
    order = (order || state.journalSort || 'desc');
    const dir = (order === 'asc') ? 1 : -1;
    const body = document.querySelector('#tblJournal');
    if (body) body.innerHTML = '';
    // /* JR_SELECT_PATCH */
    const selectionOn = !!state.journalSelectionMode;
    const selectedSet = state.journalSelectedIds || new Set();

    let arr = Object.entries(t?.journal || {}).map(([id,j])=>({id, ...j}))
      .sort((a,b)=> dir * (expenseSortKey(a) - expenseSortKey(b)));

    arr.forEach(j=>{
      const baseIso = j.dateIso || j.createdAt;
      let dateStr = '', timeStr = '';
      if (baseIso) {
        const d = dayjs(baseIso);
        if (d.isValid()) { dateStr = d.format('DD/MM/YYYY'); timeStr = d.format('HH:mm'); }
      }
      // fallback to stored strings if exist
      if (!dateStr && j.date) dateStr = j.date;
      if (!timeStr && j.time) timeStr = j.time;
      const cat = j.category || '';
            // Build compact place display only when we actually have coordinates
let locStr = '';
      const _lat = Number(j.lat), _lng = Number(j.lng);
      const hasCoords = isFinite(_lat) && isFinite(_lng);
      let display = j.placeName || ''; // שימוש ישיר בערך השמור
      
      if (display){
        // 1. אם יש שם מיקום, זה יהיה טקסט הבסיס
        locStr = esc(display); 

        // 2. ננסה לשפר את התצוגה לקישור למפה אם יש קואורדינטות
        if (hasCoords){
          // אם יש קואורדינטות, נשתמש בטקסט שהוזן כתווית לקישור המפה
          const href = `https://maps.google.com/?q=$?q=${_lat},${_lng}`;
          locStr = `<a href="${encodeURI(href)}" target="_blank" rel="noopener">${locStr} 🌐</a>`; 
        } 
        
        // 3. ננסה לשפר את התצוגה לקישור URL אם יש URL
        else if (j.placeUrl){
          // אם הטקסט הוא URL, נציג אותו כקישור
          locStr = `<a href="${encodeURI(j.placeUrl)}" target="_blank" rel="noopener">${locStr} 🔗</a>`;
        }

      } else {
        // אם אין שם מקום כלל (גם לא טקסט שהוזן), נציג (ללא מיקום)
        locStr = '<span class="muted">(ללא מיקום)</span>';
      }
const text =   (j.html && /(<a|link-icon)/i.test(j.html)) ? j.html : linkifyToIcons(j.html || j.text || '');

      const tr1 = document.createElement('tr');
      tr1.className = 'exp-item'; tr1.dataset.id = j.id;
      const selectCell = selectionOn ? `<td class="cell select-cell"><input type="checkbox" class="jr-select" ${ (selectedSet.has(j.id)? "checked": "") }></td>` : "";
            tr1.innerHTML = `
        ${selectCell}
        <td class="cell header date"><span class="lbl">תאריך:</span> ${dateStr}</td>
        <td class="cell header time"><span class="lbl">שעה:</span> ${timeStr}</td>
        <td class="cell header location" colspan="2"><span class="lbl">מקום:</span> ${locStr}</td>
        <td class="cell header menu-cell"><button class="menu-btn" aria-label="פעולות" data-id="${j.id}">...</button></td>
      `;
      const tr4 = document.createElement('tr');
      tr4.className = 'exp-item';
      tr4.innerHTML = `<td class="cell notes" colspan="6">${text}</td>`;

      if (body){ body.appendChild(tr1); body.appendChild(tr4); }

      if(selectionOn){
        const cb = tr1.querySelector('input.jr-select');
        if(cb){
          cb.addEventListener('click', (ev)=> ev.stopPropagation());
          cb.addEventListener('change', ()=>{
            if(cb.checked) selectedSet.add(j.id); else selectedSet.delete(j.id);
            state.journalSelectedIds = selectedSet;
            const db = document.getElementById('btnDeleteSelectedJournal');
            if(db) db.textContent = `מחק (${selectedSet.size||0})`;
            const cancelBtn = document.getElementById('btnCancelSelectionJournal');
            if(cancelBtn) cancelBtn.style.display = 'inline-flex';
          });
        }
      }

      const menuBtn = tr1.querySelector('.menu-btn');
      if (menuBtn) {
        menuBtn.addEventListener('click', (e)=>{
          e.stopPropagation();
          _rowActionJournal = j;
          const m = document.getElementById('rowMenuModal');
          if (m && m.showModal) m.showModal();
        });
      }
    });
  }catch(e){
    console.error('renderJournal failed', e);
  }
}


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
  const types = $$('.metaType').map(b=>b.dataset.value);
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
  state.isDirty = true; // Mark as dirty on any change
}
['bUSD','bEUR','bILS'].forEach(id=> $('#'+id).addEventListener('input', ()=> syncBudget(id.replace('b','')) ));
if($('#rateUSDEUR')) $('#rateUSDEUR').addEventListener('input', e=> state.rates.USDEUR = Number(e.target.value||0.92));
if($('#rateUSDILS')) $('#rateUSDILS').addEventListener('input', e=> state.rates.USDILS = Number(e.target.value||3.7));
$('#btnBudgetEdit').addEventListener('click', async ()=>{
  const btn = $('#btnBudgetEdit');
  const locking = !btn.classList.contains('locked');
  const ref = FB.doc(db, 'trips', state.currentTripId);
  const budget = { USD: parseIntSafe($('#bUSD').value), EUR: parseIntSafe($('#bEUR').value), ILS: parseIntSafe($('#bILS').value) };
  const live = await fetchRatesOnce();
  const lockedRates = { USDILS: live.USDILS, USDEUR: live.USDEUR, lockedAt: live.lockedAt };
  if (live.USDLocal) lockedRates.USDLocal = live.USDLocal;
  await FB.updateDoc(ref, { budget, rates: lockedRates, budgetLocked: locking });
  ['bUSD','bEUR','bILS'].forEach(id=> $('#'+id).disabled = locking);
  btn.classList.toggle('locked', locking);
  btn.textContent = locking ? 'ביטול נעילה' : 'קבע תקציב';
  showToast(locking ? 'התקציב נקבע' : 'התקציב פתוח לעריכה');
  state.isDirty = false; // Reset dirty state on save
});
// Expenses CRUD
$('#btnAddExpense').addEventListener('click', ()=> openExpenseModal());
$('#expCancel').addEventListener('click', ()=> $('#expenseModal').close());
$('#expSave').addEventListener('click', saveExpense);

function openExpenseModal(e){try{ window._rebindTextColorDots(); }catch(_){}

  /*__OPEN_EXP_PREFILL__*/
  try{
    const base = e || null;
    const $d = document.getElementById('expDate');
    const $t = document.getElementById('expTime');
    if($d && $t){
      const src = base?.dateIso || base?.createdAt || new Date().toISOString();
      const d = new Date(src);
      const pad = n=>String(n).padStart(2,'0');
      $d.value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      $t.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }catch(_){}

  if(window._bindTextareasForModals) window._bindTextareasForModals();

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
  $('#expText').innerHTML = (e?.descHtml || (e?.desc ? linkifyText(e.desc) : '')); $('#expCat').value = e?.category||''; $('#expAmount').value = e?.amount||'';
  $('#expCurr').value = e?.currency||'USD';
  $('#expLat').value = e?.lat||''; $('#expLng').value = e?.lng||'';
  $('#expDelete').style.display = e? 'inline-block':'none';
  // Prefill expDate/expTime (enrich)
  try {
    const base = (typeof e!=='undefined' && e) || (typeof j!=='undefined' && j) || null;
    const pad = n=>String(n).padStart(2,'0');
    let dStr=null, tStr=null;
    if (base && base.date && base.time) {
      dStr = base.date.split('/').reverse().join('-'); // dd/mm/yyyy -> yyyy-mm-dd
      tStr = base.time;
    } else if (base && (base.createdAt||base.dateIso)) {
      const d = new Date(base.createdAt||base.dateIso);
      dStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      tStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } else {
      const d = new Date();
      dStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      tStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    const $d=$('#expDate'), $t=$('#expTime');
    if($d) $d.value=dStr; if($t) $t.value=tStr;
  } catch(_){}

  document.dispatchEvent(new Event('openExpenseModal')); $('#expenseModal').showModal();
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
  /*__EXP_DT_BLOCK__*/
  const $expD = document.getElementById('expDate');
  const $expT = document.getElementById('expTime');
  let _exp_dateIso;
  if ($expD && $expT && $expD.value && $expT.value) {
    _exp_dateIso = new Date(`${$expD.value}T${$expT.value}:00`).toISOString();
  } else {
    const curE = (t.expenses && t.expenses[$('#expenseModal')?.dataset?.id || '']) || {};
    _exp_dateIso = curE.dateIso || curE.createdAt || new Date().toISOString();
  }
  const __exp_dt = new Date(_exp_dateIso);
  const __pad = n=>String(n).padStart(2,'0');
  const __exp_dateStr = `${__pad(__exp_dt.getDate())}/${__pad(__exp_dt.getMonth()+1)}/${__exp_dt.getFullYear()}`;
  const __exp_timeStr = `${__pad(__exp_dt.getHours())}:${__pad(__exp_dt.getMinutes())}`;
  
  const id = $('#expenseModal').dataset.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  t.expenses = t.expenses || {};
  t.expenses[id] = {
    desc: (document.getElementById('expText')?.textContent||'').trim(),
    descHtml: sanitizeExpenseNoLinks(document.getElementById('expText')?.innerHTML||'').trim(),
    category: $('#expCat').value.trim(),
    amount: Number($('#expAmount').value||0),
    currency: $('#expCurr').value,
    locationName: $('#expLocationName') ? $('#expLocationName').value.trim() : '', // <--- **תיקון**
    lat: numOrNull($('#expLat').value),
    lng: numOrNull($('#expLng').value),
    createdAt: (t.expenses[id] && t.expenses[id].createdAt) ? t.expenses[id].createdAt : new Date().toISOString(),
    dateIso: _exp_dateIso,
    date: __exp_dateStr,
    time: __exp_timeStr,
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
// ---- Missing sign-in button wiring (added) ----
(function(){
  const $ = (sel)=>document.querySelector(sel);
  const doLogin = async (emailSel, passSel, errSel)=>{
    const email = $(emailSel)?.value?.trim();
    const pass  = $(passSel)?.value;
    if(!email || !pass){ if($(errSel)) $(errSel).textContent = 'אנא מלא אימייל וסיסמה'; return; }
    try{
      await FB.signInWithEmailAndPassword(auth, email, pass);
      if($(errSel)) $(errSel).textContent = '';
    }catch(e){
      if($(errSel)) $(errSel).textContent = xErr(e);
      console.error('login failed', e);
    }
  };
  document.addEventListener('DOMContentLoaded', ()=>{
    const btn1 = $('#loginBtn');
    if(btn1 && !btn1.dataset.wired){ btn1.dataset.wired='1'; btn1.addEventListener('click', ()=>doLogin('#lsEmail','#lsPass','#lsError')); }
    const btn2 = $('#authSignIn');
    if(btn2 && !btn2.dataset.wired){ btn2.dataset.wired='1'; btn2.addEventListener('click', ()=>doLogin('#authEmail','#authPass','#authError')); }
  });
})();

// ---- login wiring (clean) ----
(function(){
  const $ = (sel)=>document.querySelector(sel);
  async function doLogin(emailSel, passSel, errSel){
    try{
      const auth = FB.getAuth();
      const email = $(emailSel)?.value?.trim();
      const pass  = $(passSel)?.value;
      if(!email || !pass){ if($(errSel)) $(errSel).textContent = 'אנא מלא אימייל וסיסמה'; return; }
      try{
        await FB.signInWithEmailAndPassword(auth, email, pass);
        if($(errSel)) $(errSel).textContent = '';
      }catch(e){
        const xErr = (e)=> (e?.code || e?.message || 'שגיאת התחברות');
        if($(errSel)) $(errSel).textContent = xErr(e);
        console.error('login failed', e);
      }
    }catch(e){ console.error('auth not ready', e); }
  }
  document.addEventListener('DOMContentLoaded', ()=>{
    const btn1 = document.getElementById('loginBtn');
    if(btn1 && !btn1.dataset.wired){ btn1.dataset.wired='1'; btn1.addEventListener('click', ()=>doLogin('#lsEmail','#lsPass','#lsError')); }
    const btn2 = document.getElementById('authSignIn');
    if(btn2 && !btn2.dataset.wired){ btn2.dataset.wired='1'; btn2.addEventListener('click', ()=>doLogin('#authEmail','#authPass','#authError')); }
  });
})();
// ---- end wiring ----
// ---- end wiring ----


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
        const cont = document.querySelector(`#view-expenses`) || document.querySelector(`#tblExpenses`);
        if(cont) highlightAllInContainer(cont, query);
      }, 300);
    } else if(type === 'journal'){
      document.querySelector('#tabs button[data-tab="journal"]').click();
      setTimeout(()=>{
        const cont = document.querySelector(`#view-journal`) || document.querySelector(`#tblJournal`);
        if(cont) highlightAllInContainer(cont, query);
      }, 300);
    } else if (type === 'meta') {
      document.querySelector('#tabs button[data-tab="meta"]')?.click();
      setTimeout(()=>{
        const cont = document.querySelector('#view-meta') || document.querySelector('#view-meta .dest-col');
        if(cont) highlightAllInContainer(cont, query);
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
      routeDelete({type:'expense', id:_rowActionExpense.id, message:'האם אתה בטוח שברצונך למחוק הוצאה זו?'});
    }
    else if (_rowActionJournal) {
      routeDelete({type:'journal', id:_rowActionJournal.id, message:'האם אתה בטוח שברצונך למחוק רישום זה?'});
    }
    else if (_rowActionTrip) {
      routeDelete({type:'trip', id:_rowActionTrip.id, message:'האם אתה בטוח שברצונך למחוק טיול זה? פעולה זו אינה הפיכה.'});
    }
    modal.close(); _rowActionExpense = _rowActionJournal = _rowActionTrip = null;
  });

  if (btnCancel) btnCancel.addEventListener('click', ()=>{
    modal.close(); _rowActionExpense = _rowActionJournal = _rowActionTrip = null;
  });
})();


/* ---------- Global Delete Router (DRY) ---------- */
function routeDelete(opts){
  try {
    const type = opts?.type;
    const id   = opts?.id;
    const msg  = opts?.message || 'לאשר מחיקה?';
    if (!type || !id) return;
    showConfirm(msg, ()=>{
      if (type === 'expense') return deleteExpense(id);
      if (type === 'journal') return deleteJournal(id);
      if (type === 'trip')    return deleteTrip(id);
    });
  } catch(e){ console.warn('routeDelete error', e); }
}

/* Delegation: any element with [data-delete="expense|journal|trip"] and [data-id] */
document.addEventListener('click', (ev)=>{
  const el = ev.target && ev.target.closest?.('[data-delete]');
  if (!el) return;
  const type = el.dataset.delete;
  const id   = el.dataset.id || el.closest('[data-id]')?.dataset.id;
  const message = el.dataset.msg || null;
  if (type && id) {
    ev.preventDefault();
    ev.stopPropagation();
    routeDelete({type, id, message});
  }
});

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


// === Bind delete buttons inside the Expense & Journal modals ===
(function bindInlineDeleteButtons(){
  // Expense modal delete
  const expDelBtn = document.getElementById('expDelete');
  if (expDelBtn && !expDelBtn._bound) {
    expDelBtn._bound = true;
    expDelBtn.addEventListener('click', () => {
      const expId = document.getElementById('expenseModal')?.dataset?.id;
      if (!expId) return;
      showConfirm('לאשר מחיקה?', async () => {
        try {
          await deleteExpense(expId);
        } finally {
          document.getElementById('expenseModal')?.close();
          document.getElementById('confirmDeleteModal')?.close();
        }
      });
    });
  }
  // Journal modal delete
  const jrDelBtn = document.getElementById('jrDelete');
  if (jrDelBtn && !jrDelBtn._bound) {
    jrDelBtn._bound = true;
    jrDelBtn.addEventListener('click', () => {
      const jrId = document.getElementById('journalModal')?.dataset?.id;
      if (!jrId) return;
      showConfirm('לאשר מחיקה?', async () => {
        try {
          await deleteJournal(jrId);
        } finally {
          document.getElementById('journalModal')?.close();
          document.getElementById('confirmDeleteModal')?.close();
        }
      });
    });
  }
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
      // Use the existing, correct delete function
      await deleteExpense(expId);
    }catch(err){ alert(typeof xErr==='function' ? xErr(err) : (err?.message||err)); }
    finally{
      // The deleteExpense function already reloads the trip, just close the modals.
      document.getElementById('expenseModal')?.close();
      document.getElementById('confirmDeleteModal')?.close();
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

// ---- Local-refresh bulk delete: instant UI, background sync ----
async function deleteJournalBulkLocal(ids){
  if(!Array.isArray(ids) || ids.length===0) return;
  const tid = state.currentTripId;
  if(!tid) return;
  // 1) Update local state
  if(!state.current) state.current = { id: tid, journal:{} };
  let removed = 0;
  for(const id of ids){
    if(state.current.journal && state.current.journal[id]){
      delete state.current.journal[id];
      removed++;
    }
  }
  // 2) Instant re-render (no network)
  renderJournal(state.current, state.journalSort);
  showToast(`נמחקו ${removed} רישומים`);
  // 3) Background sync (best-effort)
  try{
    const ref = FB.doc(db,'trips', tid);
    await FB.updateDoc(ref, { journal: state.current.journal });
  }catch(e){
    console.warn('background sync failed', e);
  }
}
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
      let amount = Number(amountTd.firstChild && amountTd.firstChild.nodeValue || 0); if(!amount) { amount = parseFloat((amountTd.textContent||'').replace(/[^0-9.]/g,''))||0; } // Get the number from the cell
      if(!cur) return;
      if(amountTd.querySelector('.rate-note')) return;
      const rateToILS = getRateToILS(cur, state.rates);
      const convertedAmountILS = amount * rateToILS;
      // Removed the creation and appending of the rate-note div
      // const note = document.createElement('div');
      // note.className = 'rate-note';
      // note.textContent = `₪${convertedAmountILS.toFixed(2)}`; // Display the converted amount in ILS
      // amountTd.appendChild(note);
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
      if(emailSpan){ emailSpan.textContent=''; emailSpan.style.display='none'; }
      if(btnLogin) btnLogin.style.display='inline-block';
      const ub=document.getElementById('userBadge'); if(ub) ub.style.display='none';
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
      if(emailSpan){ emailSpan.textContent=''; emailSpan.style.display='none'; }
      if(btnLogin) btnLogin.style.display='inline-block';
      const ub=document.getElementById('userBadge'); if(ub) ub.style.display='none';
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
        const displayName = data.address.country === 'ישראל' ? data.display_name : data.address.country || data.display_name;
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
        const displayName = data.address.country === 'ישראל' ? data.display_name : data.address.country || data.display_name;
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

// Disabled auto-overwrite on typing: let the user type freely.
$('#expLocationName').addEventListener('input', (e) => {
  // optional: lookup could run here without overwriting text
});

$('#btnSelectExpLocation').addEventListener('click', () => {
  state.maps.currentModal = 'expense';
  openMapSelectModal(numOrNull($('#expLat').value), numOrNull($('#expLng').value));
});


// Journal modal location actions
$('#btnAddJournal').addEventListener('click', ()=> openJournalModal());
$('#jrCancel').addEventListener('click', ()=> $('#journalModal').close());
$('#jrSave').addEventListener('click', saveJournal);

function openJournalModal(j) {try{ window._rebindTextColorDots(); }catch(_){}

  try{ document.querySelector('#journalModal .input.rtf').style.paddingBottom='72px'; }catch(_){}
  $('#journalModal').dataset.id = j?.id || '';
  document.getElementById('jrText').innerHTML = (j?.html || j?.text || '').trim();
  
  // ***התיקון החדש/המשופר הוא כאן***:
  $('#jrLocationName').value = (j?.placeName || j?.locationName) || ''; 
  
  $('#jrLat').value = j?.lat || '';
  $('#jrLng').value = j?.lng || '';
  $('#jrDelete').style.display = j ? 'inline-block' : 'none';
  // Prefill jrDate/jrTime (enrich)
  try {
    const base = (typeof e!=='undefined' && e) || (typeof j!=='undefined' && j) || null;
    const pad = n=>String(n).padStart(2,'0');
    let dStr=null, tStr=null;
    if (base && base.date && base.time) {
      dStr = base.date.split('/').reverse().join('-'); // dd/mm/yyyy -> yyyy-mm-dd
      tStr = base.time;
    } else if (base && (base.createdAt||base.dateIso)) {
      const d = new Date(base.createdAt||base.dateIso);
      dStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      tStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } else {
      const d = new Date();
      dStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      tStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    const $d=$('#jrDate'), $t=$('#jrTime');
    if($d) $d.value=dStr; if($t) $t.value=tStr;
  } catch(_){}

  $('#journalModal').showModal();
}

async function saveJournal() {
  const ref = FB.doc(db, 'trips', state.currentTripId);
  const snap = await FB.getDoc(ref);
  const t = snap.exists() ? (snap.data() || {}) : {};

  const id = $('#journalModal').dataset.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  t.journal = t.journal || {};

  const prev = t.journal[id] || {};

  t.journal[id] = {
    text: (document.getElementById('jrText').innerText || '').trim(),
    html: (document.getElementById('jrText').innerHTML || '').trim(),
    placeName: $('#jrLocationName').value.trim(), // <--- **ודא שזה הערך המדויק**
    placeUrl: (function(){ 
      const v=$('#jrLocationName').value.trim(); 
      return /^(?:https?:\/\/|www\.)/.test(v) ? (v.startsWith('http')? v : 'http://' + v) : ''; 
    })(),
    lat: numOrNull($('#jrLat').value),
    lng: numOrNull($('#jrLng').value),
    createdAt: prev.createdAt || new Date().toISOString()
  };

  // --- align with Expenses: persist dateIso/date/time from inputs ---
  const $jrD = $('#jrDate');
  const $jrT = $('#jrTime');
  let _jr_dateIso;
  if ($jrD && $jrT && $jrD.value && $jrT.value) {
    _jr_dateIso = new Date(`${$jrD.value}T${$jrT.value}:00`).toISOString();
  } else {
    _jr_dateIso = prev.dateIso || prev.createdAt || new Date().toISOString();
  }
  const __dt = new Date(_jr_dateIso);
  const pad2 = n => String(n).padStart(2, '0');

  t.journal[id].dateIso = _jr_dateIso;
  t.journal[id].date    = `${pad2(__dt.getDate())}/${pad2(__dt.getMonth()+1)}/${__dt.getFullYear()}`;
  t.journal[id].time    = `${pad2(__dt.getHours())}:${pad2(__dt.getMinutes())}`;

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

// Disabled auto-overwrite for journal typing as well.
$('#jrLocationName').addEventListener('input', (e) => {
  // keep user text intact
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


// New logic to set dirty state on input change in meta tab
const metaInputs = [
  '#metaDestination', '#metaStart', '#metaEnd', '#metaPeople', '#bUSD', '#bEUR', '#bILS'
];
metaInputs.forEach(sel => {
  const el = $(sel);
  if (el) {
    el.addEventListener('input', () => {
      state.isDirty = true;
    });
  }
});
$$('.metaType').forEach(btn => {
    btn.addEventListener('click', () => {
        state.isDirty = true;
    });
});
// Function to show the alert
function showUnsavedChangesAlert(nextTab) {
    const modal = $('#unsavedChangesModal');
    if (modal) {
        modal.showModal();
        modal.dataset.nextTab = nextTab;
    }
}
// Unsaved changes modal buttons
$('#unsavedSave').addEventListener('click', async () => {
    $('#unsavedChangesModal').close();
    await saveMetaChanges();
    const nextTab = $('#unsavedChangesModal').dataset.nextTab;
    if (nextTab) {
        const nextBtn = $(`#tabs button[data-tab="${nextTab}"]`);
        if (nextBtn) {
            nextBtn.click();
        }
    }
});
$('#unsavedDiscard').addEventListener('click', async () => {
    $('#unsavedChangesModal').close();
    state.isDirty = false; // Discard changes
    await loadTrip(); // Reload trip data to revert changes
    const nextTab = $('#unsavedChangesModal').dataset.nextTab;
    if (nextTab) {
        const nextBtn = $(`#tabs button[data-tab="${nextTab}"]`);
        if (nextBtn) {
            nextBtn.click();
        }
    }
});
$('#unsavedCancel').addEventListener('click', () => {
    $('#unsavedChangesModal').close();
});
async function saveMetaChanges() {
    const ref = FB.doc(db, 'trips', state.currentTripId);
    const people = $('#metaPeople').value.split(',').map(s => s.trim()).filter(Boolean);
    const types = $$('.metaType.active').map(b => b.dataset.value);
    const destination = $('#metaDestination').value.trim();
    const localCur = getLocalCurrency(destination);
    
    const budget = {
        USD: parseIntSafe($('#bUSD').value),
        EUR: parseIntSafe($('#bEUR').value),
        ILS: parseIntSafe($('#bILS').value)
    };

    const live = await fetchRatesOnce();
    const lockedRates = {
        USDILS: live.USDILS,
        USDEUR: live.USDEUR,
        lockedAt: live.lockedAt
    };
    if (live.USDLocal) lockedRates.USDLocal = live.USDLocal;

    await FB.updateDoc(ref, {
        destination,
        start: $('#metaStart').value,
        end: $('#metaEnd').value,
        people,
        types,
        localCurrency: localCur,
        budget,
        rates: lockedRates
    });
    showToast('נשמר');
    state.isDirty = false;
    await loadTrip();
}
// Override default save button to use the new function
$('#btnSaveMeta').addEventListener('click', saveMetaChanges);

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

// === SHARE / IMPORT / EXPORT (Last Tab) ===

// helper to get safe current trip or fallback
function currentTrip(){ return state?.current || {}; }
function asArray(o){ return Array.isArray(o)? o : (o? Object.values(o): []); }

// Build a minimal HTML block for export (RTL + Hebrew-safe)
// Load html2canvas for Hebrew-safe PDF (render as image)
async function ensureHtml2Canvas(){
  if (typeof window.html2canvas !== 'undefined') return true;
  return await loadExternalScript([
    "https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js",
    "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"
  ]);
}

// Format helpers for meta
function kvRowsFromMeta(trip){
  const rows = [];
  rows.push({ שדה:'יעד', ערך: esc(trip.destination||'') });
  rows.push({ שדה:'תאריכים', ערך: `${fmtDate(trip.start)} – ${fmtDate(trip.end)}` });
  if (trip.people && trip.people.length) rows.push({ שדה:'משתתפים', ערך: esc(trip.people.join(', ')) });
  if (trip.types && trip.types.length) rows.push({ שדה:'סוג טיול', ערך: esc(trip.types.join(', ')) });
  // Budget (flatten one level)
  if (trip.budget && typeof trip.budget === 'object'){
    const pairs = [];
    if (Number(trip.budget.USD) > 0) pairs.push(`USD: ${formatInt(trip.budget.USD)}`);
    if (Number(trip.budget.EUR) > 0) pairs.push(`EUR: ${formatInt(trip.budget.EUR)}`);
    if (Number(trip.budget.ILS) > 0) pairs.push(`ILS: ${formatInt(trip.budget.ILS)}`);
    if (pairs.length) rows.push({ שדה:'תקציב', ערך: pairs.join(' | ') });
  }
  // Rates
  if (trip.rates && typeof trip.rates === 'object'){
    const parts = [];
    if (trip.rates.USDILS) parts.push(`USDILS: ${trip.rates.USDILS}`);
    if (trip.rates.USDEUR) parts.push(`USDEUR: ${trip.rates.USDEUR}`);
    if (trip.rates.USDLocal) parts.push(`USDLocal: ${trip.rates.USDLocal}`);
    if (parts.length) rows.push({ שדה:'שערי מטבע', ערך: parts.join(' | ') + (trip.rates.lockedAt ? ` | lockedAt: ${dayjs(trip.rates.lockedAt).toISOString()}` : '') });
  }
  return rows;
}

// override PDF to always include all sections
async function exportPDF(){
  const t = currentTrip();
  if(!t.id){ toast('פתח נסיעה'); return; }
  const ok1 = await ensureJsPDF();
  const ok2 = await ensureHtml2Canvas();
  if(!ok1 || !ok2){ toast('בעיה בטעינת ספריות PDF'); return; }

  const { jsPDF } = window.jspdf || window;
  const doc = new jsPDF({orientation:'p', unit:'pt', format:'a4'});
  const container = buildExportContainer(t);
  document.body.appendChild(container);

  const blocks = Array.from(container.children);
  let first = true;
  for (const block of blocks){
    const canvas = await html2canvas(block, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
    const w = canvas.width * ratio;
    const h = canvas.height * ratio;
    if (!first) doc.addPage();
    first = false;
    doc.addImage(imgData, 'PNG', (pageW - w)/2, 24, w, h, undefined, 'FAST');
  }
  container.remove();
  const file = `FLYMILY_${(t.destination||'trip').replace(/\s+/g,'_')}.pdf`;
  doc.save(file);
}

// override Excel
async function exportExcel(){
  const t = currentTrip();
  if(!t.id){ toast('פתח נסיעה'); return; }
  const ok = await ensureXLSX(); if(!ok){ toast('בעיה בייצוא Excel'); return; }
  const wb = XLSX.utils.book_new();

  const meta = kvRowsFromMeta(t);
  const s0 = XLSX.utils.json_to_sheet(meta);
  XLSX.utils.book_append_sheet(wb, s0, 'נתוני נסיעה');

  const jr = Object.values(t.journal || {}).sort((a,b)=> (a.createdAt||'').localeCompare(b.createdAt||'')).map(j=>({ תאריך: fmtDateTime(j.dateIso || j.createdAt), מקום:j.placeName||'', תיאור:j.text||'' }));
  const s1 = XLSX.utils.json_to_sheet(jr);
  XLSX.utils.book_append_sheet(wb, s1, 'יומן יומי');

  const ex = Object.values(t.expenses || {}).sort((a,b)=> (a.createdAt||'').localeCompare(b.createdAt||'')).map(e=>({ תיאור:e.desc||'', קטגוריה:e.category||'', סכום:e.amount||'', מטבע:e.currency||'', תאריך:fmtDateTime(e.dateIso || e.createdAt)}));
  const s2 = XLSX.utils.json_to_sheet(ex);
  XLSX.utils.book_append_sheet(wb, s2, 'הוצאות');

  const fn = `FLYMILY_${(t.destination||'trip').replace(/\s+/g,'_')}.xlsx`;
  XLSX.writeFile(wb, fn);
}

// override Word
async function exportWord(){
  const t = currentTrip();
  if(!t.id){ toast('פתח נסיעה'); return; }
  const ok = await ensureDOCX(); if(!ok){ toast('בעיה בייצוא Word'); return; }
  const { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } = docx;

  const metaRows = kvRowsFromMeta(t).map(r =>
    new TableRow({ children:[
      new TableCell({ children:[new Paragraph(r['שדה'])]}),
      new TableCell({ children:[new Paragraph(String(r['ערך']))]}),
    ]})
  );
  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [ new TableRow({ children:[
      new TableCell({ children:[new Paragraph({text:'שדה', alignment: AlignmentType.CENTER})]}),
      new TableCell({ children:[new Paragraph({text:'ערך', alignment: AlignmentType.CENTER})]}),
    ]}), ...metaRows ]
  });

  const journalRows = Object.values(t.journal || {}).sort((a,b)=> (a.createdAt||'').localeCompare(b.createdAt||'')).map(j =>
    new TableRow({
      children:[
        new TableCell({ children:[new Paragraph(fmtDateTime(j.dateIso || j.createdAt)||'')]}),
        new TableCell({ children:[new Paragraph(j.placeName||'')]}),
        new TableCell({ children:[new Paragraph(j.text||'')]}),
      ]
    })
  );
  const jrTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [ new TableRow({ children:[
      new TableCell({ children:[new Paragraph({text:'תאריך', alignment: AlignmentType.CENTER})]}),
      new TableCell({ children:[new Paragraph({text:'מקום', alignment: AlignmentType.CENTER})]}),
      new TableCell({ children:[new Paragraph({text:'תיאור', alignment: AlignmentType.CENTER})]}),
    ]}), ...journalRows ]
  });

  const exRows = Object.values(t.expenses || {}).sort((a,b)=> (a.createdAt||'').localeCompare(b.createdAt||'')).map(e =>
    new TableRow({ children:[
      new TableCell({ children:[new Paragraph(fmtDateTime(e.dateIso || e.createdAt)||'')]}), // 1. תאריך
      new TableCell({ children:[new Paragraph(e.currency||'')]}),                               // 2. מטבע
      new TableCell({ children:[new Paragraph(String(e.amount ?? ''))]}),                       // 3. סכום
      new TableCell({ children:[new Paragraph(e.category||'')]}),                               // 4. קטגוריה
      new TableCell({ children:[new Paragraph(e.desc||'')]}),                                   // 5. תיאור
    ]})
  );
  const exTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [ new TableRow({ children:[
      new TableCell({ children:[new Paragraph({text:'תאריך', alignment: AlignmentType.CENTER})]}),
      new TableCell({ children:[new Paragraph({text:'מטבע', alignment: AlignmentType.CENTER})]}),
      new TableCell({ children:[new Paragraph({text:'סכום', alignment: AlignmentType.CENTER})]}),
      new TableCell({ children:[new Paragraph({text:'קטגוריה', alignment: AlignmentType.CENTER})]}),
      new TableCell({ children:[new Paragraph({text:'תיאור', alignment: AlignmentType.CENTER})]}),
    ]}), ...exRows ]
  });

  const doc = new Document({
    sections:[{
      properties:{},
      children:[
        // כותרת ראשית: שונתה ל"הטיול שלי ל[יעד]"
        new Paragraph({ text:`הטיול שלי ל${t.destination||'המרכז'}`, heading: HeadingLevel.TITLE }),
        new Paragraph({ text:`${fmtDate(t.start)} – ${fmtDate(t.end)}` }),
        // כותרת משנה: "נתוני נסיעה" - הוספת יישור לימין
        new Paragraph({ text:'נתוני נסיעה', heading: HeadingLevel.HEADING_2, alignment: AlignmentType.RIGHT }),
        metaTable,
        // כותרת משנה: "יומן יומי" - הוצמדה לימין
        new Paragraph({ text:'יומן יומי', heading: HeadingLevel.HEADING_2, alignment: AlignmentType.RIGHT }),
        jrTable,
        // כותרת משנה: "הוצאות" - הוצמדה לימין
        new Paragraph({ text:'הוצאות', heading: HeadingLevel.HEADING_2, alignment: AlignmentType.RIGHT }),
        exTable
      ]
    }]
  });
  const blob = await Packer.toBlob(doc);
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
  link.download = `FLYMILY_${(t.destination||'trip').replace(/\s+/g,'_')}.docx`; link.click(); URL.revokeObjectURL(link.href);
}


// --- Export Trip Schedule to Word (A4, RTL, Sunday->Saturday) ---
async function exportTripScheduleWord(){
  const t = currentTrip();
  if(!t || !t.id){ toast('פתח נסיעה'); return; }
  const ok = await ensureDOCX(); if(!ok){ toast('בעיה בייצוא Word'); return; }
  const { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, TextRun } = window.docx || window;

  // Build inclusive range from Sunday before/at start to Saturday after/at end
  const dStart = dayjs(t.start);
  const dEnd   = dayjs(t.end);
  if(!dStart.isValid() || !dEnd.isValid()){ toast('תאריכי נסיעה לא תקינים'); return; }
  const startSunday = dStart.day()===0 ? dStart.startOf('day') : dStart.subtract(dStart.day(), 'day').startOf('day');
  const endSaturday = dEnd.day()===6 ? dEnd.endOf('day')   : dEnd.add(6 - dEnd.day(), 'day').endOf('day');

  const days = [];
  for(let d = startSunday.clone(); d.isBefore(endSaturday) || d.isSame(endSaturday,'day'); d = d.add(1,'day')){
    days.push(d.clone());
  }

  // Map expenses to date YYYY-MM-DD -> array of lines (max 5 per expense)
  const expMap = Object.create(null);
const expenses = Object.values(t.expenses || {});
for(const e of expenses){
  const dIso = e?.dateIso || e?.createdAt || e?.date;
  const dd = dayjs(dIso);
  if(!dd.isValid()) continue;
  const key = dd.format('YYYY-MM-DD');
  const raw = (e?.desc || e?.text || '').toString();
  const lines = raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0,5);
  if(!expMap[key]) expMap[key] = [];
  expMap[key].push({ t: dd.valueOf(), lines });
}
// Sort expenses within each day by time (earliest first)
Object.keys(expMap).forEach(k=>{
  expMap[k] = expMap[k].sort((a,b)=>a.t-b.t).map(o=>o.lines);
});

  // Header row: days labels, right-to-left visual order (rightmost=Sunday)
  const headerLabels = ['שבת','שישי','חמישי','רביעי','שלישי','שני','ראשון'];
  const headerRow = new TableRow({ children: headerLabels.map(txt => new TableCell({ children:[ new Paragraph({ text: txt, alignment: AlignmentType.CENTER }) ] })) });

  const weekRows = [];
  for(let i=0; i<days.length; i+=7){
    const slice = days.slice(i, i+7); // [Sunday..Saturday]
    const cells = [];
    for(let col=6; col>=0; col--){ // iterate Saturday->Sunday to render RTL columns (rightmost shows Sunday)
      const d = slice[col];
      if(!d){ cells.push(new TableCell({ children:[ new Paragraph('') ] })); continue; }
      const key = d.format('YYYY-MM-DD');
      const dateLabel = d.format('DD/MM');

      const paras = [ new Paragraph({ children:[ new TextRun({ text: dateLabel, bold: true }) ], alignment: AlignmentType.RIGHT }) ];
      const dayExps = expMap[key] || [];
      dayExps.forEach((arr, idx) => {
        arr.forEach(line => paras.push(new Paragraph({ text: line, alignment: AlignmentType.RIGHT })));
        if(idx < dayExps.length - 1) paras.push(new Paragraph({ text: '', alignment: AlignmentType.RIGHT })); // blank line between expenses
      });

      cells.push(new TableCell({ children: paras }));
    }
    weekRows.push(new TableRow({ children: cells }));
  }

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      children: [
        new Paragraph({ text: (t.destination ? `לו"ז טיול – ${t.destination}` : 'לו"ז טיול'), heading: HeadingLevel.HEADING_2, alignment: AlignmentType.RIGHT }),
        new Paragraph({ text: `${fmtDate(t.start)} – ${fmtDate(t.end)}`, alignment: AlignmentType.RIGHT }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: Array(7).fill(1200), rows: [headerRow, ...weekRows] })
      ]
    }]
  });

  const fileName = `FLYMILY_Trip_Schedule_${(t.destination||'trip').replace(/\\s+/g,'_')}.docx`;
  const blob = await Packer.toBlob(doc);
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName; a.click();
  setTimeout(()=> URL.revokeObjectURL(a.href), 2000);
  toast('נוצר קובץ לו"ז טיול (Word)');
}

// Wire the new Export Trip Schedule button
document.addEventListener('DOMContentLoaded', ()=>{
  const btn = document.getElementById('btnExportTripSchedule');
  if(btn){ btn.addEventListener('click', ()=> exportTripScheduleWord()); }
});






// ---- Explicit login flow only (no auto-submit) ----
let __loginInFlight = false;
async function loginWithCredentials(emailSel='#authEmail', passSel='#authPass', errSel='#authError'){
  if(__loginInFlight) return;
  __loginInFlight = true;
  try{
    const email = document.querySelector(emailSel)?.value?.trim();
    const pass  = document.querySelector(passSel)?.value;
    if(!email || !pass){
      const e = document.querySelector(errSel);
      if(e) e.textContent = 'אנא מלא אימייל וסיסמה';
      return;
    }
    await FB.signInWithEmailAndPassword(FB.auth, email, pass);
    const e = document.querySelector(errSel); if(e) e.textContent = '';
  }catch(err){
    const e = document.querySelector('#authError'); if(e) e.textContent = (err?.code || err?.message || 'שגיאת התחברות');
    console.error('login failed', err);
  }finally{
    __loginInFlight = false;
  }
}
document.addEventListener('click', (ev)=>{
  const t = ev.target;
  if(!t) return;
  if(t.matches('#authPrimary')){ loginWithCredentials(); }
});
// ===== Auth UI helpers (final) =====
// Toggle app/login screens on auth state change + start subscriptions
if (typeof FB !== 'undefined' && FB?.onAuthStateChanged) {
  let __lastAuthUid = null;
  FB.onAuthStateChanged(FB.auth, (user) => {
    console.log('auth state', !!user, user?.uid);
    if((user?.uid||null)===__lastAuthUid){ return; }
    __lastAuthUid = user?.uid||null;
    const emailSpan = document.getElementById('currentUserEmail');
    const btnLogin = document.getElementById('btnLogin');
    const btnLogout = document.getElementById('btnLogout');
    const loginScreen = document.getElementById('loginScreen');
    const appContainer = document.querySelector('.container'); // Select the actual content wrapper
    const appEl = document.querySelector('.app'); // Main app wrapper (should usually stay visible)

    // Ensure .app is visible, unless in share/readOnly mode logic handles it
    if (appEl) appEl.style.display = 'grid'; // Restore the display setting if it was hidden globally

    if (user) {
      if(emailSpan){ emailSpan.textContent = user.email || ''; emailSpan.style.display='inline-block'; }
      if(btnLogin) btnLogin.style.display='none';
      const ub=document.getElementById('userBadge'); if(ub) ub.style.display='inline-flex';
      // User is logged in: Hide login, show app content
      if (loginScreen) loginScreen.style.display = 'none';
      if (appContainer) appContainer.style.display = 'grid'; // Show the main app content
      state.user = user;
      try { subscribeTrips(user.uid); } catch(e){ console.warn('subscribeTrips error', e); }
    } else {
      if(emailSpan){ emailSpan.textContent=''; emailSpan.style.display='none'; }
      if(btnLogin) btnLogin.style.display='inline-block';
      const ub=document.getElementById('userBadge'); if(ub) ub.style.display='none';
      // User is logged out: Show login, hide app content
      if (authModal?.showModal) authModal.showModal(); if(loginScreen) loginScreen.style.display='none'; // Show the login screen
      if (appContainer) appContainer.style.display = 'none'; // Hide the main app content
      state.user = null;
    }
  });
}
try { console.log('firebase project', FB?.auth?.app?.options?.projectId); } catch(e){}


// === Mobile Preview Presets & Rotation ===
(function(){
  const mobileBtn = document.getElementById('btnMobilePreview');
  const rotateBtn = document.getElementById('btnRotate');
  const presetSel = document.getElementById('devicePreset');
  const appEl = document.querySelector('.app');
  if(!appEl) return;

  // Device map (CSS pixels, portrait)
  const DEVICES = {
    'iphone-13-pro-max': { w: 428, h: 926 },
    'iphone-13-14':      { w: 390, h: 844 },
    'iphone-se-3':       { w: 375, h: 667 },
    'pixel-7':           { w: 412, h: 915 },
    'galaxy-s23':        { w: 360, h: 780 },
  };

  function getState(){
    return {
      on: document.body.classList.contains('mobile-preview'),
      preset: localStorage.getItem('previewMobile.preset') || 'iphone-13-pro-max',
      landscape: localStorage.getItem('previewMobile.landscape') === '1'
    };
  }

  function saveState(s){
    localStorage.setItem('previewMobile.preset', s.preset);
    localStorage.setItem('previewMobile.landscape', s.landscape ? '1':'0');
  }
  const emailSpan = document.getElementById('currentUserEmail');
  function applyDims(){
    const s = getState();
    const d = DEVICES[s.preset] || DEVICES['iphone-13-pro-max'];
    const w = s.landscape ? d.h : d.w;
    const h = s.landscape ? d.w : d.h;
    if (document.body.classList.contains('mobile-preview')) {
      appEl.style.width = w + 'px';
      appEl.style.height = h + 'px';
    } else {
      appEl.style.width = '';
      appEl.style.height = '';
    }
    // Invalidate maps after resize (best-effort)
    try {
      setTimeout(() => {
        if (window.state?.maps?.big) window.invalidateMap(state.maps.big);
        if (window.state?.maps?.mini) window.invalidateMap(state.maps.mini);
      }, 120);
    } catch(_){}
  }

  // init UI state
  const preset = localStorage.getItem('previewMobile.preset') || 'iphone-13-pro-max';
  if (presetSel) presetSel.value = preset;
  const landscape = localStorage.getItem('previewMobile.landscape') === '1';
  if (landscape && rotateBtn) rotateBtn.classList.add('active');
  if (localStorage.getItem('previewMobile') === '1') {
    document.body.classList.add('mobile-preview');
    if (mobileBtn) mobileBtn.classList.add('active');
  }
  applyDims();

  // handlers
  mobileBtn && mobileBtn.addEventListener('click', () => {
    const on = document.body.classList.toggle('mobile-preview');
    mobileBtn.classList.toggle('active', on);
    localStorage.setItem('previewMobile', on ? '1':'0');
    applyDims();
  });

  presetSel && presetSel.addEventListener('change', (e) => {
    const s = getState();
    s.preset = e.target.value;
    saveState(s);
    applyDims();
  });

  rotateBtn && rotateBtn.addEventListener('click', () => {
    const s = getState();
    s.landscape = !s.landscape;
    rotateBtn.classList.toggle('active', s.landscape);
    saveState(s);
    applyDims();
  });

  // Re-apply on window resize or theme toggle
  window.addEventListener('resize', applyDims);
})();
// === end Mobile Preview Presets & Rotation ===


// --- Keyword highlighting helpers (all occurrences) ---
function clearMarks(root){
  try{
    root.querySelectorAll('mark').forEach(m=>{
      const t = document.createTextNode(m.textContent);
      m.replaceWith(t);
    });
  }catch(e){ /* ignore */ }
}
function highlightAllInContainer(container, s){
  if(!container || !s) return null;
  clearMarks(container);
  const rx = new RegExp('(' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  container.innerHTML = container.innerHTML.replace(rx, '<mark>$1</mark>');
  const first = container.querySelector('mark');
  if(first){ first.scrollIntoView({behavior:'smooth', block:'center'}); }
  return first;
}

// --- Make highlight pills clickable: jump to appropriate tab and highlight there ---
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('.hl-pill');
  if (!el) return;
  const tripId = el.dataset.trip;
  const term = el.dataset.term || '';
  const type = el.dataset.type || 'meta';
  const itemId = el.dataset.item || null;
  searchAndNavigate(tripId, term, type, itemId);
});
// --- end Keyword highlighting helpers ---


// --- Make types pill clickable: jump to Meta and highlight all occurrences ---
document.addEventListener('click', (ev)=>{
  const pill = ev.target.closest('.types-pill');
  if(!pill) return;
  const row = pill.closest('.trip-row');
  const tripId = row ? row.getAttribute('data-trip') : pill.getAttribute('data-trip');
  const kw = (pill.getAttribute('data-keyword') || pill.textContent || '').trim();
  if(!tripId || !kw) return;
  ev.stopPropagation();
  openTrip(tripId).then(()=>{
    const btn = document.querySelector('#tabs button[data-tab="meta"]');
    if(btn) btn.click();
    setTimeout(()=>{
      const cont = document.querySelector('#view-meta') || document;
      highlightAllInContainer(cont, kw);
      pill.classList.add('active');
    }, 250);
  });
}, true);
// --- end types pill click ---

// expose for inline onclick in templates
window.searchAndNavigate = searchAndNavigate;


// === ensureExpenseCurrencyOption auto-run on select appear ===
(function(){
  let armed = false;
  const run = () => {
    if (typeof ensureExpenseCurrencyOption === 'function') {
      requestAnimationFrame(() => ensureExpenseCurrencyOption());
    }
  };
  const obs = new MutationObserver(muts => {
    if (armed) return;
    for (const m of muts) {
      if (m.addedNodes && m.addedNodes.length) {
        if (document.querySelector('select[id*="curr"], select[name*="curr"], select[id*="Currency"], select[name*="Currency"]')) {
          armed = true;
          run();
          setTimeout(() => armed = false, 1500); // allow future loads
          break;
        }
      }
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  // also try once on DOM ready
  if (document.readyState !== 'loading') run();
  else document.addEventListener('DOMContentLoaded', run, { once: true });
})();


// --- Utils: linkify plain text into clickable <a> tags (http/https + www + emails) ---

function normalizeEditorLinks(editor){
  if(!editor) return;
  editor.querySelectorAll('a').forEach(a=>{
    try{
      const href = a.getAttribute('href')||'';
      const txt = (a.textContent||'').trim();
      const looksRaw = (txt === href) || /^https?:\/\//.test(txt);
      const tooLong = txt.length > 40 || href.length > 60;
      if (looksRaw || tooLong){
        a.classList.add('link-icon');
        a.textContent = '';
        a.style.display = 'inline-flex';
      }
      a.setAttribute('target','_blank');
      a.setAttribute('rel','noopener');
      a.style.display = 'inline';
    }catch(_){}
  });
}

function pasteAsIconLink(editor, url){
  const a = document.createElement('a');
  a.href = url;
  a.className = 'link-icon';
  a.textContent = '';
  a.style.display = 'inline-flex';
  a.target = '_blank';
  a.rel = 'noopener';
  const sel = window.getSelection();
  if(sel && sel.rangeCount){ sel.getRangeAt(0).deleteContents(); sel.getRangeAt(0).insertNode(a); }
}


// --- Added: sanitizeExpenseNoLinks ---
// Keeps simple formatting (b/i/u, lists, line breaks, colored spans) and strips links & unsafe attributes.
// This mirrors the journal sanitizer policy but forbids anchors entirely for expenses.
function sanitizeExpenseNoLinks(html){
  try{
    const tmp = document.createElement('div');
    tmp.innerHTML = html || '';

    // remove dangerous nodes
    tmp.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach(n => n.remove());

    // 0) Convert raw URLs in text nodes into <a class="link-icon">
    const urlRe = /((https?:\/\/|www\.)[^\s<]+)/gi;
    const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    while(walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const text = node.nodeValue || '';
      if(!text) return;
      let m; urlRe.lastIndex = 0;
      if(!urlRe.test(text)) return;
      urlRe.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0;
      text.replace(urlRe, (match, _p1, _p2, offset) => {
        if(offset > last) frag.appendChild(document.createTextNode(text.slice(last, offset)));
        const href = match.startsWith('http') ? match : 'http://' + match;
        const a = document.createElement('a');
        a.href = href;
        a.className = 'link-icon';
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = '';
        a.style.display = 'inline-flex';
        frag.appendChild(a);
        last = offset + match.length;
        return match;
      });
      if(last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.replaceWith(frag);
    });

    // 1) Normalize any existing anchors to be icon-only + safe
    tmp.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href') || a.textContent || '';
      if(!href) { a.remove(); return; }
      if(!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) {
        a.setAttribute('href', href.startsWith('www.') ? 'http://' + href : 'http://' + href);
      }
      a.setAttribute('target','_blank');
      a.setAttribute('rel','noopener');
      // strip unsafe attributes
      [...a.attributes].forEach(attr => {
        const n = attr.name.toLowerCase();
        if (n.startsWith('on') || n === 'style') a.removeAttribute(attr.name);
      });
      a.classList.add('link-icon');
      a.textContent = '';
      a.style.display = 'inline-flex';
    });

    // 2) Sanitize attributes on remaining nodes (allow limited inline styles)
    tmp.querySelectorAll('*').forEach(el => {
      [...el.attributes].forEach(attr => {
        const n = attr.name.toLowerCase();
        if (n.startsWith('on') || n === 'src') el.removeAttribute(attr.name);
        if (n === 'style'){
          const allowed = ['color','background-color','font-weight','font-style','text-decoration'];
          const rules = (attr.value||'').split(';').map(s=>s.trim()).filter(Boolean)
            .map(rule => {
              const i = rule.indexOf(':');
              if (i === -1) return null;
              const k = rule.slice(0,i).trim().toLowerCase();
              const v = rule.slice(i+1).trim();
              return allowed.includes(k) ? `${k}:${v}` : null;
            }).filter(Boolean);
          if (rules.length) el.setAttribute('style', rules.join('; '));
          else el.removeAttribute('style');
        }
      });
    });

    return tmp.innerHTML;
  }catch(_){ return (html||''); }
}
function sanitizeJournalHTML(html){
  // Convert to DOM, post-process anchors
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  
  tmp.querySelectorAll('a').forEach(a=>{
    try{
      const href = a.getAttribute('href')||'';
      a.setAttribute('target','_blank');
      a.setAttribute('rel','noopener');

      const txt = (a.textContent||'').trim();
      const looksRaw = (txt === href) || /^https?:\/\//.test(txt);
      const tooLong = txt.length > 40 || href.length > 60;

      // If long/raw, render as a blue link icon only
      if (looksRaw || tooLong){
        a.classList.add('link-icon');
        a.textContent = '';
        a.style.display = 'inline-flex'; // icon only
        return;
      }

      // Otherwise keep user label but ensure anchors remain inline
      a.style.display = 'inline';
    }catch(_){}
  });

  return tmp.innerHTML;
}

function linkifyText(str, label){
  if (!str) return '';
  const escMap = {'&':'&','<':'<','>':'>','"':'"','\'':'\''};
  const safe = String(str).replace(/[&<>"']/g, m=>escMap[m]);
  const urlPattern = /(?:https?:\/\/|www\.)[\w.-]+(?:\.[a-z]{2,})(?:[\w\-._~:\/?#\[\]@!$&'()*+,;=%]*)/gi;
  const singleUrlPattern = new RegExp('^' + urlPattern.source + '$','i');
  const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

  // Handle multi-line: each line that is purely a URL becomes a text anchor with the given label.
  const out = safe.split(/\r?\n/).map(line => {
    const trimmed = line.trim();
    if (trimmed && singleUrlPattern.test(trimmed)){
      const href = trimmed.startsWith('http') ? trimmed : 'http://' + trimmed;
      return '<a class="link-icon" href="'+href+'" target="_blank" rel="noopener" aria-label="קישור"></a>';
    }
    return line
      .replace(urlPattern, m=>{
        const href = m.startsWith('http') ? m : 'http://' + m;
        return '<a class="link-icon" href="'+href+'" target="_blank" rel="noopener" aria-label="קישור"></a>';
      })
      .replace(emailPattern, m=>'<a class="mail-icon" href="mailto:'+m+'" aria-label="מייל"></a>');
  }).join('<br>');
  return out;
}

function linkifyToIcons(str){
  if(!str) return '';
  // Escape '&','<','>' minimally for safety when input is plain text (not HTML)
  const escaped = String(str).replace(/[&<>]/g, m=>({'&':'&','<':'<','>':'>'}[m]));
  // If looks like HTML (has tags), continue; otherwise work on text
  const tmp = document.createElement('div');
  tmp.innerHTML = escaped;
  const urlRe = /((https?:\/\/|www\.)[^\s<]+)/gi;
  const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  while(walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    const text = node.nodeValue || '';
    if(!text) return;
    urlRe.lastIndex = 0;
    if(!urlRe.test(text)) return;
    urlRe.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0;
    text.replace(urlRe, (match, _p1, _p2, offset) => {
      if(offset > last) frag.appendChild(document.createTextNode(text.slice(last, offset)));
      const href = match.startsWith('http') ? match : 'http://' + match;
      const a = document.createElement('a');
      a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.className = 'link-icon'; a.textContent=''; a.style.display='inline-flex';
      frag.appendChild(a);
      last = offset + match.length;
      return match;
    });
    if(last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.replaceWith(frag);
  });
  return tmp.innerHTML;
}




// --- Normalize place display: "name, city, country" ---
function formatPlace(raw){
  if (!raw) return '';
  const parts = String(raw).split(',').map(s=>s.trim()).filter(Boolean);
  // remove pure house numbers / postal codes
  const cleaned = parts.filter(p=>!/^\d+[A-Za-z-]*$/.test(p));
  if (cleaned.length === 0) return raw;
  const country = cleaned[cleaned.length-1];
  const cityOrRegion = cleaned.length>=2 ? cleaned[cleaned.length-2] : '';
  const name = cleaned[0];
  // Avoid duplication if name equals city
  const arr = [name];
  if (cityOrRegion && cityOrRegion.toLowerCase() !== name.toLowerCase()) arr.push(cityOrRegion);
  if (country && country.toLowerCase() !== cityOrRegion.toLowerCase()) arr.push(country);
  return arr.join(', ');
}



/** Safe stub: expense summary bar is currently removed from DOM.
 * Keep API stable so callers don't crash.
 */

function renderExpenseSummary(t){
  const bar = document.getElementById('expenseSummary');
  if(!bar || !t) return;

  const cur = getActiveCurrencyFromTrip(t);

  const budgetObj = t.budget || {};
  function getBudget(cur){
    const direct = Number(budgetObj[cur] || 0);
    if(direct) return direct;
    const tryUSD = budgetObj.USD ? convertAmount(budgetObj.USD,'USD',cur,state.rates) : 0;
    const tryEUR = budgetObj.EUR ? convertAmount(budgetObj.EUR,'EUR',cur,state.rates) : 0;
    const tryILS = budgetObj.ILS ? convertAmount(budgetObj.ILS,'ILS',cur,state.rates) : 0;
    return Number(tryUSD || tryEUR || tryILS || 0);
  }
  const budgetRaw = getBudget(cur);

  let paid = 0;
  const ex = t.expenses || {};
  for(const id in ex){
    const e = ex[id] || {};
    const amt = Number(e.amount || 0);
    const from = e.currency || cur;
    const localRates = e.rates || state.rates || {};
    paid += convertAmount(amt, from, cur, localRates);
  }

  const balance = budgetRaw - paid;
  const isNeg = balance < 0;

  let pct = 0;
  if (budgetRaw > 0) {
    pct = Math.max(0, Math.round((paid / budgetRaw) * 100));
  } else if (budgetRaw === 0 && paid > 0) {
    pct = 100;
  }
  const over = paid > budgetRaw;
  const band = over ? 'danger' : (pct >= 80 ? 'warn' : 'ok');

  const fmt = (n)=> formatInt(Math.round(n));
  const fmtSigned = (n)=> formatIntSigned(Math.round(n));

  bar.innerHTML = `
    <button id="barCurrency" class="btn" title="החלף מטבע">${cur}</button>
    <div class="kpi"><span class="lbl">תקציב</span><span class="val">${fmt(budgetRaw)} ${cur}</span></div>
    <div class="kpi"><span class="lbl">שולם</span><span class="val">${fmt(paid)} ${cur}</span></div>
    <div class="kpi"><span class="lbl">יתרה</span><span class="val bold ${isNeg ? 'neg' : ''}">${fmtSigned(balance)} ${cur}</span></div>
    <div class="budget-progress ${band}" aria-label="התקדמות תקציב">
      <div class="track"><div class="fill" style="width:${pct}%"></div></div>
      <div class="pct" aria-hidden="true">${pct}%</div>
    </div>
  `;
}

// === GPX Import (to Journal) ===
async function importGPXFromFile(file){
  try{
    if(!file){ if(typeof toast==='function') toast('לא נבחר קובץ'); return; }
    const tid = state.currentTripId;
    if(!tid){ if(typeof toast==='function') toast('פתח נסיעה לפני ייבוא'); return; }
    const xmlText = await file.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, 'application/xml');
    const wpts = Array.from(xml.getElementsByTagName('wpt'));
    const trkpts = Array.from(xml.getElementsByTagName('trkpt'));
    const points = [];

    function getTag(el, name){
      const t = el.getElementsByTagName(name)[0];
      return t ? (t.textContent || '').trim() : '';
    }
    function getExt(el, name){
      const exts = el.getElementsByTagName('extensions')[0];
      if(!exts) return '';
      const found = exts.getElementsByTagName(name)[0];
      return found ? (found.textContent || '').trim() : '';
    }

    wpts.forEach(el=>{
      const lat = Number(el.getAttribute('lat'));
      const lng = Number(el.getAttribute('lon'));
      if(Number.isFinite(lat) && Number.isFinite(lng)){
        points.push({
          lat, lng,
          _name: getTag(el,'name') || 'נקודה',
          _desc: getTag(el,'desc'),
          _time: getTag(el,'time'),
          _source: getExt(el,'source') || 'journal'
        });
      }
    });
    trkpts.forEach((el,i)=>{
      const lat = Number(el.getAttribute('lat'));
      const lng = Number(el.getAttribute('lon'));
      if(Number.isFinite(lat) && Number.isFinite(lng)){
        points.push({
          lat, lng,
          _name: 'מסלול',
          _desc: '',
          _time: getTag(el,'time'),
          _source: 'journal'
        });
      }
    });

    if(!points.length){ if(typeof toast==='function') toast('לא נמצאו נקודות GPX'); return; }

    const ref = FB.doc(db, 'trips', state.currentTripId);
    const snap = await FB.getDoc(ref);
    const t = snap.exists() ? (snap.data() || {}) : {};
    t.journal = t.journal || {};

    let added = 0;
    points.forEach(p=>{
      const id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()));
      t.journal[id] = {
        text: p._desc || '',
        placeName: p._name || '',
        placeUrl: '',
        lat: p.lat, lng: p.lng,
        createdAt: p._time ? new Date(p._time).toISOString() : new Date().toISOString()
      ,
    dateIso: _jr_dateIso,
    date: __jr_dateStr,
    time: __jr_timeStr};
      added++;
    });

    await FB.updateDoc(ref, { journal: t.journal });
    if(typeof toast==='function') toast(`ייבוא GPX הושלם — נוספו ${added} נקודות ליומן`);
    await loadTrip();
    switchToTab('map');
  }catch(e){
    console.error('GPX import failed', e);
    if(typeof toast==='function') toast('שגיאה בייבוא GPX');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnImportGPX');
  const file = document.getElementById('importGPXFile');
  if(btn && file){
    btn.addEventListener('click', ()=> file.click());
    file.addEventListener('change', () => {
      if(!file.files || !file.files[0]) return;
      importGPXFromFile(file.files[0]);
      file.value = '';
    });
  }
});


// --- delegated handler: works even if button is injected later ---
document.addEventListener('click', async (e)=>{
  const btn = e.target && e.target.closest && e.target.closest('#btnDeleteSelectedJournal');
  if(!btn) return;
  e.preventDefault();
  if(!state.journalSelectionMode){
    state.journalSelectedIds = new Set();
    state._jrLastIndex = null;
    state.journalSelectionMode = true;
    if(btn) btn.textContent = 'מחק (0)';
    if(state.current) renderJournal(state.current, state.journalSort);
    return;
  }
  const count = state.journalSelectedIds ? state.journalSelectedIds.size : 0;
  if(count === 0){
    state.journalSelectionMode = false;
    if(btn) btn.textContent = 'מחק נבחרים';
    if(state.current) renderJournal(state.current, state.journalSort);
    return;
  }
  showConfirm(`למחוק ${count} רשומות?`, async ()=>{
    const ids = Array.from(state.journalSelectedIds);
    try{ await deleteJournalBulkLocal(ids); }catch(_){}
    state.journalSelectionMode = false;
    state.journalSelectedIds = new Set();
    state._jrLastIndex = null;
    if(btn) btn.textContent = 'מחק נבחרים';
    document.getElementById('confirmDeleteModal')?.close?.();
  });
});
// --- end delegated handler ---


// --- Journal selection: MutationObserver to ensure checkboxes appear ---
(function(){
  const list = document.getElementById('journalList');
  if(!list) return;
  function decorate(){
    if(!state.journalSelectionMode) return;
    const cards = list.querySelectorAll('.journal-card');
    state._jrRenderOrder = Array.from(cards).map((el, idx)=>{ el.dataset.idx = idx; return el.dataset.id; });
    cards.forEach(card=>{
      card.classList.add('select-mode');
      let box = card.querySelector('.jr-select-box');
      if(!box){
        box = document.createElement('div');
        box.className = 'jr-select-box';
        box.innerHTML = `<input type="checkbox" class="jr-select" />`;
        card.appendChild(box);
      }
      const cb = box.querySelector('input');
      cb.checked = state.journalSelectedIds?.has(card.dataset.id) || false;
      cb.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        const id = card.dataset.id;
        const idx = Number(card.dataset.idx||0);
        if(ev.shiftKey && state._jrLastIndex!=null){
          const a = Math.min(state._jrLastIndex, idx);
          const b = Math.max(state._jrLastIndex, idx);
          for(let i=a;i<=b;i++){
            const idAt = state._jrRenderOrder[i];
            state.journalSelectedIds.add(idAt);
            const el = list.querySelector(`.journal-card[data-id="${idAt}"] input.jr-select`);
            if(el) el.checked = true;
          }
        }else{
          if(cb.checked) state.journalSelectedIds.add(id);
          else state.journalSelectedIds.delete(id);
          state._jrLastIndex = idx;
        }
        const delBtn = document.getElementById('btnDeleteSelectedJournal');
        if(delBtn) delBtn.textContent = `מחק (${state.journalSelectedIds.size||0})`;
      });
      card.addEventListener('click', (e)=>{
        if(!state.journalSelectionMode) return;
        if(e.target.closest('.menu-btn') || e.target.closest('a')) return;
        const cb = card.querySelector('input.jr-select');
        if(cb) cb.click();
      });
    });
  }
  const mo = new MutationObserver(()=> decorate());
  mo.observe(list, { childList:true, subtree:true });
  setTimeout(decorate, 0);
})();
// --- end MutationObserver block ---

// --- cancel selection handler (delegated) ---
document.addEventListener('click', (e)=>{
  const c = e.target && e.target.closest && e.target.closest('#btnCancelSelectionJournal');
  if(!c) return;
  e.preventDefault();
  state.journalSelectionMode = false;
  state.journalSelectedIds = new Set();
  state._jrLastIndex = null;
  const btn = document.getElementById('btnDeleteSelectedJournal');
  if(btn) btn.textContent = 'מחק נבחרים';
  const cancelBtn = document.getElementById('btnCancelSelectionJournal');
  if(cancelBtn) cancelBtn.style.display = 'none';
  if(state.current) renderJournal(state.current, state.journalSort);
});
// --- end cancel selection handler ---


// --- ESC to exit selection mode ---
document.addEventListener('keydown', (e)=>{
  if(e.key === 'Escape' && state.journalSelectionMode){
    state.journalSelectionMode = false;
    state.journalSelectedIds = new Set();
    state._jrLastIndex = null;
    const btn = document.getElementById('btnDeleteSelectedJournal');
    if(btn) btn.textContent = 'מחק נבחרים';
    const cancelBtn = document.getElementById('btnCancelSelectionJournal');
    if(cancelBtn) cancelBtn.style.display = 'none';
    if(state.current) renderJournal(state.current, state.journalSort);
  }
});
// --- end ESC ---


// --- click on blank area inside the journal list cancels selection ---
document.addEventListener('click', (e)=>{
  if(!state.journalSelectionMode) return;
  const list = document.getElementById('journalList');
  if(!list) return;
  const inList = e.target && e.target.closest && e.target.closest('#journalList');
  const onCard = e.target && e.target.closest && e.target.closest('.journal-card');
  const interactive = e.target && e.target.closest && (e.target.closest('input,button,a,textarea,select,.menu-btn'));
  // If clicked inside the list but NOT on a card or interactive element => cancel selection
  if(inList && !onCard && !interactive){
    state.journalSelectionMode = false;
    state.journalSelectedIds = new Set();
    state._jrLastIndex = null;
    const btn = document.getElementById('btnDeleteSelectedJournal');
    if(btn) btn.textContent = 'מחק נבחרים';
    const cancelBtn = document.getElementById('btnCancelSelectionJournal');
    if(cancelBtn) cancelBtn.style.display = 'none';
    renderJournal(state.current, state.journalSort);
  }
});
// --- end blank-click cancel ---


// ALL TAB wiring
document.addEventListener('DOMContentLoaded', ()=>{
  const btnAll = document.querySelector('#tabs button[data-tab="all"]');
  if(!btnAll) return;
  btnAll.addEventListener('click', ()=>{
    try{
      // set active state
      document.querySelectorAll('#tabs button').forEach(b=>b.classList.remove('active'));
      btnAll.classList.add('active');
      // show the four sections
      const ids = ['view-overview','view-expenses','view-journal','view-map'];
      document.querySelectorAll('.tabview').forEach(v=> v.hidden = true);
      ids.forEach(id=>{ const el = document.getElementById(id); if(el) el.hidden = false; });
      // render their content
      const trip = (window.state && (state._lastTripObj || state.current)) || null;
      try{ if(trip && typeof renderExpenses==='function') renderExpenses(trip, state.expenseSort); }catch(_){}
      try{ if(trip && typeof renderJournal==='function') renderJournal(trip, state.journalSort); }catch(_){}
      try{ if(trip && typeof renderExpenseSummary==='function') renderExpenseSummary(trip); }catch(_){}
      setTimeout(()=>{ try{ if(typeof initBigMap==='function') initBigMap(); }catch(e){} }, 60);
    }catch(e){}
  });
});

// === JSON Import UI unify (three-button cluster) ===
document.addEventListener('DOMContentLoaded', () => {
  const jsonBtn = document.getElementById('btnImportJSON');
  const legacyFile = document.getElementById('importFile'); // legacy hidden input the app already uses
  const legacyBtn = document.getElementById('btnImport');   // legacy hidden button that performs the import

  if (jsonBtn && legacyFile) {
    jsonBtn.addEventListener('click', () => legacyFile.click());
    legacyFile.addEventListener('change', () => {
      // If the legacy flow relies on clicking the old button, simulate it.
      if (legacyBtn) legacyBtn.click();
    });
  }
});


// Share duration dropdown wiring
document.addEventListener('DOMContentLoaded', ()=>{
  const start = document.getElementById('btnShareStart');
  const stop  = document.getElementById('btnShareStop');
  const sel   = document.getElementById('shareDuration');
  if(start && sel){
    start.addEventListener('click', ()=>{
      state.shareDuration = sel.value; // e.g., '1d' | '1w' | '1m'
      if(typeof startShare === 'function') startShare(sel.value);
    });
  }
  if(stop && typeof stopShare === 'function'){
    stop.addEventListener('click', ()=> stopShare());
  }
});

// === Logout wiring ===
document.addEventListener('DOMContentLoaded', ()=>{
  const out = document.getElementById('btnLogout');
  if(out && !out.dataset.wired){
    out.dataset.wired='1';
    out.addEventListener('click', async ()=>{
      try{ if(typeof FB?.signOut==='function') await FB.signOut(FB.auth); }catch(e){ console.error(e); }
    });
  }
});

// === Export GPX from journal points ===
function exportGPX(){
  try{
    const t = state.current || {};
    const journal = t.journal || {};
    const points = Object.values(journal).filter(x=>Number.isFinite(x?.lat) && Number.isFinite(x?.lng));
    const name = (t.destination||'Trip');
    const gpxPts = points.map(p=>`  <wpt lat="${p.lat}" lon="${p.lng}">
    <name>${(p.placeName||'').replace(/[<&>]/g,s=>({'<':'<','>':'>','&':'&'}[s]))}</name>
    <desc>${(p.text||'').replace(/[<&>]/g,s=>({'<':'<','>':'>','&':'&'}[s]))}</desc>
  </wpt>`).join('\n');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="FLYMILY" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>${name}</name></metadata>\n${gpxPts}\n</gpx>`;
    const blob = new Blob([xml], {type:'application/gpx+xml'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `FLYMILY_${name.replace(/\s+/g,'_')}.gpx`;
    document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0);
    if(typeof toast==='function') toast('ייצוא GPX הושלם');
  }catch(e){ console.error(e); if(typeof toast==='function') toast('שגיאה ביצוא GPX'); }
}

// === Wire Import/Export/Share buttons in Share tab ===
document.addEventListener('DOMContentLoaded', ()=>{
  // Import JSON (legacy)
  const jsonBtn = document.getElementById('btnImportJSON');
  const legacyFile = document.getElementById('importFile');
  const legacyBtn = document.getElementById('btnImport');
  if(jsonBtn && legacyFile){
    jsonBtn.addEventListener('click', ()=> legacyFile.click());
    legacyFile.addEventListener('change', ()=> { if(legacyBtn) legacyBtn.click(); });
  }

  // Import GPX
  const gpxBtn = document.getElementById('btnImportGPX');
  const gpxFile = document.getElementById('importGPXFile');
  if(gpxBtn && gpxFile){
    gpxBtn.addEventListener('click', ()=> gpxFile.click());
    gpxFile.addEventListener('change', ()=>{ const f=gpxFile.files?.[0]; if(f) importGPXFromFile(f); gpxFile.value=''; });
  }

  // Import KML
  const kmlBtn = document.getElementById('btnImportKML');
  const kmlFile = document.getElementById('importKMLFile');
  if(kmlBtn && kmlFile){
    kmlBtn.addEventListener('click', ()=> kmlFile.click());
    kmlFile.addEventListener('change', ()=>{ const f=kmlFile.files?.[0]; if(f) importKMLFromFile(f); kmlFile.value=''; });
  }

  // Export
  const exl = document.getElementById('btnExportExcel');
  if(exl && typeof exportExcel==='function') exl.addEventListener('click', ()=> exportExcel());
  const wrd = document.getElementById('btnExportWord');
  if(wrd && typeof exportWord==='function') wrd.addEventListener('click', ()=> exportWord());
  const gpxOut = document.getElementById('btnExportGPX');
  if(gpxOut) gpxOut.addEventListener('click', ()=> exportGPX());

  // Share controls
  const start = document.getElementById('btnShareStart');
  const stop  = document.getElementById('btnShareStop');
  const sel   = document.getElementById('shareDuration');
  if(start){
    start.addEventListener('click', ()=>{
      const val = sel?.value || '1w';
      state.shareDuration = val;
      if(typeof startShare==='function') startShare(val);
      else if(typeof toast==='function') toast('שיתוף הופעל: ' + val);
    });
  }
  if(stop){
    stop.addEventListener('click', ()=>{
      if(typeof stopShare==='function') stopShare();
      else if(typeof toast==='function') toast('שיתוף בוטל');
    });
  }
});

window.getEmailSpan = function(){ return document.getElementById('currentUserEmail'); };


// === Logout wiring (robust) ===
document.addEventListener('DOMContentLoaded', ()=>{
  const out = document.getElementById('btnLogout');
  if(out && !out.dataset.wired){
    out.dataset.wired='1';
    out.addEventListener('click', async (e)=>{
      try{
        e.preventDefault();
        if (typeof FB !== 'undefined' && FB?.signOut) { await FB.signOut(FB.auth); }
        else if (window.firebase?.auth) { await window.firebase.auth().signOut(); }
      }catch(err){ console.error('logout failed', err); }
    });
  }
});

function safeHide(el){ if(el){ el.hidden = true; } }
function safeShow(el){ if(el){ el.hidden = false; } }


// === SAFE OVERRIDES: maps (placed at end to override corrupted earlier versions) ===
window.initMiniMap = function(t){
  try{
    if(!state.maps) state.maps = {};
    if(!state.maps.mini){
      state.maps.mini = L.map('miniMap', { zoomControl:false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' })
        .addTo(state.maps.mini);
    }
    // clear old
    if(state.maps.layers?.miniGroup){
      state.maps.mini.removeLayer(state.maps.layers.miniGroup);
    }
    const group = L.layerGroup().addTo(state.maps.mini);
    state.maps.layers = state.maps.layers || {};
    state.maps.layers.miniGroup = group;

    const pts = [];
    (Object.entries(t.expenses||{})).forEach(([id,e])=>{
      if(typeof e.lat==='number' && typeof e.lng==='number'){
        pts.push([e.lat,e.lng]);
        L.circleMarker([e.lat,e.lng], { radius:4 }).addTo(group);
      }
    });
    (Object.entries(t.journal||{})).forEach(([id,j])=>{
      if(typeof j.lat==='number' && typeof j.lng==='number'){
        pts.push([j.lat,j.lng]);
        L.circleMarker([j.lat,j.lng], { radius:4 }).addTo(group);
      }
    });
    if(pts.length){
      state.maps.mini.fitBounds(L.latLngBounds(pts).pad(0.2));
    }else{
      state.maps.mini.setView([32.0853,34.7818], 6);
    }
  }catch(e){ console.error('initMiniMap (safe) error', e); }
};

window.initBigMap = function(){
  try{
    if(!state.maps) state.maps = {};
    if(!state.maps.big){
      state.maps.big = L.map('bigMap');
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' })
        .addTo(state.maps.big);
    }
    // clear old layers
    state.maps.layers = state.maps.layers || {};
    if(state.maps.layers.expenses) state.maps.big.removeLayer(state.maps.layers.expenses);
    if(state.maps.layers.journal)  state.maps.big.removeLayer(state.maps.layers.journal);

    const expensesLG = L.layerGroup().addTo(state.maps.big);
    const journalLG  = L.layerGroup().addTo(state.maps.big);
    state.maps.layers.expenses = expensesLG;
    state.maps.layers.journal  = journalLG;

    const t = state._lastTripObj || {};
    const pts = [];

    Object.entries(t.expenses||{}).forEach(([id,e])=>{
      if(typeof e.lat==='number' && typeof e.lng==='number'){
        pts.push([e.lat,e.lng]);
        L.circleMarker([e.lat,e.lng], { radius:5 }).addTo(expensesLG);
      }
    });
    Object.entries(t.journal||{}).forEach(([id,j])=>{
      if(typeof j.lat==='number' && typeof j.lng==='number'){
        pts.push([j.lat,j.lng]);
        L.circleMarker([j.lat,j.lng], { radius:5 }).addTo(journalLG);
      }
    });

    if(pts.length){
      state.maps.big.fitBounds(L.latLngBounds(pts).pad(0.2));
    }else{
      state.maps.big.setView([32.0853,34.7818], 6);
    }
  }catch(e){ console.error('initBigMap (safe) error', e); }
};


// === KML Import (to Journal) ===
async function importKMLFromFile(file){
  try{
    if(!file){ if(typeof toast==='function') toast('לא נבחר קובץ'); return; }
    const tid = state.currentTripId;
    if(!tid){ if(typeof toast==='function') toast('פתח נסיעה לפני ייבוא'); return; }

    const xmlText = await file.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, 'application/xml');

    // KML coordinates are "lon,lat[,alt]"
    function parseCoord(txt){
      if(!txt) return null;
      const parts = txt.trim().split(/[\s,]+/);
      if(parts.length < 2) return null;
      const lon = Number(parts[0]);
      const lat = Number(parts[1]);
      if(Number.isFinite(lat) && Number.isFinite(lon)) return {lat, lng: lon};
      return null;
    }
    function getText(el, tag){
      const t = el.getElementsByTagName(tag)[0];
      return t ? (t.textContent || '').trim() : '';
    }

    const placemarks = Array.from(xml.getElementsByTagName('Placemark'));
    const points = [];

    placemarks.forEach(pm=>{
      const name = getText(pm, 'name') || 'נקודה';
      const desc = getText(pm, 'description');
      // Point
      const point = pm.getElementsByTagName('Point')[0];
      if(point){
        const coordsTxt = getText(point, 'coordinates');
        const c = parseCoord(coordsTxt);
        if(c) points.push({lat:c.lat, lng:c.lng, _name:name, _desc:desc});
      }
      // LineString/coordinates -> sample each coordinate as a journal point
      const line = pm.getElementsByTagName('LineString')[0];
      if(line){
        const coordsTxt = getText(line, 'coordinates');
        const chunks = (coordsTxt||'').trim().split(/\s+/);
        chunks.forEach(ch=>{
          const c = parseCoord(ch);
          if(c) points.push({lat:c.lat, lng:c.lng, _name:name, _desc:desc});
        });
      }
    });

    if(!points.length){ if(typeof toast==='function') toast('לא נמצאו נקודות KML'); return; }

    const ref = FB.doc(db, 'trips', state.currentTripId);
    const snap = await FB.getDoc(ref);
    const t = snap.exists() ? (snap.data() || {}) : {};
    t.journal = t.journal || {};

    let added = 0;
    points.forEach(p=>{
      const id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()));
      t.journal[id] = {
        text: p._desc || '',
        placeName: p._name || '',
        placeUrl: '',
        lat: p.lat, lng: p.lng,
        createdAt: new Date().toISOString()
      };
      added++;
    });

    await FB.updateDoc(ref, { journal: t.journal });
    if(typeof toast==='function') toast(`ייבוא KML הושלם — נוספו ${added} נקודות ליומן`);
    await loadTrip();
    switchToTab('map');
  }catch(e){
    console.error('KML import failed', e);
    if(typeof toast==='function') toast('שגיאה בייבוא KML');
  }
}


/* === Shift-Select for Journal checkboxes ===
   Allows selecting a continuous range using Shift+Click in the Journal tab.
   Works with any checkbox inside #view-journal (delegated handler, survives re-render).
*/
(function(){
  let lastIndex = null;

  function getJournalCheckboxes(){
    const view = document.getElementById('view-journal');
    if(!view) return [];
    return Array.from(view.querySelectorAll('input[type="checkbox"]')).filter(cb=>!cb.disabled);
  }

  // Use capture on 'click' so we can see e.shiftKey reliably
  document.addEventListener('click', function(e){
    const target = e.target;
    if(!(target instanceof HTMLElement)) return;
    if(target.matches('#view-journal input[type="checkbox"]')){
      const boxes = getJournalCheckboxes();
      const idx = boxes.indexOf(target);
      if(idx === -1) return;

      if(e.shiftKey && lastIndex !== null && lastIndex !== idx){
        const [start, end] = idx > lastIndex ? [lastIndex, idx] : [idx, lastIndex];
        const shouldCheck = target.checked; // mirror the state of the clicked box
        for(let i=start; i<=end; i++){
          const cb = boxes[i];
          if(cb && !cb.disabled){
            cb.checked = shouldCheck;
            cb.dispatchEvent(new Event('change', { bubbles:true })); // notify any listeners
          }
        }
        // Prevent native text selection while shift-click dragging
        e.preventDefault();
      }else{
        // Single click – still let any selection-mode listeners know
        target.dispatchEvent(new Event('change', { bubbles:true }));
      }
      lastIndex = idx;
    }
  }, true);

  // Reset lastIndex when leaving the tab to avoid cross-view ranges
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape') lastIndex = null;
  });
  window.addEventListener('hashchange', ()=>{ lastIndex = null; });
  document.addEventListener('visibilitychange', ()=>{ if(document.hidden) lastIndex = null; });
})();
// === End Shift-Select ===

function renderCategoryBreakdownNode(targetId){
  const el = document.getElementById(targetId); if(!el) return;
  const local = 'ILS';
  const expenses = (state && state.current && (Array.isArray(state.current.expenses) ? state.current.expenses : Object.values(state.current.expenses||{}))) || [];
  const breakdown = {}; let total = 0;
  expenses.forEach(e=>{
    const cat = e?.category || 'אחר';
    const amt = Number(e?.amount||0);
    const from = e?.currency || 'ILS';
    const normalized = (typeof convertAmount==='function') ? convertAmount(amt, from, local, state?.rates) : amt;
    breakdown[cat] = (breakdown[cat]||0) + (isFinite(normalized)?normalized:0);
    total += (isFinite(normalized)?normalized:0);
  });
  const cats = Object.entries(breakdown).sort((a,b)=>b[1]-a[1]);
  const fmt = (n)=> (Number(n||0)).toLocaleString('he-IL',{maximumFractionDigits:0});
  let html = `<table class="breakdown-table"><thead><tr><th>קטגוריה</th><th>סכום (ILS)</th><th>אחוז</th></tr></thead><tbody>`;
  cats.forEach(([cat,sum])=>{
    const pct = total? (sum/total*100):0;
    html += `<tr><td>${cat}</td><td>${fmt(sum)}</td><td style="min-width:180px"><div class="breakdown-row-bar"><span style="width:${pct.toFixed(1)}%"></span></div><div class="muted">${pct.toFixed(1)}%</div></td></tr>`;
  });
  html += `<tr><td class="breakdown-total">סה"כ</td><td class="breakdown-total">${fmt(total)}</td><td></td></tr>`;
  html += `</tbody></table>`;
  el.innerHTML = html;
}


// === Bind "סיכום פילוח" button reliably ===
(function(){
  function openBreakdown(){
    const dlg = document.getElementById('breakdownDialog');
    if(!dlg) return;
    if (typeof renderCategoryBreakdownNode === 'function'){
      renderCategoryBreakdownNode('categoryBreakdownDialog');
    }
    if(dlg.showModal) dlg.showModal(); else dlg.setAttribute('open','');
  }
  function closeBreakdown(){ document.getElementById('breakdownDialog')?.close(); }

  function bindOnce(){
    const btn = document.getElementById('openBreakdownBtn');
    if(btn && !btn.dataset.bound){
      btn.type = btn.type || 'button';
      btn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); openBreakdown(); });
      btn.dataset.bound = '1';
    }
    const closeBtn = document.getElementById('closeBreakdownDlg');
    const dlg = document.getElementById('breakdownDialog');
    if(closeBtn && !closeBtn.dataset.bound){
      closeBtn.addEventListener('click', (e)=>{ e.preventDefault(); closeBreakdown(); });
      closeBtn.dataset.bound = '1';
    }
    // Close on Esc/outside
    if(dlg && !dlg.dataset.bound){
      document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && dlg.open) closeBreakdown(); });
      document.addEventListener('click', (e)=>{
        if(!dlg.open) return;
        const r = dlg.getBoundingClientRect();
        const inside = e.clientX>=r.left && e.clientX<=r.right && e.clientY>=r.top && e.clientY<=r.bottom;
        if(!inside) closeBreakdown();
      });
      dlg.dataset.bound = '1';
    }
  }

  // Bind now + keep trying (handles dynamic DOM)
  document.addEventListener('DOMContentLoaded', ()=>{
    bindOnce();
    let tries = 0;
    const iv = setInterval(()=>{
      tries++;
      bindOnce();
      if(tries>20) clearInterval(iv); // try ~20 times (~20s)
    }, 1000);
  });
})();

// === Print Preview (Trip Schedule) ===
(function(){
  function openPrintPreview(){
    try{
      const source = document.querySelector('#view-overview') || document.querySelector('#overview') || document.body;
      const clone = source.cloneNode(true);
      const w = window.open('', '_blank', 'noopener,noreferrer');
      if(!w){ alert('לא ניתן לפתוח חלון תצוגה (יתכן שחסימת פופ-אפים פעילה).'); return; }
      const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>תצוגה לפני הדפסה</title>
  <link rel="stylesheet" href="./style.css">
  <style>
    body{padding:16px}
    .toolbar{display:flex;gap:8px;margin-bottom:12px}
    .toolbar .btn{border:1px solid #ccc;border-radius:10px;padding:8px 12px;background:transparent;cursor:pointer}
    @media print {.toolbar{display:none !important}}
    table{width:100%;border-collapse:collapse} th,td{border:1px solid #e3e3e3;padding:6px 8px} th{background:#f7f7f7}
    .card{break-inside:avoid;page-break-inside:avoid}
  </style>
</head>
<body>
  <div class="toolbar"><button class="btn" onclick="print()">🖨️ הדפס</button><button class="btn" onclick="close()">✖️ סגור</button></div>
  <main id="printRoot"></main>
</body>
</html>`;
      w.document.open(); w.document.write(html); w.document.close();
      w.document.getElementById('printRoot')?.appendChild(clone);
      Array.from(w.document.querySelectorAll('[hidden]')).forEach(el=>el.removeAttribute('hidden'));
    }catch(e){ console.error('print preview error', e); alert('שגיאה בתצוגה לפני הדפסה'); }
  }
  window.openTripPrintPreview = openPrintPreview;
  document.addEventListener('DOMContentLoaded', ()=>{
    const btn = document.getElementById('btnExportTripSchedule');
    if(btn && !btn.dataset._ppBound){
      btn.dataset._ppBound = '1';
      btn.textContent = 'הצג לפני הדפסה';
      btn.addEventListener('click', (ev)=>{ ev.preventDefault(); ev.stopPropagation(); openPrintPreview(); });
    }
  });
})();
// === End Print Preview ===


// === Robust RTF toolbar wiring for contentEditable editors ===
(function(){
  // Robust RTF binder for Chrome desktop + mobile
  function saveSelWithin(root){
    const sel = window.getSelection();
    if(!sel || sel.rangeCount===0) return null;
    const r = sel.getRangeAt(0).cloneRange();
    if(root && r && !root.contains(r.commonAncestorContainer)) return null;
    return r;
  }
  function restoreSel(r){
    if(!r) return;
    const sel=window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }
  function ensureFocus(el){ if(document.activeElement!==el) el.focus({preventScroll:true}); }
  function exec(cmd,val){
    try{ document.execCommand('styleWithCSS', false, true); }catch(_){}
    try{ document.execCommand(cmd,false,val); return true; }catch(_){ return false; }
  }
  function wrapSelection(style, tag){
    const sel = window.getSelection();
    if(!sel || sel.rangeCount===0) return false;
    const r = sel.getRangeAt(0);
    const span = document.createElement(tag||'span');
    Object.assign(span.style, style||{});
    try{
      r.surroundContents(span);
      return true;
    }catch(_){
      // fallback: insert nodes
      const frag = r.extractContents();
      span.appendChild(frag);
      r.insertNode(span);
      return true;
    }
  }
  function bind(editor, bubble){
    if(!editor || !bubble) return;
    if(editor.dataset._rtfBound) return;
    editor.dataset._rtfBound='1';
    bubble.hidden=false;
    bubble.classList.remove('hidden');

    let saved=null;
    const remember=()=>{ saved = saveSelWithin(editor); };

    // save on most selection changes
    editor.addEventListener('keyup', remember);
    editor.addEventListener('mouseup', remember);
    document.addEventListener('selectionchange', ()=>{
      const sel = window.getSelection();
      if(!sel || sel.rangeCount===0) return;
      const n = sel.anchorNode;
      if(n && editor.contains(n)) saved = saveSelWithin(editor);
    });

    // keep selection when clicking toolbar
    bubble.addEventListener('mousedown', e=> e.preventDefault());

    // format buttons
    bubble.querySelectorAll('.fmt[data-cmd]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        ensureFocus(editor);
        // if selection lost, try to restore
        if(!saveSelWithin(editor)) restoreSel(saved);
        // try execCommand, else manual wrap
        const c = btn.getAttribute('data-cmd');
        let ok=false;
        if(c==='bold'||c==='italic'||c==='underline'){
          ok = exec(c);
          if(!ok){
            const tag = c==='bold'?'strong':(c==='italic'?'em':'span');
            const style = c==='underline'?{textDecoration:'underline'}:{};
            ok = wrapSelection(style, tag);
          }
        }else{
          ok = exec(c);
        }
        editor.dispatchEvent(new Event('input'));
      });
    });

    // color dots -> highlight background; black clears
    bubble.querySelectorAll('.dot[data-color]').forEach(dot=>{
      dot.addEventListener('click', ()=>{
        ensureFocus(editor);
        if(!saveSelWithin(editor)) restoreSel(saved);
        const color = dot.getAttribute('data-color')||'#000000';
        let ok=false;
        if(color==='#000000'){
          try{ exec('removeFormat'); ok=true; }catch(_){}
          if(!ok){ wrapSelection({backgroundColor:'transparent'}); }
        }else{
          ok = exec('hiliteColor', color) || exec('backColor', color);
          if(!ok){ wrapSelection({backgroundColor: color}); }
        }
        editor.dispatchEvent(new Event('input'));
      });
    });
  }

  window._bindRTFEditors = function(){
    bind(document.getElementById('jrText'), document.getElementById('rtfBubble'));
    bind(document.getElementById('expText'), document.getElementById('rtfBubbleExp'));
  };

  document.addEventListener('DOMContentLoaded', ()=>{ try{ window._bindRTFEditors(); }catch(_){} });
  // also after expense modal open
  document.addEventListener('openExpenseModal', ()=>{ try{ window._bindRTFEditors(); }catch(_){} });
})();// === End RTF wiring ===


// === Text color (foreColor) utilities ===
(function(){
  function saveSelection(){
    const sel = window.getSelection();
    if(!sel || sel.rangeCount===0) return null;
    return sel.getRangeAt(0).cloneRange();
  }
  function restoreSelection(r){
    if(!r) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
  }
  function ensureFocus(el){ if(document.activeElement!==el){ el.focus({preventScroll:true}); } }
  function exec(cmd,val){
    try { document.execCommand(cmd,false,val); } catch(e){}
  }
  function wrapWithSpan(range, styleObj){
    if(!range || range.collapsed) return;
    const span = document.createElement('span');
    Object.assign(span.style, styleObj);
    span.appendChild(range.extractContents());
    range.insertNode(span);
  }
  window._applyTextColor = function(editor, color){
    // Try the standard command first
    exec('styleWithCSS', true);
    exec('foreColor', color);
    // Fallback: manual wrap if the command didn't change anything (Chrome sometimes no-op)
    // Heuristic: if there's a selection and no parent with inline color, wrap it.
    const sel = window.getSelection();
    if(sel && sel.rangeCount){
      const r = sel.getRangeAt(0);
      const parent = r.commonAncestorContainer.nodeType===1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentElement;
      const hasColor = parent && (parent.style && parent.style.color);
      if(!hasColor && color && color!=='initial' && color!==''){
        wrapWithSpan(r, { color });
      }
    }
    editor.dispatchEvent(new Event('input'));
  };
  window._clearInlineColor = function(editor){
    // remove inline color by selecting and removing format, then normalize
    exec('removeFormat');
    // also remove color styles from nested spans in selection
    const sel = window.getSelection();
    if(sel && sel.rangeCount){
      const r = sel.getRangeAt(0).cloneRange();
      const container = r.commonAncestorContainer.nodeType===1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentElement;
      if(container){
        container.querySelectorAll('span[style*="color"]').forEach(s=>{
          s.style.color='';
          if(!s.getAttribute('style')) s.removeAttribute('style');
        });
      }
    }
    editor.dispatchEvent(new Event('input'));
  };

  // Re-bind color dots to text color instead of highlight
  window._retargetDotsToTextColor = function(editor, bubble){
    if(!editor || !bubble) return;
    bubble.querySelectorAll('.dot[data-color]').forEach(dot=>{
      // Remove previous listeners by cloning
      const newDot = dot.cloneNode(true);
      dot.parentNode.replaceChild(newDot, dot);
      newDot.addEventListener('click', ()=>{
        const color = newDot.getAttribute('data-color') || '#000000';
        const sel = window.getSelection();
        let savedRange = null;
        if(sel && sel.rangeCount) savedRange = sel.getRangeAt(0).cloneRange();
        ensureFocus(editor);
        restoreSelection(savedRange);
        if(color === '#000000'){
          window._clearInlineColor(editor);
        }else{
          window._applyTextColor(editor, color);
        }
      });
    });
  };

  // Hook into our previous binder if exists
  document.addEventListener('DOMContentLoaded', ()=>{
    try{
      const jrText = document.getElementById('jrText');
      const jrBubble = document.getElementById('rtfBubble');
      const expText = document.getElementById('expText');
      const expBubble = document.getElementById('rtfBubbleExp');
      if(jrText && jrBubble) window._retargetDotsToTextColor(jrText, jrBubble);
      if(expText && expBubble) window._retargetDotsToTextColor(expText, expBubble);
    }catch(e){}
  });

  // Also expose a manual rebind if modals recreate DOM
  window._rebindTextColorDots = function(){
    const jrText = document.getElementById('jrText');
    const jrBubble = document.getElementById('rtfBubble');
    const expText = document.getElementById('expText');
    const expBubble = document.getElementById('rtfBubbleExp');
    if(jrText && jrBubble) window._retargetDotsToTextColor(jrText, jrBubble);
    if(expText && expBubble) window._retargetDotsToTextColor(expText, expBubble);
  };
})();

// [auto-url->anchor + icon-only]
// 1) Convert raw URLs in the DOM into <a href="...">...</a>
// 2) Turn those anchors into icon-only links (blue icon), unless opted out.
//
// Opt-out container: add data-no-autolink on any ancestor to skip.
// Opt-out link: .no-link-icon or [data-no-link-icon]
// Keep text: .show-link-text or [data-show-text]

(function(){
  var URL_RE = /(?:https?:\/\/)[^\s<>"']+/gi;

  function isEditable(node){
    if(!node || node.nodeType !== 1) return false;
    var tag = node.tagName;
    if(tag === 'INPUT' || tag === 'TEXTAREA') return true;
    if(node.isContentEditable) return true;
    return false;
  }

  function inNoAutolink(node){
    try{
      return !!(node.closest && node.closest('[data-no-autolink]'));
    }catch(e){ return false; }
  }

  function autolink(root){
    var walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node){
          if(!node.nodeValue) return NodeFilter.FILTER_REJECT;
          var parent = node.parentNode;
          if(!parent || parent.nodeType !== 1) return NodeFilter.FILTER_REJECT;
          var tag = parent.tagName;
          if(tag === 'A' || tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT;
          if(isEditable(parent)) return NodeFilter.FILTER_REJECT;
          if(inNoAutolink(parent)) return NodeFilter.FILTER_REJECT;
          if(!URL_RE.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    var nodes = [];
    var n;
    while(n = walker.nextNode()){
      nodes.push(n);
    }
    nodes.forEach(function(textNode){
      var html = textNode.nodeValue.replace(URL_RE, function(url){
        var safe = url.replace(/"/g, '&quot;');
        return '<a href="'+safe+'" rel="noopener" target="_blank">'+safe+'</a>';
      });
      var span = document.createElement('span');
      span.innerHTML = html;
      textNode.parentNode.replaceChild(span, textNode);
    });
  }

  function shouldSkip(a){
    try{
      if(!a || !a.getAttribute) return true;
      if(!a.hasAttribute('href')) return true;
      if(a.classList.contains('btn')) return true;
      if(a.getAttribute('role') === 'button') return true;
      if(a.classList.contains('menu-btn')) return true;
      if(a.closest('.leaflet-control')) return true;
      if(a.classList.contains('no-link-icon') || a.hasAttribute('data-no-link-icon')) return true;
    }catch(e){}
    return false;
  }

  function applyIconOnly(a){
    var label = (a.getAttribute('aria-label') || a.textContent || a.getAttribute('title') || a.href || '').trim();
    if(label) a.setAttribute('aria-label', label);
    a.classList.add('link-icon-only');
    if(!(a.classList.contains('show-link-text') || a.hasAttribute('data-show-text'))){
      a.textContent = '';
      if(!a.getAttribute('title')) a.setAttribute('title', a.href);
    }
  }

  function transform(root){
    autolink(root);
    var anchors = (root.querySelectorAll ? root.querySelectorAll('a[href]') : []);
    anchors.forEach(function(a){
      if(!shouldSkip(a)) applyIconOnly(a);
    });
  }

  function runInitial(){
    transform(document.body || document.documentElement);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', runInitial);
  } else {
    runInitial();
  }

  var obs = new MutationObserver(function(muts){
    for (var m of muts){
      for (var node of m.addedNodes){
        if(node.nodeType === 1){
          if(!inNoAutolink(node)) transform(node);
        }else if(node.nodeType === 3){
          var parent = node.parentNode;
          if(parent && !isEditable(parent) && !inNoAutolink(parent)){
            autolink(parent);
            if(parent.querySelectorAll){
              parent.querySelectorAll('a[href]').forEach(function(a){ if(!shouldSkip(a)) applyIconOnly(a); });
            }
          }
        }
      }
    }
  });
  try{
    obs.observe(document.documentElement, {childList:true, subtree:true});
  }catch(e){}

})();

async function forceLogout(){
  try { await (window.hardSignOut?.() || (FB?.auth?.signOut?.() ?? Promise.resolve())); } catch(_){}
  try { if ('caches' in window) { const ks = await caches.keys(); await Promise.all(ks.map(k=>caches.delete(k))); } } catch(_){}
  try { if (navigator.serviceWorker) { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r=>r.unregister().catch(()=>{}))); } } catch(_){}
  try { navigator?.credentials?.preventSilentAccess?.(); } catch(_){}
  try { const e=document.querySelector('#authEmail'); if(e) e.value=''; const p=document.querySelector('#authPass'); if(p) p.value=''; } catch(_){}
}
try { window.forceLogout = forceLogout; } catch(_){}


// === Auth Providers wiring ===
window.__bindAuthProviders = function(){
  const g = document.getElementById('btnGoogleRedirect');
  if(g && !g.dataset._bound){ g.dataset._bound='1';
    g.addEventListener('click', async (e)=>{
      e?.preventDefault?.();
      try{ await (window.forceLogout?.()||Promise.resolve()); }catch(_){}
      await FB.signInWithGoogleRedirect();
    }, {passive:false});
  }
  const a = document.getElementById('btnAppleRedirect');
  if(a && !a.dataset._bound){ a.dataset._bound='1';
    a.addEventListener('click', async (e)=>{
      e?.preventDefault?.();
      try{ await (window.forceLogout?.()||Promise.resolve()); }catch(_){}
      await FB.signInWithAppleRedirect();
    }, {passive:false});
  }
  const m = document.getElementById('btnEmailMagicLink');
  if(m && !m.dataset._bound){ m.dataset._bound='1';
    m.addEventListener('click', async (e)=>{
      e?.preventDefault?.();
      const email = document.getElementById('magicEmail')?.value?.trim();
      if(!email){ alert('נא להזין אימייל לקבלת לינק'); return; }
      try{
        await FB.sendMagicLink(email, FB.APP_BASE || (location.origin+location.pathname));
        alert('שלחנו לינק כניסה למייל. פתח/י את המייל במכשיר זה והתחבר/י.');
      }catch(err){
        alert('שגיאת לינק למייל: '+(err?.code||err?.message||err));
        console.error(err);
      }
    }, {passive:false});
  }
  const s = document.getElementById('btnSwitchAccount');
  if(s && !s.dataset._bound){ s.dataset._bound='1';
    s.addEventListener('click', async (e)=>{ e?.preventDefault?.(); try{ await (window.forceLogout?.()||Promise.resolve()); }catch(_){ } }, {passive:false});
  }
};
document.addEventListener('DOMContentLoaded', ()=> setTimeout(window.__bindAuthProviders, 0));

// Complete redirect/magic-link flows on load
(async ()=>{
  try { await FB.completeEmailLinkLogin(); } catch(_){}
  try {
    const res = await (FB.getRedirectResult ? FB.getRedirectResult(FB.auth) : null).catch(()=>null);
    if(res && res.user){
      try{ const d=document.getElementById('authModal'); if(d?.open) d.close(); }catch(_){}
      console.log('redirect login completed', res.user.uid);
    }
  } catch(err){ console.error('redirect result error', err); }
})();


// ======== PREVIEW / PRINT (links active in preview, stripped for print) =========
function buildPrintHTML(mode) {
  const container = document.querySelector('#tripsContainer') || document.querySelector('#app') || document.body;
  const temp = document.createElement('div');
  temp.innerHTML = container.innerHTML;
  if (mode === 'print') {
    temp.querySelectorAll('a').forEach(a => {
      const span = document.createElement('span');
      span.textContent = a.textContent || a.href || '';
      if (a.style?.cssText) span.style.cssText = a.style.cssText;
      a.replaceWith(span);
    });
  }
  const title = document.querySelector('.page-title')?.textContent || document.title || 'FLYMILY';
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>${title} – ${mode === 'print' ? 'הדפסה' : 'תצוגה'}</title>
  <link rel="stylesheet" href="style.css">
  <style>
    body { padding: 16px; }
    .no-print { display: ${mode === 'print' ? 'none' : 'initial'}; }
    ${mode === 'print' ? 'a { text-decoration: none !important; color: inherit !important; }' : ''}
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>
  <h1 style="margin:0 0 12px">${title}</h1>
  <div id="print-root">${temp.innerHTML}</div>
  ${mode !== 'print' ? '<div class="no-print" style="margin-top:12px;opacity:.7">בתצוגה הקישורים פעילים; להדפסה השתמש בכפתור "הדפס".</div>' : ''}
</body>
</html>`;
}

function openPreviewWindow(mode) {
  const w = window.open('', '_blank', 'noopener');
  if (!w) { alert('לא ניתן לפתוח חלון תצוגה (כנראה חסימת פופ-אפים). אפשר פופ-אפים לאתר ונסה שוב.'); return; }
  const html = buildPrintHTML(mode);
  w.document.open(); w.document.write(html); w.document.close();
  if (mode === 'print') {
    w.onload = () => { try { w.focus(); w.print(); w.onafterprint = () => { try { w.close(); } catch(_) {} }; } catch(_){} };
  }
}

(function bindPreviewPrintButtons(){
  const previewBtn = document.getElementById('btnPreview');
  const printBtn   = document.getElementById('btnPrint');
  if (previewBtn && !previewBtn.dataset._bound) {
    previewBtn.dataset._bound = '1';
    previewBtn.addEventListener('click', (e)=>{ e.preventDefault(); openPreviewWindow('preview'); }, {passive:false});
  }
  if (printBtn && !printBtn.dataset._bound) {
    printBtn.dataset._bound = '1';
    printBtn.addEventListener('click', (e)=>{ e.preventDefault(); openPreviewWindow('print'); }, {passive:false});
  }
})();
// ==============================================================================
