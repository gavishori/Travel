// script.js (clean rebuild)

// ---------- DOM helpers ----------
const el = (id) => document.getElementById(id);
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

// ---------- Global state ----------
const COUNTRY_CCY = {
  "IL":"ILS","US":"USD","GB":"GBP","DE":"EUR","FR":"EUR","ES":"EUR","IT":"EUR","PT":"EUR","NL":"EUR","BE":"EUR",
  "AT":"EUR","IE":"EUR","FI":"EUR","GR":"EUR","PL":"PLN","CZ":"CZK","SK":"EUR","HU":"HUF","RO":"RON","BG":"BGN",
  "HR":"EUR","SI":"EUR","SE":"SEK","NO":"NOK","DN":"DKK","DK":"DKK","CH":"CHF","TR":"TRY","IS":"ISK","CA":"CAD",
  "AU":"AUD","NZ":"NZD","JP":"JPY","CN":"CNY","HK":"HKD","SG":"SGD","TH":"THB","AE":"AED","SA":"SAR","EG":"EGP",
  "JO":"JOD","MA":"MAD","ZA":"ZAR","BR":"BRL","AR":"ARS","MX":"MXN"
};

const state = {
  trips: [],
  currentTripId: null,
  rates: { USD:1, EUR:0.9, ILS:3.6 },
  localCurrency: "USD",
  theme: localStorage.getItem("theme") || "dark",
  maps: { mini:null, main:null, location:null },
  locationPick: { lat:null, lng:null, forType:null, tempId:null },
  lastStatusTimer: null
};

// Map for translating trip types to Hebrew
const TRIP_TYPE_HEBREW = {
  "beach": "בטן-גב",
  "ski": "סקי",
  "trek": "טרקים",
  "other": "אחר"
};

// Store last used category and currency in local storage
const lastUsed = {
  category: localStorage.getItem("lastCategory") || "אחר",
  currency: localStorage.getItem("lastCurrency") || "USD",
};

function addCurrencyToState(code){
  if (!code) return;
  if (!(code in state.rates)) state.rates[code] = null;
}

