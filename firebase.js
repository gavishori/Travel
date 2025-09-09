// ==== Firebase bootstrap (compat) — EMAIL+PASSWORD ONLY ====
// IMPORTANT: החלף את ה-config כאן לשלך. אין Google provider. אין popup/redirect.
(function(){
  try {
    window.firebaseConfig = window.firebaseConfig || {
      apiKey: "REPLACE_ME",
      authDomain: "REPLACE_ME.firebaseapp.com",
      projectId: "REPLACE_ME",
      storageBucket: "REPLACE_ME.appspot.com",
      messagingSenderId: "REPLACE_ME",
      appId: "REPLACE_ME"
    };
    if (!firebase || !firebase.apps) throw new Error('Firebase SDK not loaded');
    if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);

    var db = firebase.firestore();
    var auth = firebase.auth();

    // Email auth helpers
    async function emailSignIn(email, password){ return auth.signInWithEmailAndPassword(email, password); }
    async function emailRegister(email, password){ return auth.createUserWithEmailAndPassword(email, password); }
    async function emailSignOut(){ return auth.signOut(); }

    // Public surface
    window.AppDataLayer = window.AppDataLayer || {};
    window.AppDataLayer.mode = 'firebase';
    window.AppDataLayer.db = db;
    window.AppDataLayer.emailAuth = { signIn: emailSignIn, register: emailRegister, signOut: emailSignOut };
    window.AppDataLayer.ensureAuth = async function(){ return (auth.currentUser && auth.currentUser.uid) || null; };
    window.AppDataLayer._auth = auth; // exposed for onAuthStateChanged in app

    console.info('Firebase init complete (email/password only)');
  } catch(e){
    console.error('Firebase init error → local mode', e);
    window.AppDataLayer = { mode: 'local' };
  }
})();