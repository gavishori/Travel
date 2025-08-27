/* FLYMILY minimal mobile client (strict filter, no placeholders) */
(function(){
  if (window.__FLY_MIN__) return; window.__FLY_MIN__ = true;

  const $ = (s)=>document.querySelector(s);
  const statusEl = document.getElementById('status');
  const listEl = document.getElementById('trips');
  const signinBtn = document.getElementById('signinBtn');
  const signoutBtn = document.getElementById('signoutBtn');

  function setStatus(msg){ statusEl.textContent = msg||''; }
  function clearList(){ listEl.innerHTML = ''; }
  function renderEmpty(){ listEl.innerHTML = '<p style="grid-column:1/-1;text-align:center;opacity:.7;margin:24px 0">אין עדיין טיולים</p>'; }
  function cardHTML(trip){
    const title = trip.title || 'טיול';
    const dest = trip.destination || '';
    const when = trip.dateText || '';
    return `<article class="card">
      <h3>${title}</h3>
      <div class="meta">${dest}${when?(" • "+when):""}</div>
      <div class="meta">${trip.tags||""}</div>
    </article>`;
  }

  function renderTrips(docs, uid){
    clearList();
    let html = '';
    docs.forEach(d => {
      const t = typeof d.data === 'function' ? d.data() : d;
      if (!t || t.ownerUid !== uid) return;          // ← לא שלי? לא מציירים.
      html += cardHTML(t);
    });
    listEl.innerHTML = html || '';
    if (!html) renderEmpty();
  }

  function isMobile(){ return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent); }
  function isStandalone(){
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone;
  }

  async function signInGoogle(){
    try{
      if (window.auth && window.googleProvider){
        if (isMobile() || isStandalone()){
          await auth.signInWithRedirect(googleProvider);
        }else if (auth.signInWithPopup){
          await auth.signInWithPopup(googleProvider);
        }else{
          await auth.signInWithRedirect(googleProvider);
        }
      }
    }catch(e){ console.error('signin', e); }
  }
  window.signInGoogle = signInGoogle;

  // UI buttons
  signinBtn.onclick = signInGoogle;
  signoutBtn.onclick = ()=>auth?.signOut?.();

  function wireAuthCompat(){
    if (!window.firebase?.auth) return false;
    auth = firebase.auth();
    // pick redirect result quietly
    try{ auth.getRedirectResult().catch(()=>{}); }catch(_){}
    auth.onAuthStateChanged(user => {
      if (!user){
        setStatus('יש להתחבר כדי לראות טיולים'); clearList();
        signinBtn.hidden = false; signoutBtn.hidden = true;
        return;
      }
      signinBtn.hidden = true; signoutBtn.hidden = false;
      setStatus('');
      startTripsCompat(user.uid);
    });
    return true;
  }

  function startTripsCompat(uid){
    try{
      const db = firebase.firestore();
      const ref = db.collection('trips').where('ownerUid','==', uid).orderBy('createdAt','desc');
      ref.onSnapshot(snap => {
        if (!snap || snap.empty){ renderEmpty(); return; }
        renderTrips(snap.docs, uid);
      }, err => { console.error(err); setStatus('שגיאה בטעינה'); });
    }catch(e){
      console.warn('compat firestore failed', e); renderEmpty();
    }
  }

  // Start
  if (!wireAuthCompat()){
    setStatus('קונפיגורציה חסרה של Firebase (compat)');
  }
})();
