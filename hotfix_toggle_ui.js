
// Minimal UI toggle + redirect-only fallback that does not touch your app logic.
(function () {
  var auth = (window.firebase && firebase.auth) ? firebase.auth() : (window.auth || null);
  if (!auth) {
    console.warn('[hotfix] auth not ready yet; retry in 200ms');
    setTimeout(arguments.callee, 200);
    return;
  }

  // Redirect-only: in iOS/embedded browsers popup is blocked; redirect is robust.
  try {
    var _signInWithRedirect = auth.signInWithRedirect ? function(){ return auth.signInWithRedirect(new firebase.auth.GoogleAuthProvider()); } : null;
    window.__hotfix_redirect_signin__ = _signInWithRedirect;
  } catch(e){}

  var splash = document.getElementById('splash');
  var app = document.getElementById('app');
  function showApp(show) {
    if (!splash || !app) return;
    document.body.classList.toggle('splash-mode', !show);
    splash.style.display = show ? 'none' : '';
    app.style.display = show ? '' : 'none';
  }

  // Wire the button if exists
  var btn = document.getElementById('googleSignInBtn');
  if (btn) {
    btn.addEventListener('click', function(e){
      if (e) e.preventDefault();
      if (typeof window.__hotfix_redirect_signin__ === 'function') {
        window.__hotfix_redirect_signin__();
      } else {
        // compat path
        var provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithRedirect(provider);
      }
    }, { passive: false });
  }

  auth.onAuthStateChanged(function(user){
    console.log('[hotfix] auth state:', !!user);
    if (user) {
      showApp(true);
    } else {
      showApp(false);
    }
  });
})();
