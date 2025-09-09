const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

const icons = { ski:"🎿", trek:"🥾", beach:"🏖️", urban:"🏙️", other:"🧳" };

async function renderTrips(){
  const list = $("#tripTimeline");
  list.innerHTML = "";
  const q = ($("#tripSearch").value||"").toLowerCase();
  let trips = await Store.listTrips();
  trips = trips.filter(t=>[t.title,t.destination,t.type].some(v=>String(v||"").toLowerCase().includes(q)));
  trips.sort((a,b)=> new Date(a.startDate)-new Date(b.startDate));
  if (!state.sortAsc) trips.reverse();

  for(const t of trips){
    const li=document.createElement("li");
    const dot=document.createElement("div");
    dot.className="timeline-dot";
    dot.innerHTML=`<span>${icons[t.type]||icons.other}</span>`;
    const info=document.createElement("div");
    info.className="trip-info";
    info.innerHTML=`<h3>${t.title||t.destination||"טיול"}</h3><div class="trip-meta">${t.destination||""} • <span class="muted">${t.startDate||""} – ${t.endDate||""}</span></div>`;
    const actions=document.createElement("div");
    actions.className="actions";
    actions.innerHTML=`<button class="menu-btn">⋮</button><div class="menu"><button class="edit" data-id="${t.id}">ערוך</button><button class="delete" data-id="${t.id}">מחק</button></div>`;
    li.append(dot,info,actions); list.append(li);
  }
}

const state={ sortAsc:true };

document.addEventListener("click",e=>{
  const actions=e.target.closest(".actions");
  $$(".actions.open").forEach(a=>{ if(a!==actions) a.classList.remove("open"); });
  if(e.target.classList.contains("menu-btn")){ actions.classList.toggle("open"); }
  if(e.target.classList.contains("edit")){ openEdit(e.target.dataset.id); }
  if(e.target.classList.contains("delete")){ Store.deleteTrip(e.target.dataset.id).then(renderTrips); }
});

$("#sortBtn").addEventListener("click",()=>{ state.sortAsc=!state.sortAsc; renderTrips(); });
$("#tripSearch").addEventListener("input",renderTrips);
$("#addTripBtn").addEventListener("click",()=> openEdit(null));

async function openEdit(id){
  const trip=id? await Store.getTrip(id): null;
  // כאן אפשר לפתוח דיאלוג עריכה כמו בקוד המקורי שלך
  alert(trip? "עריכה עדיין לא ממומשת כאן" : "יצירה חדשה עדיין לא ממומשת כאן");
}

renderTrips();


