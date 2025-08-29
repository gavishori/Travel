/* auth_patch.js — stabilize Google sign-in on mobile */
(function(){
  if (!window.firebaseAuth) { 
    console.warn("[auth_patch] firebaseAuth missing at load time"); 
    return; 
  }
  const auth = window.firebaseAuth;

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isInApp = /(FBAN|FBAV|Instagram|Line|Twitter|LinkedIn|WhatsApp|MiuiBrowser)/i.test(navigator.userAgent);

  try { auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch(e) {}

  auth.getRedirectResult?.().then(function(res){
    if (res && res.user) {
      console.log("[auth_patch] redirect result resolved");
    }
  }).catch(function(e){ console.warn("[auth_patch] getRedirectResult error", e); });

  const originalPopup = auth.signInWithPopup ? auth.signInWithPopup.bind(auth) : null;

  auth.signInWithPopup = async function(provider){
    if (isIOS || isInApp) {
      console.log("[auth_patch] iOS/In-App → using redirect");
      return auth.signInWithRedirect(provider);
    }
    if (!originalPopup) return auth.signInWithRedirect(provider);
    try {
      return await originalPopup(provider);
    } catch (e) {
      const popupBlocked = ['auth/popup-blocked','auth/cancelled-popup-request','auth/popup-closed-by-user'].includes(e.code);
      if (popupBlocked) {
        console.log("[auth_patch] popup blocked → redirect");
        return auth.signInWithRedirect(provider);
      }
      throw e;
    }
  };

  console.log("[auth_patch] installed. iOS:", isIOS, "inApp:", isInApp);
})();