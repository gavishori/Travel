// ==== Firebase bootstrap (compat) – email/password only ====
(function(){
  try{
    if (!window.firebaseConfig) throw new Error('Missing firebaseConfig');
    if (typeof firebase === 'undefined') throw new Error('Firebase SDK not loaded');

    // Initialize only once
    if (!firebase.apps.length) { firebase.initializeApp(window.firebaseConfig); }

    // Expose services
    window.db = firebase.firestore();
    window.auth = firebase.auth();

    // Persistence (LOCAL by default)
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .catch(function(e){ console.warn('[auth] setPersistence failed:', e && e.message); });

    // Email helpers
    window.emailAuth = window.emailAuth || {};
    window.emailAuth.signIn = function(email, password){ return auth.signInWithEmailAndPassword(email, password); };
    window.emailAuth.signUp = function(email, password){ return auth.createUserWithEmailAndPassword(email, password); };
    window.emailAuth.reset  = function(email){ return auth.sendPasswordResetEmail(email); };

    // AppDataLayer shims
    window.AppDataLayer = window.AppDataLayer || {};
    window.AppDataLayer.mode = 'firebase';
    window.AppDataLayer.db = window.db;
    window.AppDataLayer.ensureAuth = async function(){ return (auth.currentUser && auth.currentUser.uid) || null; };

    console.info('Firebase init complete');
  }catch(e){
    console.error('Firebase init error → local mode', e);
    window.AppDataLayer = { mode: 'local' };
  }
})();