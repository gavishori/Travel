/* auth_patch_redirect_only.js — force redirect everywhere */
(function(){
  if (!window.firebaseAuth) { console.warn("[auth_patch] firebaseAuth missing"); return; }
  const auth = window.firebaseAuth;
  try { auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch(e) {}

  // Always resolve redirect result on load
  auth.getRedirectResult?.().catch(()=>{});

  // Replace popup with redirect globally
  const originalPopup = auth.signInWithPopup ? auth.signInWithPopup.bind(auth) : null;
  auth.signInWithPopup = function(provider){
    console.log("[auth_patch] forcing redirect (no popup)");
    return auth.signInWithRedirect(provider);
  };

  console.log("[auth_patch] redirect-only installed");
})();