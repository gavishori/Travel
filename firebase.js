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

    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(e){
      console.warn('[auth] setPersistence failed', e && e.code, e && e.message);
    });

    // Disable OAuth entry points
    window.startGoogleSignIn = function(){ alert('כניסה רק באמצעות אימייל וסיסמה.'); };

    window.AppDataLayer = window.AppDataLayer || { mode:'firebase', db: db };
    window.AppDataLayer.ensureAuth = async function(){
      return (auth.currentUser && auth.currentUser.uid) || null;
    };

    console.info('Firebase init complete (email-only)');
  } catch(e){
    console.error('Firebase init error → local mode', e);
    window.AppDataLayer = { mode: 'local' };
  }
})();