// ---------- Store (Firebase or Local) ----------
const Store = (()=>{
  const mode = window.AppDataLayer?.mode || "local";
  const db = window.AppDataLayer?.db;
  let currentUid = null;

  const LS_KEY = "travel_journal_data_v2";
  function loadLS(){
    try{ return JSON.parse(localStorage.getItem(LS_KEY)) || { trips: {} }; }
    catch{ return { trips: {} }; }
  }
  function saveLS(data){ localStorage.setItem(LS_KEY, JSON.stringify(data)); }

  async function ensureAuthIfNeeded(){
    if (mode === "firebase"){
      await window.AppDataLayer.ensureAuth?.();
      currentUid = firebase.auth().currentUser?.uid || null;
    }
    return currentUid;
  }

  async function listTrips(){
    if (mode === "firebase"){
      const uid = await ensureAuthIfNeeded();
      const snap = await db.collection("trips").where("ownerUid","==", uid).get();
      // Sort from newest to oldest
      return snap.docs.map(d => ({ id:d.id, ...d.data() })).sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
    } else {
      const data = loadLS();
      // Sort from newest to oldest
      return Object.entries(data.trips).map(([id, t]) => ({ id, ...t })).sort((a,b)=> (b.updatedAt||0)-(a.updatedAt||0));
    }
  }

  async function createTrip(meta){
    const nowTs = Date.now();
    const trip = {
      ...meta,
      createdAt: nowTs, updatedAt: nowTs,
      budget: { USD: Number(meta.budgetUSD||0) },
      budgetLocked: !!meta.budgetLocked,
      share: { enabled:false, scope:"full" }
    };
    if (mode === "firebase"){
      const uid = await ensureAuthIfNeeded();
      const docData = { ...trip, ownerUid: uid, expenses: {}, journal: {} };
      const ref = await db.collection("trips").add(docData);
      return { id: ref.id, ...docData };
    } else {
      const data = loadLS();
      const id = "t_"+ (crypto.randomUUID ? crypto.randomUUID() : String(nowTs));
      data.trips[id] = { ...trip, expenses: {}, journal: {} };
      saveLS(data);
      return { id, ...data.trips[id] };
    }
  }

  async function getTrip(id){
    if (mode === "firebase"){
      await ensureAuthIfNeeded();
      let doc;
      try { doc = await db.collection("trips").doc(id).get({ source: "server" }); }
      catch { doc = await db.collection("trips").doc(id).get(); }
      if (!doc.exists) return null;
      const trip = { id: doc.id, ...doc.data() };
      // ensure fields
      trip.expenses = trip.expenses || {};
      trip.journal = trip.journal || {};
      return trip;
    } else {
      const data = loadLS();
      const t = data.trips[id];
      if (!t) return null;
      return { id, ...t };
    }
  }

  async function updateTrip(id, updates){
    if (mode === "firebase"){
      updates.updatedAt = Date.now();
      await db.collection("trips").doc(id).set(updates, { merge:true });
    } else {
      const data = loadLS();
      data.trips[id] = { ...(data.trips[id]||{}), ...updates, updatedAt: Date.now() };
      saveLS(data);
    }
  }

  async function deleteTrip(id){
    if (mode === "firebase"){
      await db.collection("trips").doc(id).delete();
    } else {
      const data = loadLS();
      delete data.trips[id];
      saveLS(data);
    }
  }

  // Expenses
  async function listExpenses(tripId){
    const trip = await getTrip(tripId);
    const exp = trip?.expenses || {};
    return Object.entries(exp).map(([id, v])=>({ id, ...v }));
  }
  async function addExpense(tripId, entry){
    entry.createdAt = Date.now();
    if (mode === "firebase"){
      const trip = await getTrip(tripId);
      const id = "e_"+ (crypto.randomUUID ? crypto.randomUUID() : String(entry.createdAt));
      const expenses = { ...(trip.expenses||{}), [id]: entry };
      await updateTrip(tripId, { expenses });
    } else {
      const data = loadLS();
      const id = "e_"+ (crypto.randomUUID ? crypto.randomUUID() : String(entry.createdAt));
      data.trips[tripId].expenses ||= {};
      data.trips[tripId].expenses[id] = entry;
      data.trips[tripId].updatedAt = Date.now();
      saveLS(data);
    }
  }
  async function updateExpense(tripId, expId, updates){
    if (mode === "firebase"){
      const trip = await getTrip(tripId);
      const expenses = { ...(trip.expenses||{}) };
      expenses[expId] = { ...(expenses[expId]||{}), ...updates };
      await updateTrip(tripId, { expenses });
    } else {
      const data = loadLS();
      Object.assign(data.trips[tripId].expenses[expId], updates);
      data.trips[tripId].updatedAt = Date.now();
      saveLS(data);
    }
  }
  async function removeExpense(tripId, expId){
    if (mode === "firebase"){
      const trip = await getTrip(tripId);
      const expenses = { ...(trip.expenses||{}) };
      delete expenses[expId];
      await updateTrip(tripId, { expenses });
    } else {
      const data = loadLS();
      delete data.trips[tripId].expenses[expId];
      data.trips[tripId].updatedAt = Date.now();
      saveLS(data);
    }
  }

  // Journal
  async function listJournal(tripId){
    const trip = await getTrip(tripId);
    const j = trip?.journal || {};
    return Object.entries(j).map(([id, v])=>({ id, ...v }));
  }
  async function addJournal(tripId, entry){
    entry.createdAt = Date.now();
    if (mode === "firebase"){
      const trip = await getTrip(tripId);
      const id = "j_"+ (crypto.randomUUID ? crypto.randomUUID() : String(entry.createdAt));
      const journal = { ...(trip.journal||{}), [id]: entry };
      await updateTrip(tripId, { journal });
    } else {
      const data = loadLS();
      const id = "j_"+ (crypto.randomUUID ? crypto.randomUUID() : String(entry.createdAt));
      data.trips[tripId].journal ||= {};
      data.trips[tripId].journal[id] = entry;
      data.trips[tripId].updatedAt = Date.now();
      saveLS(data);
    }
  }
  async function updateJournal(tripId, jId, updates){
    if (mode === "firebase"){
      const trip = await getTrip(tripId);
      const journal = { ...(trip.journal||{}) };
      journal[jId] = { ...(journal[jId]||{}), ...updates };
      await updateTrip(tripId, { journal });
    } else {
      const data = loadLS();
      Object.assign(data.trips[tripId].journal[jId], updates);
      data.trips[tripId].updatedAt = Date.now();
      saveLS(data);
    }
  }
  async function removeJournal(tripId, jId){
    if (mode === "firebase"){
      const trip = await getTrip(tripId);
      const journal = { ...(trip.journal||{}) };
      delete journal[jId];
      await updateTrip(tripId, { journal });
    } else {
      const data = loadLS();
      delete data.trips[tripId].journal[jId];
      data.trips[tripId].updatedAt = Date.now();
      saveLS(data);
    }
  }

  return {
    listTrips, createTrip, getTrip, updateTrip, deleteTrip,
    listExpenses, addExpense, updateExpense, removeExpense,
    listJournal, addJournal, updateJournal, removeJournal,
    mode
  };
})();

// ---------- Utilities ----------
function setStatus(msg, timeout=1800){
  const s = el("statusLine");
  if (!s) return;
  s.textContent = msg;
  if (state.lastStatusTimer) clearTimeout(state.lastStatusTimer);
  state.lastStatusTimer = setTimeout(()=> s.textContent = "מוכן.", timeout);
}
// Updated to show no decimal places for currency fields
function formatMoney(n){ return Number(n||0).toLocaleString('he-IL', {minimumFractionDigits:0, maximumFractionDigits:0}); }

function applyTheme(){
  if (state.theme === "light"){ document.documentElement.classList.add("light"); }
  else { document.documentElement.classList.remove("light"); }
  localStorage.setItem("theme", state.theme);
}
function toggleTheme(){
  state.theme = (state.theme === "light") ? "dark" : "light";
  applyTheme();
}

// Currency rates
async function fetchRates(base="USD"){
  try{
    const res = await fetch(`https://api.exchangerate.host/latest?base=${base}`);
    const data = await res.json();
    const wanted = new Set(["USD","EUR","ILS", "THB"]);
    Object.keys(state.rates||{}).forEach(k=> wanted.add(k));
    const rates = {};
    wanted.forEach(k=> rates[k] = (k===base?1:(data.rates?.[k] || state.rates[k] || 1)));
    state.rates = rates;
    const eur = rates.EUR, ils = rates.ILS;
    const extra = (state.localCurrency && !["USD","EUR","ILS"].includes(state.localCurrency) && rates[state.localCurrency])
      ? ` • ${state.localCurrency}=${formatMoney(rates[state.localCurrency])}` : "";
    if (el("liveRates")) el("liveRates").textContent = `שערים חיים: 1 USD = ${formatMoney(eur)} EUR • ${formatMoney(ils)} ₪${extra}`;
  }catch(e){
    console.warn("Rate fetch failed, using fallback.", e);
    if (el("liveRates")) el("liveRates").textContent = "שערים (גיבוי): USD→EUR≈0.90 • USD→ILS≈3.60";
  }
}

