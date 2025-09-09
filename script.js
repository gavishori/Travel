/* ===== Utilities ===== */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const byId = (id) => document.getElementById(id);

const TRIP_ICONS = { ski:"⛷️", beach:"🏝️", trek:"🥾", urban:"🏙️", other:"🎒" };
function iconFor(type){ return TRIP_ICONS[type] || TRIP_ICONS.other; }

function parseAnyDate(d){
  if (!d) return null;
  if (typeof d === "object" && d.seconds) return new Date(d.seconds * 1000); // Firestore Timestamp
  if (d instanceof Date) return d;
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s);           // ISO
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);         // D.M.YYYY
  if (m){ const [_, d1, m1, y] = m; return new Date(+y, +m1-1, +d1); }
  const guess = new Date(s); return isNaN(guess) ? null : guess;
}
function fmtDateSmart(d){ const dt = parseAnyDate(d); return dt ? dt.toLocaleDateString('he-IL') : "—"; }
function daysDiff(a,b){ const A=parseAnyDate(a), B=parseAnyDate(b); if (!A||!B) return null; return Math.max(1, Math.round((B-A)/86400000)); }
function labelForType(type){ return ({ beach:"בטן-גב", ski:"סקי", trek:"טרקים", urban:"עירוני", other:"אחר" })[type] || "אחר"; }
function escapeHtml(s){ return String(s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ===== Data layer ===== */
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
      if (!uid) return [];
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
      if (!uid) throw new Error("not-authenticated");
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
      await ensureAuth();
      if (!uid) throw new Error("not-authenticated");
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
      await ensureAuth();
      if (!uid) throw new Error("not-authenticated");
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
const state = { trips: [], sortBy: "start", asc: true, editingId: null, uid: null };

/* ===== Views ===== */
const authView = byId("authView");
const appView  = byId("appView");
function showAuth(){ authView.classList.remove("hidden"); appView.classList.add("hidden"); }
function showApp(){ authView.classList.add("hidden"); appView.classList.remove("hidden"); }

/* ===== Rendering ===== */
function renderTrips(){
  const list = byId("tripTimeline");
  list.innerHTML = "";
  let items = [...state.trips];

  const q = (byId("tripSearch").value || "").trim().toLowerCase();
  if (q){
    items = items.filter(t => {
      const hay = [t.destination, t.type, t.notes].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  const key = state.sortBy;
  const dir = state.asc ? 1 : -1;
  items.sort((a,b) => {
    const A = (key==="start") ? parseAnyDate(a.startDate)?.getTime()
            : (key==="end") ? parseAnyDate(a.endDate)?.getTime()
            : (key==="updated") ? a.updatedAt
            : a.createdAt;
    const B = (key==="start") ? parseAnyDate(b.startDate)?.getTime()
            : (key==="end") ? parseAnyDate(b.endDate)?.getTime()
            : (key==="updated") ? b.updatedAt
            : b.createdAt;
    return ((A||0) - (B||0)) * dir;
  });

  byId("emptyState").classList.toggle("hidden", items.length>0);

  for (const t of items){
    const li = document.createElement("li");
    li.className = "trip-item"; li.dataset.id = t.id;

    const marker = document.createElement("div"); marker.className = "timeline-marker";
    const content = document.createElement("div"); content.className = "trip-content";

    const header = document.createElement("div"); header.className = "trip-header";
    const dateEl = document.createElement("span"); dateEl.className = "trip-date";
    dateEl.textContent = fmtDateSmart(t.startDate || t.endDate || t.createdAt);
    const iconEl = document.createElement("span"); iconEl.className = "trip-icon"; iconEl.textContent = iconFor(t.type);
    const destEl = document.createElement("span"); destEl.className = "trip-destination"; destEl.textContent = t.destination || "—";

    const menu = document.createElement("div"); menu.className = "trip-menu";
    const menuBtn = document.createElement("button"); menuBtn.className = "menu-btn"; menuBtn.type = "button"; menuBtn.textContent = "⋮";
    const dropdown = document.createElement("div"); dropdown.className = "menu-dropdown";

    const editBtn = document.createElement("button"); editBtn.textContent = "ערוך"; editBtn.addEventListener("click", () => openEdit(t));
    const delBtn = document.createElement("button"); delBtn.textContent = "מחק"; delBtn.style.color = "var(--danger)";
    delBtn.addEventListener("click", async () => { if (confirm("למחוק את הטיול הזה?")) { await Store.deleteTrip(t.id); await refresh(); } });
    dropdown.append(editBtn, delBtn); menu.append(menuBtn, dropdown);
    header.append(dateEl, iconEl, destEl, menu);
    content.append(header);

    const details = document.createElement("div"); details.className = "trip-details";
    const datesStr = (t.startDate || t.endDate) ? `${fmtDateSmart(t.startDate)} — ${fmtDateSmart(t.endDate)}` : "תאריכים לא הוזנו";
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

/* ===== Events (global) ===== */
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".menu-btn");
  $$(".trip-menu").forEach(m => m.classList.remove("open"));
  if (btn) { btn.parentElement.classList.toggle("open"); e.stopPropagation(); }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $$(".trip-menu").forEach(m => m.classList.remove("open")); });

byId("tripSearch").addEventListener("input", renderTrips);
byId("sortBy").addEventListener("change", (e) => { state.sortBy = e.target.value; renderTrips(); });
byId("toggleAsc").addEventListener("click", () => { state.asc = !state.asc; renderTrips(); });

byId("themeToggle").addEventListener("click", () => {
  const root = document.documentElement;
  const isLight = root.classList.toggle("light");
  localStorage.setItem("theme", isLight ? "light" : "dark");
});
(function initTheme(){ const saved = localStorage.getItem("theme"); if (saved === "light") document.documentElement.classList.add("light"); })();

/* ===== Auth UI (email/password only) ===== */
const signOutBtn = byId("signOutBtn");
const authForm = byId("authForm");
const authEmail = byId("authEmail");
const authPassword = byId("authPassword");
const authError = byId("authError");
const loginBtn = byId("loginBtn");
const registerBtn = byId("registerBtn");

function setAuthState(uid){
  state.uid = uid || null;
  if (state.uid){ showApp(); } else { showAuth(); }
}

signOutBtn.addEventListener("click", async () => {
  try{
    await window.AppDataLayer?.emailAuth?.signOut();
  }catch(e){}
  setAuthState(null);
  await refresh();
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  try{
    await window.AppDataLayer?.emailAuth?.signIn(authEmail.value, authPassword.value);
    setAuthState(window.AppDataLayer?._auth?.currentUser?.uid);
    authError.textContent = "";
    await refresh();
  }catch(err){
    authError.textContent = err && err.message ? err.message : "Login failed";
  }
});

registerBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  try{
    await window.AppDataLayer?.emailAuth?.register(authEmail.value, authPassword.value);
    setAuthState(window.AppDataLayer?._auth?.currentUser?.uid);
    authError.textContent = "";
    await refresh();
  }catch(err){
    authError.textContent = err && err.message ? err.message : "Registration failed";
  }
});

/* ===== Trip dialog ===== */
const dlg = byId("tripDialog");
const form = byId("tripForm");
const titleEl = byId("tripDialogTitle");

byId("addTripFab").addEventListener("click", () => openAdd());

function openAdd(){
  if (window.AppDataLayer?.mode === "firebase" && !state.uid){
    alert("יש להתחבר עם מייל וסיסמה לפני יצירת טיול.");
    return;
  }
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
  byId("fldStart").value = parseAnyDate(t.startDate) ? new Date(parseAnyDate(t.startDate)).toISOString().slice(0,10) : "";
  byId("fldEnd").value = parseAnyDate(t.endDate) ? new Date(parseAnyDate(t.endDate)).toISOString().slice(0,10) : "";
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
  try{
    if (state.editingId){ await Store.updateTrip(state.editingId, payload); }
    else { await Store.createTrip(payload); }
    dlg.close(); await refresh();
  }catch(err){
    alert("נדרש להתחבר כדי לשמור לענן. אפשר לעבוד לוקאלית אם Firebase לא מוגדר.");
  }
});

/* ===== Load & refresh ===== */
async function refresh(){
  try{
    const uid = await window.AppDataLayer?.ensureAuth?.();
    setAuthState(uid);
    state.trips = await Store.listTrips();
    if (uid) {
      // Normalize legacy dates
      await Promise.all(state.trips.map(async t => {
        const s = parseAnyDate(t.startDate), e = parseAnyDate(t.endDate);
        const norm = {};
        if (s && typeof t.startDate !== "string") norm.startDate = s.toISOString().slice(0,10);
        if (e && typeof t.endDate !== "string") norm.endDate = e.toISOString().slice(0,10);
        if (Object.keys(norm).length) await Store.updateTrip(t.id, norm);
      }));
    }
  }catch(e){
    // Local mode
    setAuthState(null);
    state.trips = [];
  }
  if (!state.trips.length && (window.AppDataLayer?.mode !== "firebase" || !state.uid)){
    state.trips = [
      { id:"demo1", destination:"מילאנו, איטליה", type:"urban", startDate:"2025-01-12", endDate:"2025-01-17", budgetEUR:500, notes:"מלון + טיסות", createdAt: Date.now(), updatedAt: Date.now() },
      { id:"demo2", destination:"ול טורנס, צרפת", type:"ski", startDate:"2025-02-02", endDate:"2025-02-09", budgetEUR:1200, notes:"סקי-פס ורכב", createdAt: Date.now()-10000000, updatedAt: Date.now()-5000000 }
    ];
  }
  renderTrips();
}

// Auth state listener (if Firebase available)
try{
  const auth = window.AppDataLayer?._auth;
  if (auth && auth.onAuthStateChanged){
    auth.onAuthStateChanged((u) => { setAuthState(u ? u.uid : null); refresh(); });
  } else {
    refresh();
  }
}catch(_){ refresh(); }