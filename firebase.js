// ==== Firebase bootstrap (compat) with iOS redirect & tap-gate ====
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

    window.db = firebase.firestore();
    window.auth = firebase.auth();
    window.googleProvider = new firebase.auth.GoogleAuthProvider();
    try{ window.googleProvider.setCustomParameters({ prompt: 'select_account' }); }catch(e){}

    window.isIOS = window.isIOS || function(){
      try{ var ua=navigator.userAgent||''; return /iPad|iPhone|iPod/.test(ua) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1); }catch(e){ return false; }
    };

    var FLAG='authRedirectPending';
    var persistence = (window.isIOS && window.isIOS()) ? firebase.auth.Auth.Persistence.SESSION : firebase.auth.Auth.Persistence.LOCAL;
    auth.setPersistence(persistence).catch(function(e){ console.warn('[auth] setPersistence failed', e&&e.code, e&&e.message); });

    auth.getRedirectResult().then(function(res){
      if (res && res.user){ console.log('[auth] redirect ok', res.user.uid); }
    }).catch(function(e){
      if (typeof logLine==='function') logLine('redirect error: '+(e && (e.code||e.message)||e),'auth');
    });

    // Public starter: must be called from the Google button (user gesture)
    window.startGoogleSignIn = function(){
      if (typeof window.__attemptSignIn==='function') window.__attemptSignIn();
    };

    window.__attemptSignIn = async function(){
      try{
        if (!window.auth || !window.googleProvider) return;
        if (auth.currentUser) return;

        if (window.isIOS && window.isIOS()){
          try{
            sessionStorage.setItem(FLAG,'1');
            await auth.signInWithRedirect(googleProvider);
          }catch(err){
            console.error('[auth] iOS sign-in failed', err && err.code, err && err.message);
          }
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
          }
        }
      }catch(e){
        if (typeof logLine==='function') logLine('__attemptSignIn fatal: '+(e && (e.code||e.message)||e),'auth');
      }
    };

    // DataLayer surface
    window.AppDataLayer = window.AppDataLayer || {};
    window.AppDataLayer.mode = 'firebase';
    window.AppDataLayer.db = window.db;
    window.AppDataLayer.ensureAuth = async function(){
      if (!auth.currentUser){ if (!(window.isIOS && window.isIOS())) await window.__attemptSignIn(); }
      return (auth.currentUser && auth.currentUser.uid) || null;
    };

    console.info('Firebase init complete');
  } catch(e){
    console.error('Firebase init error → local mode', e);
    window.AppDataLayer = { mode: 'local' };
  }
})();
