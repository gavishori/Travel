

// --- Mobile-safe sign-in helper (popup -> redirect fallback) ---
(function(){
  // handle pending redirect results early
  try {
    auth.getRedirectResult().then(function(result){
      if (result && result.user) {
        console.log('[auth] redirect result ok:', result.user.uid);
      }
    }).catch(function(err){
      console.warn('[auth] redirect error', err && err.code, err && err.message);
    });
  } catch(e){ console.warn('[auth] redirect init failed', e); }

  // expose a global helper that prefers redirect on iOS, and falls back to redirect on popup failures
  window.__attemptSignIn = async function(){
    var isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
    try{
      if (isiOS) {
        // On iOS Safari, popups are flaky – go straight to redirect.
        await auth.signInWithRedirect(googleProvider);
        return;
      }
      await auth.signInWithPopup(googleProvider);
    }catch(err){
      var code = err && err.code || '';
      var fallback = ['auth/popup-blocked','auth/popup-closed-by-user','auth/cancelled-popup-request','auth/operation-not-supported-in-this-environment'].indexOf(code) !== -1;
      if (fallback){
        try {
          await auth.signInWithRedirect(googleProvider);
          return;
        } catch(e2){
          console.error('[auth] redirect failed after popup', e2);
          if (typeof logLine === 'function') logLine('error '+(e2.code||'')+' '+(e2.message||''), 'auth');
          return;
        }
      }
      console.error('[auth] sign-in failed', code, err && err.message);
      if (typeof logLine === 'function') logLine('error '+(code)+' '+(err && err.message || ''), 'auth');
    }
  };
})();

// firebase.js (updated with user's config + anonymous auth)
window.firebaseConfig = {
  apiKey: "AIzaSyArvkyWzgOmPjYYXUIOdilmtfrWt7WxK-0",
  authDomain: "travel-416ff.firebaseapp.com",
  projectId: "travel-416ff",
  storageBucket: "travel-416ff.appspot.com",
  messagingSenderId: "1075073511694",
  appId: "1:1075073511694:web:7876f492d18a702b09e75f",
  measurementId: "G-FT56H33X5J"
};

(function(){
  const hasConfig = window.firebaseConfig && window.firebaseConfig.apiKey;
  if (!hasConfig){
    console.info("Firebase config missing → running in local mode (localStorage).");
    window.AppDataLayer = { mode: "local" };
    return;
  }

  try{
    const app = firebase.initializeApp(window.firebaseConfig);
    const db = firebase.firestore();

    // Anonymous auth (keeps per-user isolation with rules)
    // Uses v10 compat: firebase.auth() is available if auth-compat is loaded; we'll lazy load.
    const ensureAuth = async () => {
      if (!firebase.auth){ 
        await new Promise((res,rej)=>{
          const s = document.createElement("script");
          s.src = "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js";
          s.onload = res; s.onerror = rej; document.head.appendChild(s);
        });
      }
    };

    window.AppDataLayer = { mode: "firebase", db, ensureAuth };
    console.info("Firebase initialized.");
  }catch(err){
    console.error("Firebase init error → fallback to local mode", err);
    window.AppDataLayer = { mode: "local" };
  }
})();


// --- Ensure Firebase Auth + Provider are global ---
window.auth = firebase.auth();
window.googleProvider = new firebase.auth.GoogleAuthProvider();
