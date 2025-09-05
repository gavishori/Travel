// ==== Firebase bootstrap (compat) with iOS redirect & tap-gate ====
(function(){
  try {
    // Firebase config must be defined
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

    window.db = firebase.firestore();
    window.auth = firebase.auth();
    window.googleProvider = new firebase.auth.GoogleAuthProvider();
    try{ window.googleProvider.setCustomParameters({ prompt: 'select_account' }); }catch(e){}

    // A utility function to detect if the user is on an iOS device.
    window.isIOS = window.isIOS || function(){
      try{ var ua=navigator.userAgent||''; return /iPad|iPhone|iPod/.test(ua) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1); }catch(e){ return false; }
    };

    // Use session persistence for iOS and local persistence for other platforms.
    var persistence = (window.isIOS&&window.isIOS()) ? firebase.auth.Auth.Persistence.SESSION : firebase.auth.Auth.Persistence.LOCAL;
    auth.setPersistence(persistence).catch(function(e){ console.warn('[auth] setPersistence failed', e&&e.code, e&&e.message); });

    // Check for a redirect result after sign-in.
    auth.getRedirectResult().then(function(res){
      if (res && res.user){ 
        console.log('[auth] redirect ok', res.user.uid); 
      }
    }).catch(function(e){
      console.error('[auth] redirect error: ', e);
    });

    // Public starter: must be called from the Google button (user gesture)
    window.startGoogleSignIn = function(){
        window.__attemptSignIn();
    };

    // The core sign-in logic
    window.__attemptSignIn = async function(){
      try{
        if (!window.auth || !window.googleProvider) return;
        if (auth.currentUser) return;

        // On iOS, force a redirect sign-in to bypass pop-up issues.
        // The popup is often blocked on mobile browsers.
        if (window.isIOS && window.isIOS()){
          console.log('[auth] iOS detected, attempting signInWithRedirect');
          await auth.signInWithRedirect(googleProvider);
          return;
        }

        // On other platforms, first try sign-in with a pop-up.
        try{
          await auth.signInWithPopup(googleProvider);
        }catch(err){
          var code=(err && err.code) || '';
          // If the pop-up fails for known reasons (e.g., blocked), fall back to a redirect.
          var fallback=(['auth/popup-blocked','auth/popup-closed-by-user','auth/cancelled-popup-request','auth/operation-not-supported-in-this-environment'].indexOf(code)!==-1);
          if (fallback){
            console.log('[auth] Pop-up blocked or cancelled, falling back to redirect');
            await auth.signInWithRedirect(googleProvider);
          } else {
            console.error('[auth] sign-in failed', code, err && err.message);
          }
        }
      }catch(e){
        console.error('[auth] __attemptSignIn fatal: ', e);
      }
    };

    // DataLayer surface
    window.AppDataLayer = window.AppDataLayer || {};
    window.AppDataLayer.mode = 'firebase';
    window.AppDataLayer.db = window.db;
    window.AppDataLayer.ensureAuth = async function(){
      if (!auth.currentUser){ if (!(window.isIOS&&window.isIOS())) await window.__attemptSignIn(); }
      return (auth.currentUser && auth.currentUser.uid) || null;
    };

    console.info('Firebase init complete');
  } catch(e){
    console.error('Firebase init error → local mode', e);
    window.AppDataLayer = { mode: 'local' };
  }
})();


// --- iOS direct redirect logging (minimal) ---
(function(){
  if (typeof window === 'undefined' || !window.auth) return;
  function setStatus(m){ try{var s=document.getElementById('statusLine'); if(s) s.textContent=m||'';}catch(_){} }
  var isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  // Ensure choose of SESSION persistence on iOS
  try {
    if (isiOS && auth.setPersistence) {
      auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(function(e){});
    }
  } catch(_){}

  // Early redirect result handling
  try {
    auth.getRedirectResult().then(function(res){
      if (res && res.user) {
        setStatus('מחובר: ' + (res.user.email || res.user.uid));
        document.body.classList.add('entered');
        document.body.classList.remove('splash-mode');
        var app=document.getElementById('app'); if(app) app.style.display='block';
        var splash=document.getElementById('splash'); if(splash) splash.style.display='none';
      }
    }).catch(function(e){
      setStatus('שגיאה (redirect): ' + (e && e.message ? e.message : e));
      console.error('redirect result error', e);
    });
  } catch(_){}

  // Force inline start handler to be present
  window.startGoogleSignIn = function(){
    try{
      if (isiOS) {
        setStatus('מתחיל התחברות (iOS redirect)...');
        return auth.signInWithRedirect(googleProvider);
      } else {
        setStatus('מתחיל התחברות (popup)...');
        return auth.signInWithPopup(googleProvider).catch(function(e){
          setStatus('שגיאה (popup): ' + (e && e.message ? e.message : e));
        });
      }
    }catch(e){
      setStatus('שגיאה בהתחברות: ' + (e && e.message ? e.message : e));
    }
  };
})();
// --- end iOS direct redirect logging ---


