
// Force redirect-only (no popups). Works in iOS/embedded browsers.
(function(){
  var auth = (window.firebase && firebase.auth) ? firebase.auth() : (window.auth || null);
  if (!auth) { setTimeout(arguments.callee, 100); return; }
  console.log('[auth_patch] redirect-only installed');
  // Nothing else to do here because we wire the button to signInWithRedirect in hotfix.
})();
