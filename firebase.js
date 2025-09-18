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

// === AUTH ERROR UI ===
function showAuthError(message){
  try{
    var id = "auth-error-banner";
    var el = document.getElementById(id);
    if (!el){
      el = document.createElement('div');
      el.id = id;
      el.style.cssText = "position:fixed;inset-inline:12px;bottom:12px;padding:10px 12px;border:1px solid #fecaca;background:#fee2e2;color:#7f1d1d;border-radius:10px;z-index:9999;font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;";
      document.body.appendChild(el);
    }
    el.textContent = message;
    setTimeout(()=>{ if (el && el.parentNode) el.parentNode.removeChild(el); }, 8000);
  }catch(e){ console.warn('showAuthError failed', e); }
}


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
  // extra handling for auth errors
  console.error('[auth] popup sign-in error:', err && err.code, err && err.message);
  if (code === 'auth/unauthorized-domain'){
    showAuthError('הדומיין לא מאושר בפיירבייס: ' + location.origin + ' — הוסף אותו ב-Firebase Console > Authentication > Settings > Authorized domains.');
    return;
  }
  if (code === 'auth/operation-not-supported-in-this-environment'){
    console.log('[auth] falling back to redirect (unsupported env)');
    await auth.signInWithRedirect(googleProvider);
    return;
  }
  // generic: try redirect as a fallback
  await auth.signInWithRedirect(googleProvider);
}

            console.error('[auth] sign-in failed', code, err && err.message);
            if(code==='auth/operation-not-allowed'){ console.warn('[auth] provider disabled → local mode'); window.AppDataLayer.mode='local'; }
          }
        }
      }catch(e){
        console.error('[auth] __attemptSignIn fatal: ', e);
        try{ if((e&&e.code)==='auth/operation-not-allowed'){ console.warn('[auth] provider disabled → switching to local mode'); window.AppDataLayer.mode='local'; } }catch(_){ }
      }
    };

    // DataLayer surface
    window.AppDataLayer = window.AppDataLayer || {}; /*__FALLBACK_LOCAL__*/
    window.AppDataLayer.mode = 'firebase';
    window.AppDataLayer.db = window.db;
    window.AppDataLayer.ensureAuth = async function(){
      if (!auth.currentUser){ if (!(window.isIOS&&window.isIOS())) await window.__attemptSignIn(); }
      return (auth.currentUser && auth.currentUser.uid) || null;
    };

    console.info('Firebase init complete');
    console.log('[auth] origin:', location.origin);
  } catch(e){
    console.error('Firebase init error → local mode', e);
    window.AppDataLayer = { mode: 'local' };
  }
})();
