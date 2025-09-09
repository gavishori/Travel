// StoreCompat: uses Firebase if available; falls back to localStorage
(function(){
  const LS_KEY = "travel_journal_data_v2";
  function loadLS(){ try{ return JSON.parse(localStorage.getItem(LS_KEY)) || { trips:{} }; }catch{ return { trips:{} }; } }
  function saveLS(data){ localStorage.setItem(LS_KEY, JSON.stringify(data)); }

  async function ensureAuth(){
    try{
      if (window.auth && window.googleProvider){
        if (!auth.currentUser){
          await window.AppDataLayer.ensureAuth?.();
        }
        return auth.currentUser?.uid || null;
      }
    }catch(_){}
    return null;
  }

  window.StoreCompat = {
    async listTrips(){
      // Firebase first
      try{
        if (window.db){
          const uid = await ensureAuth();
          if (!uid) return [];
          const snap = await db.collection("trips").where("ownerUid","==", uid).get();
          return snap.docs.map(d=>({ id:d.id, ...d.data() }));
        }
      }catch(e){ console.warn("Firebase listTrips failed", e); }
      // Local fallback
      const data = loadLS();
      return Object.entries(data.trips).map(([id,t])=>({ id, ...t }));
    },
    async getTrip(id){
      try{
        if (window.db){
          const uid = await ensureAuth(); if (!uid) return null;
          const doc = await db.collection("trips").doc(id).get();
          return doc.exists ? { id: doc.id, ...doc.data() } : null;
        }
      }catch(e){}
      const data = loadLS(); const t = data.trips[id]; return t ? { id, ...t } : null;
    },
    async updateTrip(id, updates){
      try{
        if (window.db){
          updates.updatedAt = Date.now();
          await db.collection("trips").doc(id).set(updates, { merge:true });
          return;
        }
      }catch(e){}
      const data = loadLS(); data.trips[id] = { ...(data.trips[id]||{}), ...updates, updatedAt: Date.now() }; saveLS(data);
    },
    async deleteTrip(id){
      try{
        if (window.db){ await db.collection("trips").doc(id).delete(); return; }
      }catch(e){}
      const data = loadLS(); delete data.trips[id]; saveLS(data);
    },
    async createTrip(meta){
      const nowTs = Date.now();
      const trip = { ...meta, createdAt: nowTs, updatedAt: nowTs };
      try{
        if (window.db){
          const uid = await ensureAuth(); if (!uid) return null;
          const doc = await db.collection("trips").add({ ...trip, ownerUid: uid });
          return { id: doc.id, ...trip, ownerUid: uid };
        }
      }catch(e){}
      const data = loadLS();
      const id = "t_"+ (crypto.randomUUID ? crypto.randomUUID() : String(nowTs));
      data.trips[id] = trip; saveLS(data);
      return { id, ...trip };
    }
  };
})();

// Timeline UI
(function(){
  const $ = (s,r=document)=>r.querySelector(s);
  const ICONS = { ski:"🎿", trek:"🥾", beach:"🏖️", urban:"🏙️", other:"🧳" };
  const state = { sortAsc:true };

  function fmtRange(a,b){
    try{
      const f = (d)=> new Date(d).toLocaleDateString('he-IL', { day:'2-digit', month:'long', year:'numeric' });
      return `${f(a)} – ${f(b)}`;
    }catch(_){ return `${a||''} – ${b||''}`; }
  }
  function matches(t,q){
    if (!q) return true; q=q.trim().toLowerCase();
    return [t.title, t.destination, t.type].some(v=> String(v||'').toLowerCase().includes(q));
  }
  function sortTrips(arr){
    return arr.slice().sort((a,b)=>{
      const d1 = new Date(a.startDate||a.start||a.from||0).getTime();
      const d2 = new Date(b.startDate||b.start||b.from||0).getTime();
      return state.sortAsc ? d1-d2 : d2-d1;
    });
  }

  async function render(){
    const host = $("#timeline"); if (!host) return;
    const q = $("#tripSearch")?.value || "";
    const trips = await window.StoreCompat.listTrips();
    const filtered = sortTrips(trips).filter(t=>matches(t,q));
    host.innerHTML = "";
    for (const t of filtered){
      const li = document.createElement("li");
      const dot = document.createElement("div"); dot.className="timeline-dot"; dot.innerHTML=`<span>${ICONS[t.type]||ICONS.other}</span>`;
      const info = document.createElement("div"); info.className="trip-info";
      const sd=t.startDate||t.start||t.from, ed=t.endDate||t.end||t.to;
      info.innerHTML = `<h3>${t.title||t.destination||"טיול"}</h3><div class="trip-meta"><span class="badge">${t.destination||"—"}</span><span class="muted">${fmtRange(sd,ed)}</span></div>`;
      const actions = document.createElement("div"); actions.className="actions";
      actions.innerHTML = `<button class="menu-btn" aria-label="עוד פעולות" title="עוד פעולות">⋮</button>
        <div class="menu" role="menu">
          <button class="edit" data-id="${t.id}">ערוך</button>
          <button class="delete" data-id="${t.id}">מחק</button>
        </div>`;
      li.append(dot,info,actions); host.appendChild(li);
    }
  }

  document.addEventListener("click", async (e)=>{
    const actions = e.target.closest(".actions");
    document.querySelectorAll(".actions.open").forEach(a=>{ if (a!==actions) a.classList.remove("open"); });
    if (actions && e.target.classList.contains("menu-btn")) actions.classList.toggle("open");

    if (e.target.matches(".menu .delete")){
      const id = e.target.getAttribute("data-id");
      if (id && confirm("למחוק את הטיול?")){ await StoreCompat.deleteTrip(id); render(); }
    }
    if (e.target.matches(".menu .edit")){
      const id = e.target.getAttribute("data-id");
      const t = await StoreCompat.getTrip(id) || {};
      const title = prompt("כותרת הטיול:", t.title||""); if (title===null) return;
      const destination = prompt("יעד:", t.destination||""); if (destination===null) return;
      const startDate = prompt("תאריך התחלה (YYYY-MM-DD):", t.startDate||""); if (startDate===null) return;
      const endDate = prompt("תאריך סיום (YYYY-MM-DD):", t.endDate||""); if (endDate===null) return;
      const type = prompt("סוג (urban/ski/trek/beach/other):", t.type||"urban"); if (type===null) return;
      await StoreCompat.updateTrip(id, { title, destination, startDate, endDate, type });
      render();
    }
  });

  $("#sortBtn")?.addEventListener("click", ()=>{
    state.sortAsc = !state.sortAsc;
    $("#sortBtn").textContent = state.sortAsc ? "סדר: מהקרוב לרחוק" : "סדר: מהרחוק לקרוב";
    render();
  });
  $("#tripSearch")?.addEventListener("input", ()=> render());
  $("#addTripBtn")?.addEventListener("click", async ()=>{
    const title = prompt("כותרת הטיול:"); if (title===null || !title.trim()) return;
    const destination = prompt("יעד:"); if (destination===null) return;
    const startDate = prompt("תאריך התחלה (YYYY-MM-DD):"); if (startDate===null) return;
    const endDate = prompt("תאריך סיום (YYYY-MM-DD):"); if (endDate===null) return;
    const type = prompt("סוג (urban/ski/trek/beach/other):","urban"); if (type===null) return;
    await StoreCompat.createTrip({ title, destination, startDate, endDate, type });
    render();
  });

  // initial paint + small delays to allow Firebase auth redirect
  render();
  setTimeout(render, 1200);
  setInterval(render, 15000);
})();