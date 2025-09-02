// Clean Firebase bootstrap for web + iOS redirect (compat SDK)

// Project config
window.firebaseConfig = {
  apiKey: "AIzaSyArvkyWzgOmPjYYXUIOdilmtfrWt7WxK-0",
  authDomain: "travel-416ff.firebaseapp.com",
  projectId: "travel-416ff",
  storageBucket: "travel-416ff.appspot.com",
  messagingSenderId: "1075073511694",
  appId: "1:1075073511694:web:7876f492d18a702b09e75f",
  measurementId: "G-FT56H33X5J"
};

// Global iOS helper (available for all IIFEs)
(function(){
  window.isIOS = function(){
    try{
      var ua = navigator.userAgent || "";
      var iOSUA = /iPad|iPhone|iPod/.test(ua);
      var iPadOS = (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      return !!(iOSUA || iPadOS);
    }catch(e){ return false; }
  };
})();

// Init Firebase app / services
(function(){
  try{
    if (!window.firebase || !window.firebase.apps) throw new Error("Firebase SDK not loaded");
    if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);
    window.db = firebase.firestore();
    window.auth = firebase.auth();
    window.googleProvider = new firebase.auth.GoogleAuthProvider();

    // Persistence: SESSION on iOS to avoid ITP issues, LOCAL elsewhere
    var persistence = window.isIOS() ? firebase.auth.Auth.Persistence.SESSION
                                     : firebase.auth.Auth.Persistence.LOCAL;
    auth.setPersistence(persistence).catch(function(e){
      console.warn("[auth] setPersistence failed:", e && e.code, e && e.message);
    });

    // Handle redirect result (clear pending flag)
    var FLAG = "authRedirectPending";
    var COUNT = "AUTH_REDIRECT_COUNT";
    var WINDOW_MS = 60000;
    auth.getRedirectResult().then(function(res){
      try{ sessionStorage.setItem(COUNT, "0"); }catch(e){}
      sessionStorage.removeItem(FLAG);
      if (res && res.user){ console.log("[auth] redirect ok:", res.user.uid); }
    }).catch(function(e){
      sessionStorage.removeItem(FLAG);
      console.warn("[auth] redirect result err:", e && e.code, e && e.message); if (typeof logLine==="function") logLine("redirect error: "+(e && (e.code||e.message)||e), "auth");
    });

    // Public helper used by app
    window.__attemptSignIn = async function(){
      if (!window.auth || !window.googleProvider) return;
      if (auth.currentUser) return;

      if (window.isIOS()){
        try{
          var n = parseInt(sessionStorage.getItem(COUNT)||"0",10);
          var t0 = parseInt(sessionStorage.getItem(COUNT+"_ts")||"0",10);
          var now = Date.now();
          if (!t0 || now - t0 > WINDOW_MS){ n = 0; sessionStorage.setItem(COUNT+"_ts", String(now)); }
          if (n >= 1){ if (typeof logLine==="function") logLine("stopped: iOS redirect loop guard", "auth"); return; }
          sessionStorage.setItem(COUNT, String(n+1));
        }catch(e){}

        sessionStorage.setItem(FLAG, "1");
        await auth.signInWithRedirect(googleProvider);
        return;
      }
      try{
        await auth.signInWithPopup(googleProvider);
      }catch(err){
        var code = (err && err.code) || "";
        var fallback = [
          "auth/popup-blocked",
          "auth/popup-closed-by-user",
          "auth/cancelled-popup-request",
          "auth/operation-not-supported-in-this-environment"
        ].indexOf(code) !== -1;
        if (fallback){
          sessionStorage.setItem(FLAG, "1");
          await auth.signInWithRedirect(googleProvider);
        } else {
          console.error("[auth] sign-in failed", code, err && err.message);
        }
      }
    };

    // Minimal DataLayer surface expected by script.js
    window.AppDataLayer = window.AppDataLayer || {};
    window.AppDataLayer.mode = "firebase";
    window.AppDataLayer.ensureAuth = async function(){
      if (!auth.currentUser){ await window.__attemptSignIn(); }
      return (auth.currentUser && auth.currentUser.uid) || null;
    };

    console.info("Firebase init complete.");
  }catch(e){
    console.error("Firebase init error → fallback to local mode", e);
    window.AppDataLayer = { mode: "local" };
  }
})();
