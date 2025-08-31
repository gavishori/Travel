// firebase.js (final - 4 files package)
(function(){
  const cfg = {
    apiKey: "AIzaSyArvkylwZg0mPjYYXUIOdilmfrWt7Wkx-0",
    authDomain: "travel-416ff.firebaseapp.com",
    projectId: "travel-416ff",
    storageBucket: "travel-416ff.appspot.com",
    messagingSenderId: "1075073511694",
    appId: "1:1075073511694:web:7876f492d18a702b09e75f",
    measurementId: "G-FT56H33X5J"
  };
  const log = (...a)=>{ try{ (window._dbg||console.log)(...a);}catch(e){ console.log(...a);} };

  // Init Firebase
  const app = firebase.apps?.length ? firebase.app() : firebase.initializeApp(cfg);
  const auth = firebase.auth();
  const db   = firebase.firestore?.() || null;

  // Detect iOS/Safari -> redirect
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const useRedirect = isIOS || isSafari;

  const provider = new firebase.auth.GoogleAuthProvider();

  // Handle redirect result exactly once
  async function handleRedirectOnce(){
    if (!sessionStorage.getItem("pendingRedirect")) return;
    try {
      const res = await auth.getRedirectResult();
      sessionStorage.removeItem("pendingRedirect");
      if (res && res.user) {
        log("[auth] redirect result ->", res.user.uid);
      }
    } catch(err){
      sessionStorage.removeItem("pendingRedirect");
      log("[auth] redirect error:", err.message);
    }
  }

  // Expose login function for button
  window.startGoogleLogin = async function startGoogleLogin(){
    try{
      if (useRedirect) {
        log("[auth] using redirect (iOS/Safari)");
        sessionStorage.setItem("pendingRedirect","1");
        await auth.signInWithRedirect(provider);
      } else {
        log("[auth] using popup");
        await auth.signInWithPopup(provider);
      }
    }catch(err){
      log("[auth] sign-in error:", err.code || "", err.message || err);
    }
  };

  auth.onAuthStateChanged(u => {
    if (u) {
      log("[auth] state: signed-in", "uid="+u.uid);
    } else {
      log("[auth] state: signed-out");
      handleRedirectOnce(); // check if this load is a post-redirect
    }
  });

  log("Firebase initialized.");
})();