function toUSD(amount, from="USD"){
  if (!amount) return 0;
  if (from === "USD") return Number(amount);
  if (from === "EUR") return Number(amount) / (state.rates.EUR||0.9);
  if (from === "ILS") return Number(amount) / (state.rates.ILS||3.6);
  if (from === "THB") return Number(amount) / (state.rates.THB||36);
  const r = state.rates[from]; if (r) return Number(amount)/r;
  return Number(amount);
}

// ---------- Rendering ----------
async function renderHome(){
  $("#homeView")?.classList.add("active");
  $("#tripView")?.classList.remove("active");

  const trips = await Store.listTrips();
  state.trips = trips;

  const q = (el("tripSearch")?.value||"").trim().toLowerCase();
  const list = el("tripList"); if (!list) return;
  list.innerHTML = "";
  for (const t of trips.filter(x => (x.destination||"").toLowerCase().includes(q))){
    const li = document.createElement("li");
    const days = (t.start && t.end) ? (dayjs(t.end).diff(dayjs(t.start), "day")+1) : 0;
    
    // Translate trip types to Hebrew
    const translatedTripTypes = (t.tripType || []).map(type => TRIP_TYPE_HEBREW[type] || type).join(", ");

    li.innerHTML = `
      <div>
        <div class="trip-title">${t.destination||"—"}</div>
        <div class="muted">${t.start?dayjs(t.start).format("DD/MM/YY"):""}–${t.end?dayjs(t.end).format("DD/MM/YY"):""} • ${days||"?"} ימים</div>
        <div class="row" style="justify-content: flex-start; margin-top: 10px;">
          <span class="badge">${translatedTripTypes||"—"}</span>
        </div>
      </div>
      <div class="row bottom-row">
        <button class="btn edit edit-btn">ערוך</button>
        <button class="btn view">פתח</button>
        <button class="btn danger delete">מחק</button>
      </div>
    `;
    const viewButton = $(".view", li);
    if (viewButton) {
      viewButton.onclick = ()=> openTrip(t.id);
    }
    const editButton = $(".edit", li);
    if (editButton) {
      editButton.onclick = async ()=>{
        await openTrip(t.id);
        // Removed the code that switches to the 'meta' tab
        // Now it will stay on the default tab, which is 'overview'
      };
    }
    const deleteButton = $(".delete", li);
    if (deleteButton) {
      deleteButton.onclick = ()=> confirmDeleteTrip(t.id, t.destination);
    }
    list.appendChild(li);
  }
}

