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
// Handle redirect result if present (for iOS / PWA)
  try {
    if (typeof auth !== 'undefined' && auth && typeof auth.getRedirectResult === 'function') {
      var pending = false;
      try { pending = sessionStorage.getItem('pendingRedirect') === '1'; } catch (_){}
      if (pending) {
        auth.getRedirectResult().finally(function(){ try{ sessionStorage.removeItem('pendingRedirect'); }catch(_){}});
      }
    }
  } catch (e) { console.warn('[auth] redirect result processing skipped:', e && e.message || e); }
