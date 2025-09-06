// ==== Firebase bootstrap (compat) — EMAIL/PASSWORD ONLY ====
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

    var auth = firebase.auth();
    var db   = firebase.firestore();
    window.auth = auth;
    window.db   = db;

    // Email/password only: no OAuth providers, no redirect/popup, no getRedirectResult
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(e){
      console.warn('[auth] setPersistence failed', e && e.code, e && e.message);
    });

    // Public no-op: keep backward-compat if someone calls it from HTML
    // but DO NOT start any OAuth flow.
    window.startGoogleSignIn = function(){
      if (typeof window.startEmailDialog === 'function') return window.startEmailDialog();
      if (typeof window.__attemptSignIn === 'function')  return window.__attemptSignIn();
      alert('הכניסה נעשית רק באמצעות אימייל וסיסמה.');
    };

    // Expose a minimal data layer the rest of the app uses
    window.AppDataLayer = window.AppDataLayer || {};
    window.AppDataLayer.mode = 'firebase';
    window.AppDataLayer.db = db;
    window.AppDataLayer.ensureAuth = async function(){
      // Do NOT auto-open dialogs here; just report if there is a user.
      return (auth.currentUser && auth.currentUser.uid) || null;
    };

    console.info('Firebase init complete (email-only)');
  } catch(e){
    console.error('Firebase init error → local mode', e);
    window.AppDataLayer = { mode: 'local' };
  }
})();
