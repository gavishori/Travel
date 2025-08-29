// script.js — clean, mobile-safe (Popup only), no redirects
(function () {
  function wire() {
    var auth = window.auth;
    var provider = window.googleProvider;
    var btn = document.getElementById('googleSignInBtn') || document.querySelector('[data-google-btn]');

    if (!auth || !provider || !btn) {
      return setTimeout(wire, 50);
    }

    // remove any stale listeners
    var clone = btn.cloneNode(true);
    if (btn.parentNode) btn.parentNode.replaceChild(clone, btn);
    btn = clone;

    btn.addEventListener('click', async function (e) {
      e.preventDefault();
      try {
        const res = await auth.signInWithPopup(provider);
        console.log('[auth] popup success:', !!(res && res.user));
      } catch (err) {
        console.warn('[auth] popup error:', err && err.code, err && err.message);
        alert('שגיאה בהתחברות: ' + (err && err.message || err));
      }
    });

    if (typeof auth.onAuthStateChanged === 'function') {
      auth.onAuthStateChanged(function (user) {
        console.log('[auth] state changed:', !!user);
        if (user && user.uid) console.log('Auth UID:', user.uid);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();