/*__TIMELINE_INJECT__*/
(function(){
  // Minimal DOM helpers
  const $ = (sel, root=document)=> root.querySelector(sel);

  // Respect RTL and existing theme; use existing Store + AppDataLayer as-is
  const ICONS = { ski:"🎿", trek:"🥾", beach:"🏖️", urban:"🏙️", other:"🧳" };

  // Utilities
  function fmtRange(a,b){
    try{
      const f = (d)=> new Date(d).toLocaleDateString('he-IL', { day:'2-digit', month:'long', year:'numeric' });
      return `${f(a)} – ${f(b)}`;
    }catch(_){ return `${a||''} – ${b||''}`; }
  }
  function matches(trip, q){
    if (!q) return true;
    q = q.trim().toLowerCase();
    return [trip.title, trip.destination, trip.type].some(v => String(v||'').toLowerCase().includes(q));
  }
  function sortTrips(arr){
    return arr.slice().sort((a,b)=>{
      const d1 = new Date(a.startDate||a.start||a.from||0).getTime();
      const d2 = new Date(b.startDate||b.start||b.from||0).getTime();
      return d1 - d2;
    });
  }
  async function fetchTrips(){
    try{
      if (window.Store && Store.listTrips) return await Store.listTrips();
    }catch(e){}
    // Fallback to local (very unlikely if original works)
    try{ return JSON.parse(localStorage.getItem('travel_journal_data_v2'))?.trips || []; }catch(_){ return []; }
  }

  async function render(){
    const host = $("#timeline");
    if (!host) return;
    const q = $("#tripSearch") ? $("#tripSearch").value : "";
    const tripsRaw = await fetchTrips();
    // normalize format: Store.listTrips() returns array of {id, ...}
    const trips = Array.isArray(tripsRaw) ? tripsRaw.map(t=> t.id ? t : { id: t[0], ...t[1] }) : [];
    const filtered = sortTrips(trips).filter(t=>matches(t,q));

    host.innerHTML = "";
    for (const t of filtered){
      const li = document.createElement("li");

      const dot = document.createElement("div");
      dot.className = "timeline-dot";
      const icon = ICONS[t.type] || ICONS.other;
      dot.innerHTML = `<span>${icon}</span>`;

      const info = document.createElement("div");
      info.className = "trip-info";
      const title = t.title || t.destination || "טיול";
      const dest  = t.destination || "—";
      const sd = t.startDate || t.start || t.from;
      const ed = t.endDate || t.end || t.to;
      info.innerHTML = `
        <h3>${title}</h3>
        <div class="trip-meta">
          <span class="badge">${dest}</span>
          <span class="muted">${fmtRange(sd, ed)}</span>
        </div>
      `;

      const actions = document.createElement("div");
      actions.className = "actions";
      actions.innerHTML = `
        <button class="menu-btn" aria-label="עוד פעולות" title="עוד פעולות">⋮</button>
        <div class="menu" role="menu">
          <button class="edit" data-id="${t.id||''}">ערוך</button>
          <button class="delete" data-id="${t.id||''}">מחק</button>
        </div>
      `;

      li.appendChild(dot);
      li.appendChild(info);
      li.appendChild(actions);
      host.appendChild(li);
    }
  }

  // Global click handler for menu open/close and actions
  document.addEventListener("click", async (e)=>{
    const actions = e.target.closest(".actions");
    // Close others
    document.querySelectorAll(".actions.open").forEach(a=>{ if (a!==actions) a.classList.remove("open"); });
    if (actions && e.target.classList.contains("menu-btn")){
      actions.classList.toggle("open");
    }

    if (e.target.matches(".menu .delete")){
      const id = e.target.getAttribute("data-id");
      if (id && confirm("למחוק את הטיול?")){
        try{
          if (window.Store && Store.deleteTrip) { await Store.deleteTrip(id); }
        }catch(err){ console.warn("deleteTrip failed", err); }
        render();
      }
    }

    if (e.target.matches(".menu .edit")){
      const id = e.target.getAttribute("data-id");
      // Try to use an existing edit dialog if available:
      if (typeof window.openTripEditor === "function"){ window.openTripEditor(id); return; }
      // Fallback: open a lightweight prompt-based editor (keeps functionality alive without לשבור):
      try{
        const trips = await (window.Store && Store.getTrip ? Store.getTrip(id) : null);
        const cur = trips || {};
        const title = prompt("כותרת הטיול:", cur.title || "");
        if (title===null) return;
        const destination = prompt("יעד:", cur.destination || "");
        if (destination===null) return;
        const startDate = prompt("תאריך התחלה (YYYY-MM-DD):", cur.startDate || "");
        if (startDate===null) return;
        const endDate = prompt("תאריך סיום (YYYY-MM-DD):", cur.endDate || "");
        if (endDate===null) return;
        const type = prompt("סוג (urban/ski/trek/beach/other):", cur.type || "urban");
        if (window.Store && Store.updateTrip) await Store.updateTrip(id, { title, destination, startDate, endDate, type });
        render();
      }catch(err){ console.warn("edit fallback failed", err); }
    }
  });

  // Search binding
  const searchEl = $("#tripSearch");
  if (searchEl) searchEl.addEventListener("input", ()=> render());

  // First paint + periodic refresh to reflect external edits
  render();
  // Refresh after sign-in if Firebase mode uses redirect
  setTimeout(render, 1000);
  setInterval(render, 15000);
})();