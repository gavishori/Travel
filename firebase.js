// firebase.js — Google-only auth (no anonymous)
// Uses Firebase compat SDK already included from index.html

// --- Project config (as provided) ---
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
  const hasConfig = !!(window.firebaseConfig && window.firebaseConfig.apiKey);
  if (!hasConfig){
    console.info("Firebase config missing → local mode");
    window.AppDataLayer = { mode: "local" };
    return;
  }

  try{
    const app = firebase.initializeApp(window.firebaseConfig);
    const db  = firebase.firestore();

    // Lazy-load auth compat and expose globals used by script.js
    async function loadAuth(){
      if (!firebase.auth){
        await new Promise((res, rej)=>{
          const s = document.createElement("script");
          s.src   = "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js";
          s.onload = res; s.onerror = rej; document.head.appendChild(s);
        });
      }
      if (!window.auth) {
        window.auth = firebase.auth();
        window.googleProvider = new firebase.auth.GoogleAuthProvider();
      }
    }

    // Keep API shape the app expects, but do NOT auto sign-in
    async function ensureAuth(){ await loadAuth(); /* no anonymous sign-in */ }

    window.AppDataLayer = { mode: "firebase", db, ensureAuth };
    // Eagerly load auth so listeners can bind
    loadAuth().catch(console.error);
    console.info("Firebase initialized.");
  }catch(err){
    console.error("Firebase init error → local mode fallback", err);
    window.AppDataLayer = { mode: "local" };
  }
})();