// ===== iOS Diagnostics Box =====
(function(){
  var isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  var box, logEl;
  function ensureBox(){
    if (!isiOS) return;
    try {
      box = box || document.getElementById('iosErrorBox');
      logEl = logEl || document.getElementById('iosLog');
      if (box) box.style.display = 'block';
    } catch(_) {}
  }
  function log(msg){
    try {
      ensureBox();
      if (!logEl) return;
      var t = new Date().toISOString().replace('T',' ').replace('Z','');
      logEl.textContent += "[" + t + "] " + msg + "\\n";
    } catch(_) {}
  }
  // Expose minimal global for quick logging
  window.__iosDiagLog = log;

  // Basic environment diagnostics
  try {
    if (isiOS) {
      var ssOK = false, lsOK = false, idbOK = false;
      try { sessionStorage.setItem('__t','1'); ssOK = (sessionStorage.getItem('__t')==='1'); sessionStorage.removeItem('__t'); } catch(e){}
      try { localStorage.setItem('__t','1'); lsOK = (localStorage.getItem('__t')==='1'); localStorage.removeItem('__t'); } catch(e){}
      try {
        var req = indexedDB && indexedDB.open ? indexedDB.open('diag_db',1) : null;
        if (req) { req.onupgradeneeded = function(){}; req.onsuccess = function(){ idbOK=true; if (req.result) req.result.close(); log("IndexedDB: OK"); }; req.onerror=function(){ log("IndexedDB error: " + (req.error && req.error.message)); }; }
      } catch(e){}
      ensureBox();
      log("UA: " + navigator.userAgent);
      log("sessionStorage: " + (ssOK ? "OK" : "BLOCKED"));
      log("localStorage: " + (lsOK ? "OK" : "BLOCKED"));
    }
  } catch(_) {}

  // Catch global errors
  window.addEventListener('error', function(e){
    log("window.error: " + (e && (e.message || e.type)));
  });
  window.addEventListener('unhandledrejection', function(e){
    var m = (e && e.reason && (e.reason.message || e.reason)) || e;
    log("unhandledrejection: " + m);
  });

  // Hook Firebase auth points if available (compat or modular)
  function enterUI(user){
    try {
      document.body.classList.add('entered');
      document.body.classList.remove('splash-mode');
      var app = document.getElementById('app'); if (app) app.style.display='block';
      var splash = document.getElementById('splash'); if (splash) splash.style.display='none';
    } catch(_){}
  }

  setTimeout(function(){
    try {
      // compat API
      if (window.firebase && firebase.auth && typeof firebase.auth === 'function') {
        var _auth = window.auth || firebase.auth();
        _auth.getRedirectResult().then(function(res){
          if (res && res.user) { log("redirect result OK: " + (res.user.email || res.user.uid)); enterUI(res.user); }
        }).catch(function(e){ log("redirect result error: " + (e && e.message ? e.message : e)); });
        _auth.onAuthStateChanged(function(u){ if (u) log("onAuthStateChanged: " + (u.email || u.uid)); });
        // wrap start function if exists
        var prov = window.googleProvider || new firebase.auth.GoogleAuthProvider();
        window.startGoogleSignIn = function(){
          try {
            if (isiOS) { log("start redirect…"); return _auth.signInWithRedirect(prov); }
            else { log("start popup…"); return _auth.signInWithPopup(prov).catch(function(e){ log("popup error: " + (e && e.message ? e.message : e)); }); }
          } catch(e){ log("start error: " + (e && e.message ? e.message : e)); }
        };
      }
      // modular API fallback (no-op if not used here)
    } catch(e){ log("diag init error: " + e.message); }
  }, 0);
})();
// ===== end iOS Diagnostics Box =====
