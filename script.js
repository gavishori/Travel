// Production viewer: trips where ownerUid == current user
window.addEventListener('DOMContentLoaded', () => {
  const auth = firebase.auth();
  const db = firebase.firestore();
  const provider = new firebase.auth.GoogleAuthProvider();

  const $ = (id)=>document.getElementById(id);
  const el = {
    login: $("login"), logout: $("logout"),
    signedIn: $("signed-in"), signedOut: $("signed-out"),
    name: $("displayName"), email: $("email"), avatar: $("avatar"),
    trips: $("trips"), status: $("status"), logs: $("logs"),
  };
  const log = (m)=>{ el.logs.textContent += m + "\n"; };
  const setStatus = (m)=>{ el.status.textContent = m || ""; };

  const toDate = (v)=> v && typeof v.toDate==='function' ? v.toDate() : (v? new Date(v): null);
  const fmt = (d)=> d ? d.toLocaleDateString('he-IL') : '';
  const daysBetween = (a,b)=> (a&&b) ? Math.max(1, Math.round((b-a)/86400000)+1) : null;

  function renderCard(t){
    const start = toDate(t.startDate || t.start || t.from);
    const end   = toDate(t.endDate   || t.end   || t.to);
    const days  = t.days || daysBetween(start,end);
    const tags  = Array.isArray(t.tags) ? t.tags : (typeof t.tags==='string'? t.tags.split(/[\s,]+/): []);
    return `
      <div class="trip">
        <div class="name">${t.name || t.title || "ללא שם"}</div>
        <div class="meta">${start?fmt(start):""}${start&&end?" – ":""}${end?fmt(end):""}</div>
        <div class="meta">${days? days + " ימים" : ""}</div>
        <div class="meta">${tags.filter(Boolean).map(x=>`<span class="badge">${x}</span>`).join(" ")}</div>
      </div>`;
  }

  function subscribeTrips(uid){
    setStatus("טוען נסיעות...");
    el.trips.innerHTML = "";
    // המסלול הנכון לפרויקט: trips + ownerUid == uid
    const q = db.collection('trips')
      .where('ownerUid','==', uid)
      .orderBy('startDate','desc');

    return q.onSnapshot(
      (snap)=>{
        const rows = [];
        snap.forEach(doc=> rows.push(renderCard(doc.data()||{})));
        el.trips.innerHTML = rows.join('') || "<div class='meta'>אין נסיעות עדיין.</div>";
        setStatus("");
      },
      (err)=>{
        el.trips.innerHTML = "שגיאה ב-Firestore: " + (err.code || err.message);
        log("firestore error: " + (err.code||err.message));
      }
    );
  }

  let unsub = null;

  el.login?.addEventListener('click', async ()=>{
    el.logs.textContent = ""; setStatus("מתחבר...");
    try{ await auth.signInWithRedirect(provider); }catch(e){ log("login: "+(e.code||e.message)); setStatus(""); }
  });
  el.logout?.addEventListener('click', async ()=>{
    try{ await auth.signOut(); }catch(e){ log("logout: "+(e.code||e.message)); }
  });

  auth.getRedirectResult().then(r=>log("getRedirectResult: " + (r && r.user ? "ok":"no user")))
                         .catch(e=>log("redirect: "+(e.code||e.message)));

  auth.onAuthStateChanged(u=>{
    log("onAuthStateChanged: " + (u?'in':'out'));
    if(u){
      el.signedOut.style.display = 'none';
      el.signedIn.style.display = 'flex';
      el.name.textContent = u.displayName || "";
      el.email.textContent = u.email || "";
      el.avatar.src = u.photoURL || "https://ssl.gstatic.com/accounts/ui/avatar_2x.png";
      if (unsub) unsub(); unsub = subscribeTrips(u.uid);
    }else{
      if (unsub) { unsub(); unsub = null; }
      el.signedIn.style.display = 'none';
      el.signedOut.style.display = 'flex';
      el.trips.innerHTML = ""; setStatus("");
    }
  });
});
