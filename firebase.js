/* Firebase compat bootstrap + simple Firestore bridge + auth with popup + iOS redirect fallback */

(function(){
  const config = window.firebaseConfig || null;
  let app=null, auth=null, db=null, user=null;
  let mode='local'; // default
  let postRedirectResolved=false;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);

  if(config){
    try{
      app = firebase.initializeApp(config);
      auth = firebase.auth();
      db = firebase.firestore();
      mode = 'firebase';

      // Persistence: SESSION on iOS (popup issues), LOCAL otherwise
      auth.setPersistence(isIOS ? firebase.auth.Auth.Persistence.SESSION : firebase.auth.Auth.Persistence.LOCAL);

      // Handle redirect result (iOS)
      auth.getRedirectResult().then(res=>{
        if(res && res.user){ user = res.user; }
        postRedirectResolved = true;
      }).catch(err=>{
        console.warn('redirect result error', err); postRedirectResolved = true;
      });

      // Observe auth state
      auth.onAuthStateChanged(u=>{
        user = u || null;
        if(user){ mode='firebase'; } else { mode = config ? 'firebase' : 'local'; }
      });

    }catch(e){
      console.warn('Firebase init failed, fallback to local mode', e);
      app=auth=db=null; mode='local';
    }
  }

  // Minimal Firestore schema: collection 'trips' with doc id, filtered by ownerUid
  async function listTrips(){
    if(mode!=='firebase' || !user) return Object.values((localStorage.getItem('flymily.v1') && JSON.parse(localStorage.getItem('flymily.v1')) || {trips:{}}).trips||{});
    const snap = await db.collection('trips').where('ownerUid','==',user.uid).get();
    return snap.docs.map(d=>d.data());
  }
  async function getTrip(id){
    if(mode!=='firebase' || !user){
      const s = JSON.parse(localStorage.getItem('flymily.v1')||'{"trips":{}}'); return s.trips?.[id]||null;
    }
    const ref = db.collection('trips').doc(id); const doc = await ref.get();
    return doc.exists ? doc.data() : null;
  }
  async function upsertTrip(trip){
    if(mode!=='firebase' || !user){
      const s = JSON.parse(localStorage.getItem('flymily.v1')||'{"trips":{}}'); s.trips ||= {};
      s.trips[trip.id]=trip; localStorage.setItem('flymily.v1', JSON.stringify(s)); return trip;
    }
    trip.ownerUid = user.uid;
    await db.collection('trips').doc(trip.id).set(trip, {merge:false});
    return trip;
  }
  async function deleteTrip(id){
    if(mode!=='firebase' || !user){
      const s = JSON.parse(localStorage.getItem('flymily.v1')||'{"trips":{}}'); delete s.trips?.[id]; localStorage.setItem('flymily.v1', JSON.stringify(s)); return;
    }
    await db.collection('trips').doc(id).delete();
  }

  async function ensureAuth(interactive=false){
    if(mode!=='firebase') return {user:null};
    if(user) return {user};
    if(!interactive) throw new Error('Auth required');
    // Try popup first; fallback to redirect on iOS / popup blocked
    const provider = new firebase.auth.GoogleAuthProvider();
    try{
      if(isIOS) throw new Error('ForceRedirectOnIOS');
      await auth.signInWithPopup(provider);
      user = auth.currentUser;
      return {user};
    }catch(err){
      console.warn('Popup sign-in failed or iOS; falling back to redirect', err?.code||err?.message||err);
      await auth.signInWithRedirect(provider);
      // After redirect: flow continues on page load; script.js will continue once postRedirectResolved
      return {user:null};
    }
  }

  async function signOut(){
    if(mode!=='firebase') return;
    await auth.signOut();
  }

  // Expose bridge
  window.AppDataLayer = {
    mode,
    db,
    user,
    postRedirectResolved,
    ensureAuth,
    signOut,
    listTrips,
    getTrip,
    upsertTrip,
    deleteTrip,
  };
})();