function activateTabs(){
  $$(".tab").forEach(btn => {
    btn.addEventListener("click", ()=>{
      $$(".tab").forEach(b=> b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      $$(".panel").forEach(p=> p.classList.remove("active"));
      el("tab-"+tab)?.classList.add("active");
      if (tab === "map") refreshMainMap();
    });
  });
}

async function openTrip(id){
  state.currentTripId = id;
  const trip = await Store.getTrip(id);
  if (!trip){ alert("נסיעה לא נמצאה"); return; }

  el("tripTitle").textContent = trip.destination || "נסיעה";
  // The share controls are now in the export tab, so we don't need to get them here
  
  $("#homeView")?.classList.remove("active");
  $("#tripView")?.classList.add("active");

  el("tripDestination").value = trip.destination || "";
  el("tripParticipants").value = trip.participants || "";
  // multi select
  // Removed the line that was causing the error
  // [...el("tripType").options].forEach(opt => opt.selected = Array.isArray(trip.tripType) && trip.tripType.includes(opt.value));
  el("tripStart").value = trip.start || "";
  el("tripEnd").value = trip.end || "";
  // el("tripBudgetUSD").value = trip.budget?.USD || ""; // Removed old budget field
  el("budgetLocked").checked = !!trip.budgetLocked;

  // Render the checkboxes for trip types
  const tripTypeCheckboxes = el("tripTypeCheckboxes");
  if(tripTypeCheckboxes) {
    const tripTypes = trip.tripType || [];
    Array.from(tripTypeCheckboxes.querySelectorAll('input[type="checkbox"]')).forEach(checkbox => {
      checkbox.checked = tripTypes.includes(checkbox.value);
    });
  }

  // Update budget fields
  const budgetUSD = trip.budget?.USD || 0;
  // Make sure elements exist before trying to set their values
  if (el("tripBudgetUSD")) el("tripBudgetUSD").value = Math.round(budgetUSD);
  if (el("tripBudgetEUR")) el("tripBudgetEUR").value = Math.round(budgetUSD * (state.rates?.EUR || 0.9));
  if (el("tripBudgetILS")) el("tripBudgetILS").value = Math.round(budgetUSD * (state.rates?.ILS || 3.6));
  
  await renderBudget();
  await renderJournal();
  await renderOverviewMiniMap();

  // Add event listeners for new budget fields
  if (el("tripBudgetUSD")) el("tripBudgetUSD").oninput = (e) => updateBudgetConversion(e.target.value, 'USD');
  if (el("tripBudgetEUR")) el("tripBudgetEUR").oninput = (e) => updateBudgetConversion(e.target.value, 'EUR');
  if (el("tripBudgetILS")) el("tripBudgetILS").oninput = (e) => updateBudgetConversion(e.target.value, 'ILS');


  // New logic to handle share controls now that they are in the export tab
  const shareToggle = el("shareToggle");
  if (shareToggle) {
    shareToggle.checked = !!trip.share?.enabled;
  }
  const shareScope = el("shareScope");
  if (shareScope) {
    shareScope.value = trip.share?.scope || "full";
  }

  if (shareToggle){
    shareToggle.onchange = async ()=>{
      await Store.updateTrip(id, { share: { enabled: shareToggle.checked, scope: el("shareScope").value } });
      setStatus(shareToggle.checked ? "שיתוף הופעל" : "שיתוף בוטל");
    };
  }
  if (el("shareScope")){
    el("shareScope").onchange = async ()=>{
      await Store.updateTrip(id, { share: { enabled: el("shareToggle").checked, scope: el("shareScope").value } });
      setStatus("היקף שיתוף עודכן");
    };
  }
}

// Function to handle budget conversion
function updateBudgetConversion(value, fromCurrency) {
    let usdValue = 0;
    const rates = state.rates;

    switch (fromCurrency) {
        case 'USD':
            usdValue = parseFloat(value) || 0;
            break;
        case 'EUR':
            usdValue = (parseFloat(value) || 0) / (rates.EUR || 0.9);
            break;
        case 'ILS':
            usdValue = (parseFloat(value) || 0) / (rates.ILS || 3.6);
            break;
    }

    if (el("tripBudgetUSD")) el("tripBudgetUSD").value = Math.round(usdValue);
    if (el("tripBudgetEUR")) el("tripBudgetEUR").value = Math.round(usdValue * (rates.EUR || 0.9));
    if (el("tripBudgetILS")) el("tripBudgetILS").value = Math.round(usdValue * (rates.ILS || 3.6));
}

function confirmDeleteTrip(id, name){
  const dlg = el("confirmDialog");
  if (!dlg) return;
  el("confirmTitle").textContent = "מחיקת נסיעה";
  el("confirmMsg").textContent = `למחוק את "${name||"נסיעה"}"? לא ניתן לשחזר.`;
  dlg.showModal();
  el("confirmYes").onclick = async ()=>{
    await Store.deleteTrip(id);
    dlg.close();
    setStatus("נסיעה נמחקה");
    renderHome();
  };
}

async function renderOverviewMiniMap(){
  const trip = await Store.getTrip(state.currentTripId);
  if (!trip) return;
  const points = [];
  if (trip.expenses){
    Object.values(trip.expenses).forEach(e=>{ if (e.lat && e.lng) points.push({ ...e, type:"expense" }); });
  }
  if (trip.journal){
    Object.values(trip.journal).forEach(j=>{ if (j.lat && j.lng) points.push({ ...j, type:"journal" }); });
  }

  const mapEl = el("miniMap");
  if (mapEl){
    if (!state.maps.mini){
      state.maps.mini = L.map(mapEl, { zoomControl:false, attributionControl:false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(state.maps.mini);
    }
    const map = state.maps.mini;
    const group = L.featureGroup();
    points.forEach(p=>{
      const marker = L.circleMarker([p.lat,p.lng], { radius:6, weight:1, color: (p.type==="expense"?"#ff6b6b":"#5b8cff") }).bindPopup(p.desc||p.text||"");
      group.addLayer(marker);
    });
    group.addTo(map);
    if (points.length){
      map.fitBounds(group.getBounds().pad(0.4));
    } else {
      map.setView([31.8, 35.2], 7);
    }
  }

  // overview meta
  const tripDays = (trip.start && trip.end) ? `${dayjs(trip.start).format("DD/MM/YY")}–${dayjs(trip.end).format("DD/MM/YY")}` : "—";
  
  // Translate trip types to Hebrew
  const translatedTripTypes = (trip.tripType || []).map(type => TRIP_TYPE_HEBREW[type] || type).join(", ");
  
  if (el("overviewMeta")){
    el("overviewMeta").innerHTML = `
      <div><strong>יעד:</strong> ${trip.destination||"—"}</div>
      <div><strong>תאריכים:</strong> ${tripDays}</div>
      <div><strong>משתתפים:</strong> ${trip.participants||"—"}</div>
      <div><strong>סוג:</strong> ${translatedTripTypes||"—"}</div>
    `;
  }

  const jList = el("recentJournal"); if (jList){ jList.innerHTML = "";
    const journal = await Store.listJournal(trip.id);
    journal.slice(0,5).forEach(j=>{
      const li = document.createElement("li");
      li.innerHTML = `<div>${j.text||"—"}</div><div class="muted">${dayjs(j.createdAt).format("DD/MM HH:mm")}</div>`;
      jList.appendChild(li);
    });
  }
}

// Budget
function updateCellWithValue(elm, value, prefix) {
  if (!elm) return;
  elm.textContent = `${prefix}${formatMoney(value)}`;
  if (value < 0) {
    elm.classList.add("negative");
  } else {
    elm.classList.remove("negative");
  }
}

async function renderBudget(){
  const trip = await Store.getTrip(state.currentTripId);
  if (!trip) return;
  if (trip.localCurrency){ state.localCurrency = trip.localCurrency; addCurrencyToState(trip.localCurrency); }

  const tbody = $("#expenseTable tbody");
  if (tbody) tbody.innerHTML = "";
  let expenses = await Store.listExpenses(trip.id);
  // Default sort expenses by date in descending order
  expenses.sort((a, b) => b.createdAt - a.createdAt);

  // Add event listener for the sort button
  const sortButton = el("sortExpensesBtn");
  if (sortButton) {
    sortButton.onclick = () => {
      state.sortAsc = !state.sortAsc; // Toggle sort direction
      expenses.sort((a, b) => {
        const aVal = a.createdAt;
        const bVal = b.createdAt;
        if (state.sortAsc) {
          return aVal - bVal;
        } else {
          return bVal - aVal;
        }
      });
      // Update the button icon
      sortButton.innerHTML = `<span>${state.sortAsc ? '&#9650;' : '&#9660;'}</span> מיין`;
      renderExpenses(expenses);
    };
  }
  
  function renderExpenses(expensesToRender) {
    if (!tbody) return;
    tbody.innerHTML = "";
    let totalUSD = 0;
    let totalEUR = 0;
    let totalILS = 0;

    const budgetUSD = Number(trip.budget?.USD || 0);

    for (const e of expensesToRender){
      const usdAmount = toUSD(e.amount, e.currency);
      totalUSD += usdAmount;
      totalEUR += usdAmount * (state.rates.EUR || 0.9);
      totalILS += usdAmount * (state.rates.ILS || 3.6);

      const tr = document.createElement("tr");
      // The expense row content is now rendered as static text
      tr.innerHTML = `
        <td>${e.desc||"—"}</td>
        <td>${e.category||"—"}</td>
        <td>${e.amount||0}</td>
        <td>${e.currency||"USD"}</td>
        <td>${e.placeName||"—"}</td>
        <td>${dayjs(e.createdAt).format("DD/MM HH:mm")}</td>
        <td class="row-actions">
          <button class="btn ghost edit">ערוך</button>
          <button class="btn ghost danger del">מחק</button>
        </td>
      `;
      $(".edit", tr).onclick = ()=> openExpenseDialog(e);
      $(".del", tr).onclick = async ()=> {
        try {
          const ok = window.confirm("למחוק את ההוצאה הזו?");
          if (!ok) return;
          await Store.removeExpense(state.currentTripId, e.id);
          await renderBudget();
          setStatus("הוצאה נמחקה");
        } catch(err){ console.error("מחיקה נכשלה", err); setStatus("מחיקה נכשלה"); }
      };
      tbody.appendChild(tr);
    }
    
    // Update budget card UI
    if (el("budgetTotalUSD")) el("budgetTotalUSD").textContent = `$${formatMoney(budgetUSD)}`;
    if (el("budgetTotalEUR")) el("budgetTotalEUR").textContent = `€${formatMoney(budgetUSD * (state.rates.EUR || 0.9))}`;
    if (el("budgetTotalILS")) el("budgetTotalILS").textContent = `₪${formatMoney(budgetUSD * (state.rates.ILS || 3.6))}`;

    if (el("expensesActualUSD")) el("expensesActualUSD").textContent = `$${formatMoney(totalUSD)}`;
    if (el("expensesActualEUR")) el("expensesActualEUR").textContent = `€${formatMoney(totalEUR)}`;
    if (el("expensesActualILS")) el("expensesActualILS").textContent = `₪${formatMoney(totalILS)}`;

    updateCellWithValue(el("remainingUSD"), budgetUSD - totalUSD, "$");
    updateCellWithValue(el("remainingEUR"), budgetUSD * (state.rates.EUR || 0.9) - totalEUR, "€");
    updateCellWithValue(el("remainingILS"), budgetUSD * (state.rates.ILS || 3.6) - totalILS, "₪");
    if (el("remainingEUR")) el("remainingEUR").textContent = `€${formatMoney(budgetUSD * (state.rates.EUR || 0.9) - totalEUR)}`;
    if (el("remainingILS")) el("remainingILS").textContent = `₪${formatMoney(budgetUSD * (state.rates.ILS || 3.6) - totalILS)}`;
  }

  renderExpenses(expenses);
}

// Journal
async function renderJournal(){
  const tripId = state.currentTripId;
  const entries = await Store.listJournal(tripId);
  const ul = el("journalList"); if (!ul) return;
  ul.innerHTML = "";
  for (const j of entries){
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="row"><strong>${dayjs(j.createdAt).format("DD/MM HH:mm")}</strong>
        <span class="muted">${j.placeName || (j.lat?`(${Number(j.lat).toFixed(4)},${Number(j.lng).toFixed(4)})`:"")}</span>
      </div>
      <div>${j.text||"—"}</div>
      <div class="row" style="margin-top:8px">
        <button class="btn ghost edit">ערוך</button>
        <button class="btn ghost danger del">מחק</button>
      </div>
    `;
    $(".edit", li).onclick = async ()=>{
      const newText = prompt("עריכת רישום:", j.text||"");
      if (newText!==null){
        await Store.updateJournal(tripId, j.id, { text: newText });
        setStatus("היומן עודכן");
        renderJournal();
      }
    };
    $(".del", li).onclick = async ()=>{
      await Store.removeJournal(tripId, j.id);
      setStatus("רישום נמחק");
      renderJournal(); refreshMainMap();
    };
    ul.appendChild(li);
  }
}

// Maps
function refreshMainMap(){
  if (!state.currentTripId) return;
  let mapEl = el("mainMap");
  if (mapEl){
    if (!state.maps.main){
      if (mapEl._leaflet_id) { const clone = mapEl.cloneNode(false); mapEl.parentNode.replaceChild(clone, mapEl); mapEl = el("mainMap"); }
      state.maps.main = L.map(mapEl);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(state.maps.main);
    }
    const map = state.maps.main;
    (async ()=>{
      const trip = await Store.getTrip(state.currentTripId);
      if (!trip) return;
      const group = L.featureGroup();
      function addPoint(p, color){
        const m = L.circleMarker([p.lat,p.lng], { radius:7, color, weight:2 }).bindPopup((p.desc||p.text||"") + (p.placeName?`<br>${p.placeName}`:""));
        group.addLayer(m);
      }
      group.clearLayers();
      if (trip.expenses) Object.values(trip.expenses).forEach(e=>{ if (e.lat && e.lng) addPoint(e, "#ff6b6b"); });
      if (trip.journal) Object.values(trip.journal).forEach(j=>{ if (j.lat && j.lng) addPoint(j, "#5b8cff"); });
      group.addTo(map);
      if (group.getLayers().length) map.fitBounds(group.getBounds().pad(0.3));
      else map.setView([31.8, 35.2], 7);
    })();
  }
}

function openLocationPicker(forType){
  state.locationPick = { lat:null, lng:null, forType };
  const dlg = el("locationDialog");
  if (!dlg) return;
  dlg.showModal();

  let mapEl = el("locationMap");
  if (!state.maps.location){
    if (mapEl && mapEl._leaflet_id) { const clone = mapEl.cloneNode(false); mapEl.parentNode.replaceChild(clone, mapEl); mapEl = el("locationMap"); }
    state.maps.location = L.map(mapEl);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(state.maps.location);
    state.maps.location.on("click", (e)=>{
      state.locationPick.lat = e.latlng.lat;
      state.locationPick.lng = e.latlng.lng;
      setStatus(`נבחר: ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`);
    });
  }
  state.maps.location.setView([31.8, 35.2], 7);

  el("useCurrentLoc").onclick = ()=>{
    navigator.geolocation.getCurrentPosition(pos=>{
      const {latitude, longitude} = pos.coords;
      state.locationPick.lat = latitude; state.locationPick.lng = longitude;
      state.maps.location.setView([latitude,longitude], 13);
      setStatus("זוהה מיקום נוכחי");
    }, ()=> alert("לא ניתן לזהות מיקום"));
  };

  const searchPlaceInput = el("searchPlace");
  const searchPlaceBtn = el("searchPlaceBtn");
  searchPlaceBtn.onclick = async ()=>{
    const q = searchPlaceInput.value.trim();
    if (!q) return;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "Accept-Language": "he" } });
    const data = await res.json();
    if (data?.[0]){
      const r = data[0];
      const lat = Number(r.lat), lng = Number(r.lon);
      state.locationPick.lat = lat; state.locationPick.lng = lng;
      state.maps.location.setView([lat,lng], 14);
      L.marker([lat,lng]).addTo(state.maps.location);
      setStatus(r.display_name);
    } else {
      alert("לא נמצא מיקום מתאים");
    }
  };


  el("saveLocationBtn").onclick = ()=>{
    if (state.locationPick.lat && state.locationPick.lng){
      if (state.locationPick.forType === "expense"){
        el("expLat").value = state.locationPick.lat;
        el("expLng").value = state.locationPick.lng;
      }
      dlg.close();
    } else {
      alert("בחר מיקום ע\"י לחיצה על המפה או חיפוש.");
    }
  };
}

// Expense dialog
async function openExpenseDialog(exp){
  el("expenseDialogTitle").textContent = exp? "עריכת הוצאה" : "הוספת הוצאה";
  el("expDesc").value = exp?.desc || "";
  el("expCat").value = exp?.category || lastUsed.category;
  el("expAmount").value = exp?.amount || 0;
  
  // Set default currency from last used values, with a special case for THB
  const trip = await Store.getTrip(state.currentTripId);
  
  let defaultCcy = lastUsed.currency;

  if (trip.destination?.includes("תאילנד")) {
      defaultCcy = "THB";
  }

  el("expCurrency").value = exp?.currency || defaultCcy;
  
  el("expLat").value = exp?.lat || "";
  el("expLng").value = exp?.lng || "";
  el("expenseDialog").showModal();
  el("expenseDialog").dataset.editId = exp?.id || "";
}
function collectExpenseForm(){
  const desc = el("expDesc").value.trim();
  const category = el("expCat").value;
  const amount = Number(el("expAmount").value||0);
  const currency = el("expCurrency").value;
  const lat = parseFloat(el("expLat").value||"");
  const lng = parseFloat(el("expLng").value||"");
  const entry = { desc, category, amount, currency };
  if (!isNaN(lat) && !isNaN(lng)){ entry.lat = lat; entry.lng = lng; }
  const editId = el("expenseDialog").dataset.editId;
  if (editId) entry.id = editId;
  
  // Save last used category and currency
  lastUsed.category = category;
  lastUsed.currency = currency;
  localStorage.setItem("lastCategory", lastUsed.category);
  localStorage.setItem("lastCurrency", lastUsed.currency);

  return entry;
}

// Exporters
async function exportCSV(){
  const trip = await Store.getTrip(state.currentTripId);
  const rows = [["type","desc","category","amount","currency","lat","lng","timestamp"]];
  if (!el("exportWithoutExpenses").checked && trip.expenses){
    for (const e of Object.values(trip.expenses)){
      rows.push(["expense", e.desc||"", e.category||"", e.amount||0, e.currency||"USD", e.lat||"", e.lng||"", e.createdAt||""]);
    }
  }
  if (trip.journal){
    for (const j of Object.values(trip.journal)){
      rows.push(["journal", (j.text||"").replace(/[\n\r]+/g," "), "", "", "", j.lat||"", j.lng||"", j.createdAt||""]);
    }
  }
  const csv = rows.map(r=> r.map(x=> `"${String(x).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `trip_${trip.destination||"export"}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus("CSV נוצר");
}

async function exportGPX(){
  const trip = await Store.getTrip(state.currentTripId);
  function wpt(lat,lng,name,desc,time){
    return `<wpt lat="${lat}" lon="${lng}"><name>${name||""}</name><desc>${desc||""}</desc><time>${new Date(time||Date.now()).toISOString()}</time></wpt>`;
  }
  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TravelJournal" xmlns="http://www.topografix.com/GPX/1/1">
`;
  if (!el("exportWithoutExpenses").checked && trip.expenses){
    for (const e of Object.values(trip.expenses)){
      if (e.lat && e.lng) gpx += wpt(e.lat,e.lng, e.category||"Expense", e.desc||"", e.createdAt);
    }
  }
  if (trip.journal){
    for (const j of Object.values(trip.journal)){
      if (j.lat && j.lng) gpx += wpt(j.lat,j.lng, "Journal", j.text||"", j.createdAt);
    }
  }
  gpx += "\n</gpx>";
  const blob = new Blob([gpx], {type:"application/gpx+xml"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `trip_${trip.destination||"export"}.gpx`;
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus("GPX נוצר");
}

async function exportPDF(){
  const trip = await Store.getTrip(state.currentTripId);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"pt", compress:true });
  const margin = 40;
  let y = margin;

  doc.setFont("helvetica","bold");
  doc.setFontSize(18);
  doc.text(`דוח נסיעה: ${trip.destination||""}`, margin, y);
  y += 22;

  doc.setFontSize(12);
  doc.setFont("helvetica","normal");
  if (trip.start && trip.end) doc.text(`תאריכים: ${dayjs(trip.start).format("DD/MM/YY")}–${dayjs(trip.end).format("DD/MM/YY")}`, margin, y);
  y+=16;
  doc.text(`משתתפים: ${trip.participants||"—"}`, margin, y); y+=16;
  doc.text(`סוג: ${(trip.tripType||[]).join(", ")||"—"}`, margin, y); y+=20;

  const expenses = await Store.listExpenses(trip.id);
  const totalUSD = expenses.reduce((s,e)=> s + toUSD(e.amount, e.currency), 0);
  doc.setFont("helvetica","bold"); doc.text("סיכום תקציב", margin, y); y+=16;
  doc.setFont("helvetica","normal");
  doc.text(`תקציב USD: $${formatMoney(trip.budget?.USD||0)}`, margin, y); y+=14;
  const rem = (trip.budget?.USD||0) - totalUSD;
  doc.text(`יתרה: $${formatMoney(rem)}`, margin, y); y+=20;

  if (!el("exportWithoutExpenses").checked && expenses.length){
    doc.setFont("helvetica","bold"); doc.text("הוצאות", margin, y); y+=8;
    doc.autoTable({
      startY: y+8, margin:{ left:margin, right:margin },
      styles:{ fontSize:10 }, head:[["תיאור","קטגוריה","סכום","מטבע","זמן"]],
      body: expenses.map(e=> [e.desc||"", e.category||"", String(e.amount||0), e.currency||"USD", dayjs(e.createdAt).format("DD/MM HH:mm")])
    });
    y = doc.lastAutoTable.finalY + 20;
  }

  const journal = await Store.listJournal(trip.id);
  doc.setFont("helvetica","bold"); doc.text("יומן", margin, y); y+=8;
  doc.setFont("helvetica","normal");
  const lines = [];
  journal.forEach(j=>{ lines.push(`${dayjs(j.createdAt).format("DD/MM HH:mm")} – ${j.text||""}`); });
  const split = doc.splitTextToSize(lines.join("\n"), 530);
  doc.text(split, margin, y+14);

  doc.save(`trip_${trip.destination||"report"}.pdf`);
  setStatus("PDF נוצר");
}

// ---------- Init ----------
async function init(){
  applyTheme();
  if (window.AppDataLayer?.mode === "firebase") {
    await window.AppDataLayer.ensureAuth?.();
    console.log("Auth UID:", firebase.auth().currentUser?.uid);
  }

  // Buttons
  if (el("themeToggle")) el("themeToggle").onclick = toggleTheme;
  if (el("addTripFab")) el("addTripFab").onclick = ()=> el("tripDialog").showModal();
  if (el("tripSearch")) el("tripSearch").oninput = renderHome;
  if (el("createTripBtn")) el("createTripBtn").onclick = async (e)=>{
    e.preventDefault();
    const dest = el("newTripDestination").value.trim();
    const start = el("newTripStart").value;
    const end = el("newTripEnd").value;
    if (!dest || !start || !end) return;
    const t = await Store.createTrip({ destination: dest, start, end, tripType: [], participants:"" });
    el("tripDialog").close();
    setStatus("נסיעה נוצרה");
    await renderHome();
    openTrip(t.id);
  };
  if (el("backToHome")) el("backToHome").onclick = renderHome;

  activateTabs();
  if (el("goToBudget")) el("goToBudget").onclick = ()=>{
    $$(".tab").forEach(b=> b.classList.remove("active"));
    $('[data-tab="budget"]').classList.add("active");
    $$(".panel").forEach(p=> p.classList.remove("active"));
    el("tab-budget").classList.add("active");
  };
  if (el("editMetaFromOverview")) el("editMetaFromOverview").onclick = ()=>{
    $$(".tab").forEach(b=> b.classList.remove("active"));
    $('[data-tab="meta"]').classList.add("active");
    $$(".panel").forEach(p=> p.classList.remove("active"));
    el("tab-meta").classList.add("active");
  };

  if (el("tripMetaForm")) el("tripMetaForm").onsubmit = async (e)=>{
    e.preventDefault();
    const id = state.currentTripId;

    const selectedTripTypes = Array.from(el("tripTypeCheckboxes").querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);

    // Get the USD value from the input field
    const budgetUSD = Number(el("tripBudgetUSD").value) || 0;

    const updates = {
      destination: el("tripDestination").value.trim(),
      participants: el("tripParticipants").value.trim(),
      tripType: selectedTripTypes,
      start: el("tripStart").value,
      end: el("tripEnd").value,
      budget: { USD: budgetUSD },
      budgetLocked: el("budgetLocked").checked
    };
    await Store.updateTrip(id, updates);
    setStatus("נתוני נסיעה נשמרו ✔");
    el("tripTitle").textContent = updates.destination || "נסיעה";
    renderBudget();
    await renderOverviewMiniMap();
  };

  if (el("verifyDestination")) el("verifyDestination").onclick = async ()=>{
    const q = el("tripDestination").value.trim();
    if (!q) return;
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "Accept-Language": "he" } });
    const data = await res.json();
    if (data?.[0]){
      const addr = data[0].address || {};
      const cc = (addr.country_code||"").toUpperCase();
      const ccy = COUNTRY_CCY[cc];
      if (ccy){
        state.localCurrency = ccy;
        addCurrencyToState(ccy);
        await fetchRates("USD");
        if (state.currentTripId){
          await Store.updateTrip(state.currentTripId, { localCurrency: ccy });
          setStatus(`נמצא יעד (${data[0].display_name}) • מטבע מקומי: ${ccy}`);
          renderBudget();
        } else {
          setStatus(`נמצא יעד (${data[0].display_name}) • מטבע מקומי: ${ccy}`);
        }
      } else {
        alert("נמצא יעד, אך לא זוהה מטבע מקומי");
      }
    } else {
      alert("לא נמצא יעד מתאים");
    }
  };

  if (el("addExpenseBtn")) el("addExpenseBtn").onclick = ()=> openExpenseDialog(null);
  if (el("pickLocationBtn")) el("pickLocationBtn").onclick = ()=> openLocationPicker("expense");
  if (el("saveExpenseBtn")) el("saveExpenseBtn").onclick = async (e)=>{
    e.preventDefault();
    const id = state.currentTripId;
    const entry = collectExpenseForm();
    if (!entry) return;
    if (entry.id){
      const { id:expId, ...rest } = entry;
      await Store.updateExpense(id, expId, rest);
      setStatus("הוצאה עודכנה");
    } else {
      await Store.addExpense(id, entry);
      setStatus("הוצאה נוספה");
    }
    el("expenseDialog").close();
    renderBudget(); refreshMainMap();
  };

  if (el("addJournalBtn")) el("addJournalBtn").onclick = async ()=>{
    const text = el("journalText").value.trim();
    if (!text) return;
    const tripId = state.currentTripId;
    openLocationPicker("journal");
    const onClose = async ()=>{
      el("locationDialog").removeEventListener("close", onClose);
      const entry = {
        text,
        placeName: undefined,
        lat: state.locationPick.lat || null,
        lng: state.locationPick.lng || null
      };
      await Store.addJournal(tripId, entry);
      el("journalText").value = "";
      setStatus("נוסף רישום יומן");
      renderJournal(); refreshMainMap();
    };
    el("locationDialog").addEventListener("close", onClose, { once:true });
  };

  // if (el("saveAllBtn")) el("saveAllBtn").onclick = ()=> setStatus("הכל מעודכן ✔"); // This button was removed
  if (el("copyShareLink")) el("copyShareLink").onclick = async ()=>{
    const t = await Store.getTrip(state.currentTripId);
    if (!t.share?.enabled){ alert("יש להפעיל שיתוף קודם."); return; }
    const scope = el("shareScope").value || "full";
    const url = `${location.origin}${location.pathname}?tripId=${encodeURIComponent(t.id)}&view=shared&scope=${scope}`;
    await navigator.clipboard.writeText(url);
    setStatus("קישור הועתק");
  };

  if (el("exportPDF")) el("exportPDF").onclick = exportPDF;
  if (el("exportCSV")) el("exportCSV").onclick = exportCSV;
  if (el("exportGPX")) el("exportGPX").onclick = exportGPX;

  await fetchRates("USD");

  const params = new URLSearchParams(location.search);
  if (params.get("view")==="shared" && params.get("tripId")){
    // basic shared render (still requires owner auth per rules; for public sharing enable rules accordingly)
    await openTrip(params.get("tripId"));
    $$(".share-controls, .tabs .tab[data-tab='meta'], .tabs .tab[data-tab='export']").forEach(x=> x?.classList?.add?.("hidden"));
    // Hide add/edit buttons as well
    if (el("addExpenseBtn")) el("addExpenseBtn").classList.add("hidden");
    if (el("addJournalBtn")) el("addJournalBtn").classList.add("hidden");
  } else {
    await renderHome();
  }
}

// boot
window.onload = init;
