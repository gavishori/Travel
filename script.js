/* ===== Utilities ===== */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const byId = (id) => document.getElementById(id);

const TRIP_ICONS = { ski:"⛷️", beach:"🏝️", trek:"🥾", urban:"🏙️", other:"🎒" };
function iconFor(type){ return TRIP_ICONS[type] || TRIP_ICONS.other; }
function fmtDate(d){
  if (!d) return "—";
  try{ const dt = new Date(d); return dt.toLocaleDateString('he-IL'); }catch{ return d; }
}
function daysDiff(a,b){
  const A = a ? new Date(a) : null, B = b ? new Date(b) : null;
  if (!A || !B) return null;
  return Math.max(1, Math.round((B - A) / (1000*60*60*24)));
}
function isFuture(d){ return d && new Date(d) > new Date(); }

/* ===== Minimal data layer (compatible with your previous Firestore shape) ===== */
const Store = (() => {
  const mode = window.AppDataLayer?.mode || "local";
  const db = window.AppDataLayer?.db;
  let uid = null;

  const LS_KEY = "travel_journal_data_v2";
  function loadLS(){ try{ return JSON.parse(localStorage.getItem(LS_KEY)) || { trips:{} }; }catch{ return { trips:{} }; } }
  function saveLS(data){ localStorage.setItem(LS_KEY, JSON.stringify(data)); }

  async function ensureAuth(){
    if (mode === "firebase"){
      uid = await window.AppDataLayer.ensureAuth?.() || null;
    }
    return uid;
  }

  async function listTrips(){
    if (mode === "firebase"){
      await ensureAuth();
      const snap = await db.collection("trips").where("ownerUid","==", uid).get();
      return snap.docs.map(d => ({ id:d.id, ...d.data() }));
    } else {
      const data = loadLS();
      return Object.entries(data.trips).map(([id,t]) => ({ id, ...t }));
    }
  }

  async function createTrip(meta){
    const now = Date.now();
    const trip = { ...meta, createdAt: now, updatedAt: now };
    if (mode === "firebase"){
      await ensureAuth();
      const docData = { ...trip, ownerUid: uid, expenses:{}, journal:{} };
      const ref = await db.collection("trips").add(docData);
      return { id: ref.id, ...docData };
    } else {
      const data = loadLS();
      const id = "t_"+(crypto.randomUUID ? crypto.randomUUID() : String(now));
      data.trips[id] = { ...trip, expenses:{}, journal:{} };
      saveLS(data);
      return { id, ...data.trips[id] };
    }
  }

  async function updateTrip(id, updates){
    if (mode === "firebase"){
      updates.updatedAt = Date.now();
      await db.collection("trips").doc(id).set(updates,{ merge:true });
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

  return { listTrips, createTrip, updateTrip, deleteTrip };
})();

/* ===== UI State ===== */
const state = {
  trips: [],
  sortBy: "start",
  asc: true,
  editingId: null
};

/* ===== Rendering ===== */
function renderTrips(){
  const list = byId("tripTimeline");
  list.innerHTML = "";
  let items = [...state.trips];

  // Filter by search
  const q = (byId("tripSearch").value || "").trim().toLowerCase();
  if (q){
    items = items.filter(t => {
      const hay = [t.destination, t.type, t.notes].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  // Sort
  const key = state.sortBy;
  const dir = state.asc ? 1 : -1;
  items.sort((a,b) => {
    const A = (key==="start") ? a.startDate
            : (key==="end") ? a.endDate
            : (key==="updated") ? a.updatedAt
            : a.createdAt;
    const B = (key==="start") ? b.startDate
            : (key==="end") ? b.endDate
            : (key==="updated") ? b.updatedAt
            : b.createdAt;
    return ((A||0) > (B||0) ? 1 : (A===B?0:-1)) * dir;
  });

  // Empty state
  byId("emptyState").classList.toggle("hidden", items.length>0);

  for (const t of items){
    const li = document.createElement("li");
    li.className = "trip-item";
    li.dataset.id = t.id;

    const marker = document.createElement("div");
    marker.className = "timeline-marker";

    const content = document.createElement("div");
    content.className = "trip-content";

    const header = document.createElement("div");
    header.className = "trip-header";

    const dateEl = document.createElement("span");
    dateEl.className = "trip-date";
    dateEl.textContent = fmtDate(t.startDate || t.endDate || t.createdAt);

    const iconEl = document.createElement("span");
    iconEl.className = "trip-icon";
    iconEl.textContent = iconFor(t.type);

    const destEl = document.createElement("span");
    destEl.className = "trip-destination";
    destEl.textContent = t.destination || "—";

    const menu = document.createElement("div");
    menu.className = "trip-menu";
    const menuBtn = document.createElement("button");
    menuBtn.className = "menu-btn";
    menuBtn.type = "button";
    menuBtn.setAttribute("aria-label", "אפשרויות לטיול");
    menuBtn.textContent = "⋮";
    const dropdown = document.createElement("div");
    dropdown.className = "menu-dropdown";

    const editBtn = document.createElement("button");
    editBtn.textContent = "ערוך";
    editBtn.addEventListener("click", () => openEdit(t));

    const delBtn = document.createElement("button");
    delBtn.textContent = "מחק";
    delBtn.style.color = "var(--danger)";
    delBtn.addEventListener("click", async () => {
      if (confirm("למחוק את הטיול הזה?")) {
        await Store.deleteTrip(t.id);
        await refresh();
      }
    });

    dropdown.append(editBtn, delBtn);
    menu.append(menuBtn, dropdown);

    header.append(dateEl, iconEl, destEl, menu);
    content.append(header);

    const details = document.createElement("div");
    details.className = "trip-details";

    const datesStr = (t.startDate || t.endDate)
      ? `${fmtDate(t.startDate)} — ${fmtDate(t.endDate)}`
      : "תאריכים לא הוזנו";
    const dur = daysDiff(t.startDate, t.endDate);
    const badges = [
      `<span class="badge">${datesStr}</span>`,
      dur ? `<span class="badge">${dur} ימים</span>` : "",
      t.type ? `<span class="badge type">${labelForType(t.type)}</span>` : "",
      (t.budgetEUR ? `<span class="badge">תקציב: €${Number(t.budgetEUR).toLocaleString('he-IL')}</span>` : "")
    ].filter(Boolean).join(" ");

    details.innerHTML = badges + (t.notes ? ` <span class="badge">${escapeHtml(t.notes)}</span>` : "");
    content.append(details);

    li.append(marker, content);
    list.append(li);
  }
}

function labelForType(type){
  return ({ beach:"בטן-גב", ski:"סקי", trek:"טרקים", urban:"עירוני", other:"אחר" })[type] || "אחר";
}
function escapeHtml(s){ return String(s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ===== Event wiring ===== */
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".menu-btn");
  $$(".trip-menu").forEach(m => m.classList.remove("open"));
  if (btn) {
    btn.parentElement.classList.toggle("open");
    e.stopPropagation();
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $$(".trip-menu").forEach(m => m.classList.remove("open"));
});

byId("tripSearch").addEventListener("input", renderTrips);
byId("sortBy").addEventListener("change", (e) => { state.sortBy = e.target.value; renderTrips(); });
byId("toggleAsc").addEventListener("click", () => { state.asc = !state.asc; renderTrips(); });

/* Theme toggle */
byId("themeToggle").addEventListener("click", () => {
  const root = document.documentElement;
  const isLight = root.classList.toggle("light");
  localStorage.setItem("theme", isLight ? "light" : "dark");
});
(function initTheme(){
  const saved = localStorage.getItem("theme");
  if (saved === "light") document.documentElement.classList.add("light");
})();

/* Auth btn (works only if firebase config is valid) */
byId("googleSignIn").addEventListener("click", async () => {
  try{
    if (window.startGoogleSignIn) await window.startGoogleSignIn();
  }catch(e){ console.warn(e); }
});

/* FAB => open add dialog */
byId("addTripFab").addEventListener("click", () => openAdd());

/* ===== Dialog add/edit ===== */
const dlg = byId("tripDialog");
const form = byId("tripForm");
const titleEl = byId("tripDialogTitle");

function openAdd(){
  state.editingId = null;
  titleEl.textContent = "הוספת טיול";
  form.reset();
  dlg.showModal();
}
function openEdit(t){
  state.editingId = t.id;
  titleEl.textContent = "עריכת טיול";
  byId("fldDestination").value = t.destination || "";
  byId("fldType").value = t.type || "other";
  byId("fldStart").value = t.startDate ? new Date(t.startDate).toISOString().slice(0,10) : "";
  byId("fldEnd").value = t.endDate ? new Date(t.endDate).toISOString().slice(0,10) : "";
  byId("fldBudget").value = t.budgetEUR || "";
  byId("fldNotes").value = t.notes || "";
  dlg.showModal();
}
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    destination: byId("fldDestination").value.trim(),
    type: byId("fldType").value,
    startDate: byId("fldStart").value || null,
    endDate: byId("fldEnd").value || null,
    budgetEUR: byId("fldBudget").value ? Number(byId("fldBudget").value) : null,
    notes: byId("fldNotes").value.trim() || null
  };
  if (state.editingId){
    await Store.updateTrip(state.editingId, payload);
  } else {
    await Store.createTrip(payload);
  }
  dlg.close();
  await refresh();
});

/* ===== Load & refresh ===== */
async function refresh(){
  try{
    state.trips = await Store.listTrips();
  }catch(e){
    console.warn("listTrips failed, switching to local demo mode", e);
    // Seed local demo for first-time use
    state.trips = [
      { id:"demo1", destination:"מילאנו, איטליה", type:"urban", startDate:"2025-01-12", endDate:"2025-01-17", budgetEUR:500, notes:"🔗 מלון + טיסות", createdAt: Date.now(), updatedAt: Date.now() },
      { id:"demo2", destination:"ול טורנס, צרפת", type:"ski", startDate:"2025-02-02", endDate:"2025-02-09", budgetEUR:1200, notes:"סקי-פס ורכב", createdAt: Date.now()-10000000, updatedAt: Date.now()-5000000 },
      { id:"demo3", destination:"קופנגן, תאילנד", type:"beach", startDate:"2025-08-10", endDate:"2025-08-20", budgetEUR:900, notes:"חופים, סרף", createdAt: Date.now()-20000000, updatedAt: Date.now()-15000000 },
    ];
  }
  renderTrips();
}

/* Boot */
refresh();