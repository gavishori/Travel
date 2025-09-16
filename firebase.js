// ==== Firebase bootstrap (compat) – email/password only ====
(function(){
  try {
    // Firebase config must be defined by index.html before this file
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

    // Globals
    window.db = firebase.firestore();
    window.auth = firebase.auth();

    // iOS session persistence (popups unreliable) / others local
    window.isIOS = window.isIOS || function(){
      try{ var ua=navigator.userAgent||''; return /iPad|iPhone|iPod/.test(ua) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1); }catch(e){ return false; }
    };
    var persistence = (window.isIOS&&window.isIOS()) ? firebase.auth.Auth.Persistence.SESSION : firebase.auth.Auth.Persistence.LOCAL;
    auth.setPersistence(persistence).catch(function(e){ console.warn('[auth] setPersistence failed', e&&e.code, e&&e.message); });

    // Minimal DataLayer used by app
    window.AppDataLayer = window.AppDataLayer || {};
    window.AppDataLayer.mode = 'firebase';
    window.AppDataLayer.db = window.db;
    window.AppDataLayer.ensureAuth = async function(){
      return (auth.currentUser && auth.currentUser.uid) || null;
    };

    // Helpers for email/password
    window.showEmailDialog = function(){
      var dlg = document.getElementById('emailAuthDialog');
      if (dlg && typeof dlg.showModal === 'function') dlg.showModal();
    };
    window.emailSignIn = async function(email, password){
      try{
        await auth.signInWithEmailAndPassword(String(email||'').trim(), String(password||''));
        return true;
      }catch(e){
        if (e && e.code === 'auth/operation-not-allowed'){
          alert('בפרויקט Firebase שלך לא הופעל ספק אימות בדוא״ל/סיסמה. פתח את Firebase Console > Authentication > Sign-in method והפעל Email/Password.');
        } else {
          alert(e && e.message ? e.message : 'Sign-in failed');
        }
        return false;
      }
    };
    window.emailSignUp = async function(email, password){
      try{
        await auth.createUserWithEmailAndPassword(String(email||'').trim(), String(password||''));
        return true;
      }catch(e){
        if (e && e.code === 'auth/operation-not-allowed'){
          alert('Email/Password לא מופעל בפרויקט Firebase.');
        } else {
          alert(e && e.message ? e.message : 'Sign-up failed');
        }
        return false;
      }
    };
    window.handleSignOut = async function(){
      try{ await auth.signOut(); }catch(e){ console.error(e); alert('התנתקות נכשלה'); }
    };

    console.info('Firebase init complete');
  } catch(e){
    console.error('Firebase init error → local mode', e);
    window.AppDataLayer = { mode: 'local' };
  }
})();