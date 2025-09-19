// ==== Firebase bootstrap (compat) – clean reset ====(function(){  try {    
  window.firebaseConfig = window.firebaseConfig || {
    apiKey: "AIzaSyArvkyWzgOmPjYYXUIOdilmtfrWt7WxK-0",
    authDomain: "travel-416ff.firebaseapp.com",
    projectId: "travel-416ff",
    storageBucket: "travel-416ff.appspot.com",
    messagingSenderId: "1075073511694",
    appId: "1:1075073511694:web:7876f492d18a702b09e75f",
    measurementId: "G-FT56H33X5J"
  };
    if (!window.firebase || !firebase.apps) throw new Error('Firebase SDK not loaded');    if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);
    // Auth & DB (compat)
    var auth = firebase.auth();
    var db   = (firebase.firestore ? firebase.firestore() : null);
    var googleProvider = new firebase.auth.GoogleAuthProvider() // fixed ? new firebase.auth.GoogleProvider() : new firebase.auth.GoogleAuthProvider();
    try { googleProvider.setCustomParameters({ prompt: 'select_account' }); } catch(_){}

    // expose
    window.auth = auth;
    window.db = db;
    window.googleProvider = googleProvider;

    function showAuthError(message){
      try{ 
        var id='auth-error-banner';
        var el=document.getElementById(id);
        if(!el){ el=document.createElement('div'); el.id=id; el.style.cssText='position:fixed;inset-inline:12px;bottom:12px;padding:10px 12px;border:1px solid #fecaca;background:#fee2e2;color:#7f1d1d;border-radius:10px;z-index:9999;font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;'; document.body.appendChild(el);}
        el.textContent=message;
        setTimeout(function(){ if(el&&el.parentNode) el.parentNode.removeChild(el); }, 8000);
      }catch(e){ console.warn('showAuthError failed', e); }
    }
    window.showAuthError = showAuthError;

    window.__attemptSignIn = async function(){
      try {
        await auth.signInWithPopup(googleProvider);
      } catch(err) {
        var code = err && err.code;
        console.warn('[auth] popup sign-in error:', code, err && err.message);
        if (code === 'auth/unauthorized-domain') {
          showAuthError('הדומיין לא מאושר בפיירבייס: ' + location.origin + ' — הוסף אותו ב-Firebase Console > Authentication > Settings > Authorized domains.');
          return;
        }
        if (code === 'auth/operation-not-supported-in-this-environment') {
          await auth.signInWithRedirect(googleProvider);
          return;
        }
        await auth.signInWithRedirect(googleProvider);
      }
    };

    window.startGoogleSignIn = function(){ window.__attemptSignIn(); };

    console.info('Firebase init complete');
  } catch(e) {
    console.error('Firebase init error', e);
  }
})();
