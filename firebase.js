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


// ===== Google Sign-In (desktop: popup, iOS: redirect) =====
(function(){
  try {
    // Guard for double inclusion
    if (typeof window === 'undefined') return;

    // Expose globals for button handlers
    window.auth = window.auth || auth;
    window.provider = window.provider || provider;

    // Helper: write to status line
    function setStatus(msg){
      try {
        var s = document.getElementById('statusLine');
        if (s) s.textContent = msg || '';
      } catch(e){}
    }

    // After redirect back from Google
    try {
      getRedirectResult(auth).then(function(result){
        if (result && result.user) {
          setStatus('מחובר: ' + (result.user.email || result.user.uid));
          document.body.classList.add('entered');
          document.body.classList.remove('splash-mode');
          var app = document.getElementById('app'); if (app) app.style.display = 'block';
          var splash = document.getElementById('splash'); if (splash) splash.style.display = 'none';
        }
      }).catch(function(e){
        console.error('getRedirectResult error', e);
        setStatus('שגיאה בהתחברות (redirect): ' + (e && e.message ? e.message : e));
      });
    } catch(e) {
      console.warn('getRedirectResult not available', e);
    }

    // React to auth state anyway
    onAuthStateChanged(auth, function(u){
      if (u) {
        setStatus('מחובר: ' + (u.email || u.uid));
        document.body.classList.add('entered');
        document.body.classList.remove('splash-mode');
        var app = document.getElementById('app'); if (app) app.style.display = 'block';
        var splash = document.getElementById('splash'); if (splash) splash.style.display = 'none';
      } else {
        setStatus('מצב: לא מחובר');
      }
    });

    // Unified sign-in entry
    window.startGoogleSignIn = function(){
      try {
        // iOS devices -> redirect
        var isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isiOS) {
          signInWithRedirect(auth, provider);
          return;
        }
        // Desktop/Android -> popup
        signInWithPopup(auth, provider).catch(function(e){
          console.error('Popup sign-in failed:', e);
          setStatus('שגיאה בהתחברות (popup): ' + (e && e.message ? e.message : e));
        });
      } catch(e){
        console.error('startGoogleSignIn error', e);
        setStatus('שגיאה בהתחברות: ' + (e && e.message ? e.message : e));
      }
    };

    // Expose sign-out to window if not already
    if (typeof window.signOutNow !== 'function') {
      window.signOutNow = function(){
        signOut(auth).catch(function(e){
          console.error('signOut error', e);
        });
      };
    }
  } catch(e){
    console.error('Sign-in bootstrap error', e);
  }
})();
// ===== end Google Sign-In block =====

