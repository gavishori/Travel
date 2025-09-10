
// ---- Minimal timeline-only script for the first page redesign ----

// Use existing Store if available (from your project). If not, mock a local one.
const Store = window.Store || (()=>{
  const LS_KEY = "travel_journal_data_v2";
  function load(){ try{ return JSON.parse(localStorage.getItem(LS_KEY)) || { trips:{} }; }catch{ return {trips:{}}; } }
  function save(d){ localStorage.setItem(LS_KEY, JSON.stringify(d)); }
  async function listTrips(){
    if (window.AppDataLayer?.mode === "firebase" && !firebase.auth().currentUser){
      console.warn("[guard] listTrips blocked until sign-in"); return [];
    }
    if (window.AppDataLayer?.mode === "firebase"){
      const uid = firebase.auth().currentUser?.uid;
      const snap = await db.collection("trips").where("ownerUid","==", uid).get();
      return snap.docs.map(d=>({ id:d.id, ...d.data() }));
    }else{
      const data = load();
      return Object.entries(data.trips).map(([id,t])=>({id, ...t}));
    }
  }
  async function deleteTrip(id){
    if (window.AppDataLayer?.mode === "firebase"){
      await db.collection("trips").doc(id).delete();
    }else{
      const data = load(); delete data.trips[id]; save(data);
    }
  }
  return { listTrips, deleteTrip };
})();

const TRIP_TYPE_HEBREW = {
  "beach":"בטן-גב","ski":"סקי","trek":"טרקים","urban":"עירוני","other":"אחר"
};

const state = { sortAsc: false, trips: [] };

const $ = (sel,root=document)=>root.querySelector(sel);
const $$ = (sel,root=document)=>Array.from(root.querySelectorAll(sel));

function fmtDate(tsOrStr){
  if (!tsOrStr) return "—";
  let d;
  if (typeof tsOrStr === "number") d = new Date(tsOrStr);
  else if (/^\d{4}-\d{2}-\d{2}/.test(tsOrStr)) d = new Date(tsOrStr);
  else d = new Date(tsOrStr);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString('he-IL', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function dayDiff(a,b){
  try{
    const d1 = new Date(a), d2 = new Date(b);
    const ms = d2.setHours(12,0,0,0) - d1.setHours(12,0,0,0);
    return Math.max(1, Math.round(ms/86400000));
  }catch{ return 1; }
}
function normalizeStart(trip){
  // Supports startDate (ISO) or startTs
  return trip.startDate || trip.start || trip.departure || trip.from || trip.startTs || trip.date || null;
}
function normalizeEnd(trip){
  return trip.endDate || trip.to || trip.return || trip.endTs || null;
}

async function loadTrips(){
  state.trips = await Store.listTrips();
  render();
}

function sortTripsInPlace(){
  state.trips.sort((a,b)=>{
    const as = new Date(normalizeStart(a)||0).getTime();
    const bs = new Date(normalizeStart(b)||0).getTime();
    return state.sortAsc ? (as-bs) : (bs-as);
  });
}

function render(){
  sortTripsInPlace();
  const list = $("#timeline");
  const tmpl = $("#tripItemTmpl");
  list.innerHTML = "";

  state.trips.forEach(trip=>{
    const li = tmpl.content.firstElementChild.cloneNode(true);

    const start = normalizeStart(trip);
    const end = normalizeEnd(trip);
    const days = dayDiff(start, end || start);

    $(".trip-destination", li).textContent = trip.destination || "יעד לא ידוע";
    $(".trip-dates", li).textContent = [fmtDate(start), fmtDate(end)].filter(Boolean).join(" — ");
    $(".trip-days", li).textContent = days + " ימים";
    const typeKey = (trip.type || trip.tripType || "other").toLowerCase();
    $(".trip-type", li).textContent = TRIP_TYPE_HEBREW[typeKey] || trip.type || "אחר";

    // menu
    const menu = $(".menu", li);
    const btn = $(".more-btn", li);
    const pop = $(".menu-popover", li);

    btn.addEventListener("click", (e)=>{
      e.stopPropagation();
      const isOpen = menu.classList.contains("open");
      $$(".menu.open").forEach(m=>m.classList.remove("open"));
      if (!isOpen) menu.classList.add("open");
      btn.setAttribute("aria-expanded", String(!isOpen));
    });
    pop.addEventListener("click", (e)=> e.stopPropagation());
    document.addEventListener("click", ()=> menu.classList.remove("open"));

    pop.querySelector('[data-action="edit"]').addEventListener("click", ()=>{
      // Allow host app to handle edit; fallback to hash route or event
      if (typeof window.onEditTrip === "function"){ window.onEditTrip(trip.id); }
      else { location.hash = "#/trip/" + trip.id; }
    });
    pop.querySelector('[data-action="delete"]').addEventListener("click", async ()=>{
      if (confirm("למחוק את הטיול?")){
        await Store.deleteTrip(trip.id);
        await loadTrips();
      }
    });

    list.appendChild(li);
  });
}

function updateSortBtn(){
  const sortBtn = $("#sortBtn");
  sortBtn.querySelector(".icon").textContent = state.sortAsc ? "↑" : "↓";
  sortBtn.setAttribute("aria-label", state.sortAsc ? "מיון מהישן לחדש" : "מיון מהחדש לישן");
}

function wireUI(){
  $("#sortBtn").addEventListener("click", ()=>{
    state.sortAsc = !state.sortAsc;
    updateSortBtn();
    render();
  });

  $("#addTripBtn").addEventListener("click", ()=>{
    if (typeof window.onAddTrip === "function"){ window.onAddTrip(); }
    else { alert("הוסף טיול: חבר לפעולה קיימת בפרויקט."); }
  });
}

window.addEventListener("DOMContentLoaded", ()=>{
  wireUI();
  updateSortBtn();

  // If Firebase is used, wait briefly for auth attempt, then load
  setTimeout(loadTrips, 300);
});
