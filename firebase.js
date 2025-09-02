// ==== Firebase bootstrap (compat) with iOS redirect & tap-gate ====
(function(){
  try {
    if (!window.firebaseConfig){
      window.firebaseConfig = {
        apiKey: "AIzaSyArvkyWzgOmPjYYXUIOdilmtfrWt7WxK-0",
        authDomain: "travel-416ff.firebaseapp.com",
        projectId: "travel-416ff",
        storageBucket: "travel-416ff.appspot.com",
        messagingSenderId: "1075073511694",
        appId: "1:1075073511694:web:7876f492d18a702b09e75f",
        measurementId: "G-FT56H33X5J"
      };
    }
    if (!firebase || !firebase.apps) throw new Error('Firebase SDK not loaded');
    if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);

    window.db = firebase.firestore();
    window.auth = firebase.auth();
    window.googleProvider = new firebase.auth.GoogleAuthProvider();

    window.isIOS = window.isIOS || function(){
      try{ var ua=navigator.userAgent||''; return /iPad|iPhone|iPod/.test(ua) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1); }catch(e){ return false; }
    };

    var FLAG='authRedirectPending', COUNT='AUTH_REDIRECT_COUNT', WINDOW_MS=60000, ALLOW='AUTH_ALLOW';
    var persistence = (window.isIOS&&window.isIOS()) ? firebase.auth.Auth.Persistence.SESSION : firebase.auth.Auth.Persistence.LOCAL;
    auth.setPersistence(persistence).catch(function(e){ console.warn('[auth] setPersistence failed', e&&e.code, e&&e.message); });

    auth.getRedirectResult().then(function(res){
      try{ sessionStorage.removeItem(ALLOW); sessionStorage.setItem(COUNT,'0'); }catch(e){}
      if (res && res.user){ console.log('[auth] redirect ok', res.user.uid); }
    }).catch(function(e){
      if (typeof logLine==='function') logLine('redirect error: '+(e && (e.code||e.message)||e),'auth');
    });

    window.startGoogleSignIn = function(){
      try{ sessionStorage.setItem(ALLOW,'1'); }catch(e){}
      if (typeof window.__attemptSignIn==='function') window.__attemptSignIn();
    };

    window.__attemptSignIn = async function(){
      try{
        if (!window.auth || !window.googleProvider) return;
        if (auth.currentUser) return;

        if (window.isIOS && window.isIOS()){
          try{
            if (!sessionStorage.getItem(ALLOW)){
              if (typeof logLine==='function') logLine('blocked: iOS requires user tap on Google button','auth');
              return;
            }
            var n=parseInt(sessionStorage.getItem(COUNT)||'0',10);
            var t0=parseInt(sessionStorage.getItem(COUNT+'_ts')||'0',10);
            var now=Date.now();
            if (!t0 || now-t0>WINDOW_MS){ n=0; sessionStorage.setItem(COUNT+'_ts', String(now)); }
            if (n>=1){ if (typeof logLine==='function') logLine('stopped: iOS redirect loop guard','auth'); return; }
            sessionStorage.setItem(COUNT, String(n+1));
          }catch(e){}
          sessionStorage.setItem(FLAG,'1');
          await auth.signInWithRedirect(googleProvider);
          return;
        }

        try{
          await auth.signInWithPopup(googleProvider);
        }catch(err){
          var code=(err && err.code) || '';
          var fallback=(['auth/popup-blocked','auth/popup-closed-by-user','auth/cancelled-popup-request','auth/operation-not-supported-in-this-environment'].indexOf(code)!==-1);
          if (fallback){
            sessionStorage.setItem(FLAG,'1');
            await auth.signInWithRedirect(googleProvider);
          } else {
            console.error('[auth] sign-in failed', code, err && err.message);
            if (typeof logLine==='function') logLine('sign-in failed: '+code+' '+(err && err.message || ''),'auth');
          }
        }
      }catch(e){
        if (typeof logLine==='function') logLine('__attemptSignIn fatal: '+(e && (e.code||e.message)||e),'auth');
      }
    };

    // Minimal DataLayer expected by the app
    window.AppDataLayer = window.AppDataLayer || {};
    window.AppDataLayer.db = window.db;
    window.AppDataLayer.mode = 'firebase';
    window.AppDataLayer.ensureAuth = async function(){
      if (!auth.currentUser){ await window.__attemptSignIn(); }
      return (auth.currentUser && auth.currentUser.uid) || null;
    };

    console.info('Firebase init complete');
  } catch(e){
    console.error('Firebase init error → local mode', e);
    window.AppDataLayer = { mode: 'local' };
  }
})();
