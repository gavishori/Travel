// --- Firebase bootstrap (compat) ---

// 1) Guard: ensure config exists on window
(function() {
  if (!window || !window.firebaseConfig) {
    console.error("[firebase.js] Missing window.firebaseConfig");
    return;
  }
  try {
    // 2) Initialize default app (compat namespace expected to be loaded via script tags)
    if (firebase && typeof firebase.initializeApp === "function") {
      firebase.initializeApp(window.firebaseConfig);
      console.log("[firebase.js] Firebase initialized");
    } else {
      console.error("[firebase.js] Firebase SDK (compat) not loaded before firebase.js");
      return;
    }

    // 3) Auth + Providers
    window.firebaseAuth = firebase.auth();
    window.googleProvider = new firebase.auth.GoogleAuthProvider(); // correct provider

    // Optional: persist auth state in local storage (web)
    if (window.firebaseAuth && window.firebaseAuth.setPersistence) {
      window.firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(err){
        console.warn("[firebase.js] setPersistence warning:", err && err.message);
      });
    }
  } catch (err) {
    console.error("[firebase.js] init error:", err && err.message);
  }
})();
