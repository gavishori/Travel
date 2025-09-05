
// ==== Firebase bootstrap (compat) — CLEAN SINGLE-FLOW ====
(function(){
  try {
    window.firebaseConfig = window.firebaseConfig || {
      apiKey: "AIzaSyArvkyWzgOmPjYYXUIOdilmtfrWt7WxK-0",
      authDomain: "travel-416ff.firebaseapp.com",
      projectId: "travel-416ff",
      storageBucket: "travel-416ff.appspot.com",
      messagingSenderId: "1075073511694",
      appId: "1:1075073511694:web:7876f492d18a702b09e75f",
      measurementId: "G-FT56H33X5J"
    };

    if (!firebase || !firebase.apps) throw new Error('Firebase SDK not loaded');
    if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);

    var db = firebase.firestore();
    var auth = firebase.auth();
    var provider = new firebase.auth.GoogleAuthProvider();
    try { provider.setCustomParameters({ prompt: 'select_account' }); } catch(e) {}

    // expose globals
    window.db = db;
    window.auth = auth;
    window.googleProvider = provider;

    // status helper
    function setStatus(msg){
      try{ var s=document.getElementById('statusLine'); if (s) s.textContent = msg||''; }catch(_){}
    }
    function enterUI(user){
      try{
        setStatus('מחובר: ' + (user.email || user.uid));
        document.body.classList.add('entered');
        document.body.classList.remove('splash-mode');
        var app=document.getElementById('app'); if (app) app.style.display='block';
        var splash=document.getElementById('splash'); if (splash) splash.style.display='none';
      }catch(_){}
    }

    // persistence (stabilize sessions)
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(e){
      console.warn('[auth] setPersistence failed', e && e.message);
    });

    // handle redirect result once (iOS path)
    auth.getRedirectResult().then(function(res){
      if (res && res.user) enterUI(res.user);
    }).catch(function(e){
      console.error('[auth] redirect error:', e && e.message);
      setStatus('שגיאה (redirect): ' + (e && e.message || e));
    });

    // observer: enter UI when signed-in
    auth.onAuthStateChanged(function(u){ if (u) enterUI(u); });

    // single-flight guard
    var inflight = false;

    // public entry — must be called by the button
    window.startGoogleSignIn = function(){
      if (inflight) return;
      inflight = true;
      var isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      var p;
      if (isiOS) {
        p = auth.signInWithRedirect(provider);
      } else {
        p = auth.signInWithPopup(provider);
      }
      p.catch(function(e){
        console.error('[auth] sign-in error:', e && e.message);
        setStatus('שגיאה בהתחברות: ' + (e && e.message || e));
      }).finally(function(){ inflight = false; });
    };

    // provide a no-op ensureAuth that does NOT auto-start sign-in
    window.AppDataLayer = window.AppDataLayer || {};
    window.AppDataLayer.mode = 'firebase';
    window.AppDataLayer.db = db;
    window.AppDataLayer.ensureAuth = async function(){
      return (auth.currentUser && auth.currentUser.uid) || null;
    };

    console.info('Firebase init (clean) ready');
  } catch(e){
    console.error('Firebase init error', e);
    window.AppDataLayer = { mode: 'local' };
  }
})();
