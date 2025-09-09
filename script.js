/* ===== Helpers ===== */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const byId = (id) => document.getElementById(id);

function parseAnyDate(d){
  if (!d) return null;
  if (typeof d === "object" && d.seconds) return new Date(d.seconds * 1000);
  if (d instanceof Date) return d;
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s);
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m){ const [_, d1, m1, y] = m; return new Date(+y, +m1-1, +d1); }
  const guess = new Date(s); return isNaN(guess) ? null : guess;
}
function fmtDMY(d){
  const dt = parseAnyDate(d); if (!dt) return "—";
  const day = dt.getDate(); const mon = dt.getMonth()+1; const yr = dt.getFullYear();
  return `${day}.${mon}.${yr}`;
}
function daysDiff(a,b){ const A=parseAnyDate(a), B=parseAnyDate(b); if (!A||!B) return null; return Math.max(1, Math.round((B-A)/86400000)); }
function escapeHtml(s){ return String(s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function getTypes(t){ if (Array.isArray(t.types)) return [...t.types]; if (typeof t.type === 'string' && t.type) return [t.type]; return []; }

/* ===== Data layer (non-destructive; no writes on refresh) ===== */
const Data = (() => {
  const hasFirebase = !!(window.firebase && firebase.apps && firebase.apps.length);
  const db  = hasFirebase ? firebase.firestore() : null;
  const auth = hasFirebase ? firebase.auth() : null;
  const LS_KEY = "travel_journal_data_v2";

  function loadLS(){ try{ return JSON.parse(localStorage.getItem(LS_KEY)) || { trips:{} }; }catch{ return { trips:{} }; } }
  function saveLS(data){ localStorage.setItem(LS_KEY, JSON.stringify(data)); }

  function onAuth(cb){ if (auth && auth.onAuthStateChanged) auth.onAuthStateChanged(cb); else cb(null); }
  function uid(){ return auth && auth.currentUser ? auth.currentUser.uid : null; }
  function userEmail(){ return auth && auth.currentUser ? (auth.currentUser.email || auth.currentUser.displayName || "") : (localStorage.getItem("local_auth_user")||""); }

  async function listTrips(){
    if (auth && uid()){
      const snap = await db.collection("trips").where("ownerUid","==", uid()).get();
      return snap.docs.map(d => ({ id:d.id, ...d.data() }));
    } else {
      const data = loadLS();
      return Object.entries(data.trips).map(([id,t]) => ({ id, ...t }));
    }
  }
  async function createTrip(meta){
    const now = Date.now();
    const trip = { ...meta, createdAt: now, updatedAt: now };
    if (auth && uid()){
      const docData = { ...trip, ownerUid: uid() };
      const ref = await db.collection("trips").add(docData);
      return { id: ref.id, ...docData };
    } else {
      const data = loadLS();
      const id = "t_"+(crypto.randomUUID ? crypto.randomUUID() : String(now));
      data.trips[id] = { ...trip };
      saveLS(data);
      return { id, ...data.trips[id] };
    }
  }
  async function updateTrip(id, updates){
    if (auth && uid()){
      updates.updatedAt = Date.now();
      await db.collection("trips").doc(id).set(updates,{ merge:true });
    } else {
      const data = loadLS();
      data.trips[id] = { ...(data.trips[id]||{}), ...updates, updatedAt: Date.now() };
      saveLS(data);
    }
  }
  async function deleteTrip(id){
    if (auth && uid()){
      await db.collection("trips").doc(id).delete();
    } else {
      const data = loadLS();
      delete data.trips[id];
      saveLS(data);
    }
  }

  return { onAuth, uid, userEmail, listTrips, createTrip, updateTrip, deleteTrip };
})();

/* ===== UI State ===== */
const state = { trips: [], sortBy: "start", asc: true, editingId: null, current: null };

/* ===== Rendering ===== */
function renderTrips(){
  const list = byId("tripTimeline");
  list.innerHTML = "";
  let items = [...state.trips];

  const q = (byId("tripSearch").value || "").trim().toLowerCase();
  if (q){
    items = items.filter(t => {
      const hay = [t.destination, ...(getTypes(t)), t.notes].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  // Strictly chronological (only by start/end) per user's request
  const key = state.sortBy; const dir = state.asc ? 1 : -1;
  items.sort((a,b) => {
    const A = key==="start" ? (parseAnyDate(a.startDate)?.getTime() || 0) : (parseAnyDate(a.endDate)?.getTime() || 0);
    const B = key==="start" ? (parseAnyDate(b.startDate)?.getTime() || 0) : (parseAnyDate(b.endDate)?.getTime() || 0);
    return (A - B) * dir;
  });

  byId("emptyState").classList.toggle("hidden", items.length>0);

  for (const t of items){
    const li = document.createElement("li"); li.className = "trip-item"; li.dataset.id = t.id;
    const marker = document.createElement("div"); marker.className = "timeline-marker";
    const content = document.createElement("div"); content.className = "trip-content";

    const header = document.createElement("div"); header.className = "trip-header";

    const destEl = document.createElement("div"); destEl.className = "trip-destination"; destEl.textContent = t.destination || "—";

    const dateEl = document.createElement("div"); dateEl.className = "trip-date";
    const s = fmtDMY(t.startDate), e = fmtDMY(t.endDate);
    dateEl.innerHTML = (t.startDate || t.endDate) ? `<strong>${s || e}</strong>` : `<span class="muted">תאריכים לא הוזנו</span>`;

    const typesEl = document.createElement("div"); typesEl.className = "trip-types";
    const types = getTypes(t);
    if (types.length){
      for (const tp of types){
        const badge = document.createElement("span"); badge.className = "badge type";
        badge.textContent = labelForType(tp);
        typesEl.appendChild(badge);
      }
    }

    const menu = document.createElement("div"); menu.className = "trip-menu";
    const menuBtn = document.createElement("button"); menuBtn.className = "menu-btn"; menuBtn.type = "button"; menuBtn.textContent = "⋮";
    const dropdown = document.createElement("div"); dropdown.className = "menu-dropdown";
    const editBtn = document.createElement("button"); editBtn.textContent = "ערוך"; editBtn.addEventListener("click", () => openEdit(t));
    const delBtn = document.createElement("button"); delBtn.textContent = "מחק"; delBtn.style.color = "var(--danger)";
    delBtn.addEventListener("click", async () => { if (confirm("למחוק את הטיול הזה?")) { await Data.deleteTrip(t.id); await refresh(); } });
    dropdown.append(editBtn, delBtn); menu.append(menuBtn, dropdown);

    header.append(destEl, typesEl, dateEl, menu);
    content.append(header);

    // Details row: days + range
    const details = document.createElement("div"); details.className = "trip-details";
    const dur = daysDiff(t.startDate, t.endDate);
    const range = (t.startDate || t.endDate) ? `${fmtDMY(t.startDate)} — ${fmtDMY(t.endDate)}` : "";
    const chips = [
      dur ? `<span class="badge">${dur} ימים</span>` : `<span class="badge">לא ידוע</span>`,
      range ? `<span class="badge">${range}</span>` : ""
    ].filter(Boolean).join(" ");
    details.innerHTML = chips;
    content.append(details);

    li.append(marker, content);
    list.append(li);
  }
}

function labelForType(type){
  return ({ beach:"בטן-גב", ski:"סקי", trek:"טרקים", urban:"עירוני", other:"אחר" })[type] || "אחר";
}

/* ===== Events ===== */
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".menu-btn");
  $$(".trip-menu").forEach(m => m.classList.remove("open"));
  if (btn) { btn.parentElement.classList.toggle("open"); e.stopPropagation(); }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $$(".trip-menu").forEach(m => m.classList.remove("open")); });

byId("tripSearch").addEventListener("input", renderTrips);
byId("sortBy").addEventListener("change", (e) => { state.sortBy = e.target.value; renderTrips(); });
byId("toggleAsc").addEventListener("click", () => { state.asc = !state.asc; renderTrips(); });

/* Theme toggle */
byId("themeToggle").addEventListener("click", () => {
  const root = document.documentElement;
  const isLight = root.classList.toggle("light");
  localStorage.setItem("theme", isLight ? "light" : "dark");
});
(function initTheme(){ const saved = localStorage.getItem("theme"); if (saved === "light") document.documentElement.classList.add("light"); })();

/* Header user name */
function updateUserBadge(){
  const el = byId("userBadge");
  el.textContent = Data.userEmail() ? Data.userEmail() : "";
}
byId("signOutBtn").addEventListener("click", async () => { try{ await firebase.auth().signOut(); }catch(e){} });

/* ===== Dialog add/edit with MULTI-SELECT TYPES ===== */
const dlg = byId("tripDialog");
const form = byId("tripForm");
const titleEl = byId("tripDialogTitle");

byId("addTripFab").addEventListener("click", () => openAdd());

function fillTypesCheckboxes(selected){
  $$('input[name="types"]').forEach(cb => { cb.checked = selected.includes(cb.value); });
}
function getSelectedTypes(){
  return $$('input[name="types"]').filter(cb => cb.checked).map(cb => cb.value);
}

function openAdd(){
  state.editingId = null;
  titleEl.textContent = "הוספת טיול";
  form.reset();
  fillTypesCheckboxes([]);
  dlg.showModal();
}
function openEdit(t){
  state.editingId = t.id;
  titleEl.textContent = "עריכת טיול";
  byId("fldDestination").value = t.destination || "";
  byId("fldStart").value = parseAnyDate(t.startDate) ? new Date(parseAnyDate(t.startDate)).toISOString().slice(0,10) : "";
  byId("fldEnd").value = parseAnyDate(t.endDate) ? new Date(parseAnyDate(t.endDate)).toISOString().slice(0,10) : "";
  fillTypesCheckboxes(getTypes(t));
  dlg.showModal();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const updates = {
    destination: byId("fldDestination").value.trim(),
    startDate: byId("fldStart").value || null,
    endDate: byId("fldEnd").value || null,
  };
  const selectedTypes = getSelectedTypes();
  // Back-compat: write 'types' if multi, keep 'type' if single existed before
  if (state.editingId){
    const original = state.trips.find(x => x.id === state.editingId) || {};
    if (Array.isArray(original.types) || selectedTypes.length > 1){
      updates.types = selectedTypes;
    } else {
      updates.type = selectedTypes[0] || original.type || null;
    }
    await Data.updateTrip(state.editingId, updates);
  } else {
    // New trips: store array 'types'
    updates.types = selectedTypes;
    await Data.createTrip(updates);
  }
  dlg.close();
  await refresh();
});

/* ===== Load ===== */
async function refresh(){
  state.trips = await Data.listTrips();
  renderTrips();
  updateUserBadge();
}

// Init: auth state -> just update badge & render
const auth = firebase.auth && firebase.auth();
if (auth && auth.onAuthStateChanged){ auth.onAuthStateChanged(() => { updateUserBadge(); }); }
refresh();