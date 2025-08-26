// firebase.js (production, compat)
(function(){
  if (!window.firebase) {
    console.error("Firebase SDK not loaded");
    window.AppDataLayer = { mode: "local" };
    return;
  }
  // Respect existing config if provided in index.html
  var cfg = window.firebaseConfig || null;
  if (!cfg || !cfg.apiKey){
    console.info("No Firebase config → local mode");
    window.AppDataLayer = { mode: "local" };
    return;
  }
  try{
    var app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
    var db  = firebase.firestore();
    window.AppDataLayer = {
      mode: "firebase",
      db: db,
      ensureAuth: async function(){
        if (!firebase.auth){ 
          await new Promise(function(res,rej){
            var s = document.createElement("script");
            s.src = "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js";
            s.onload = res; s.onerror = rej; document.head.appendChild(s);
          });
        }
      }
    };
    // Export globals for script.js
    window.auth = firebase.auth();
    window.googleProvider = new firebase.auth.GoogleAuthProvider();
    console.info("Firebase initialized.");
  }catch(err){
    console.error("Firebase init error → local mode", err);
    window.AppDataLayer = { mode: "local" };
  }
})();
