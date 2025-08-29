// script.js — popup-only login (GitHub Pages safe)
(function () {
  function wire() {
    var auth = window.auth;
    var provider = window.googleProvider;
    if (!auth || !provider) return setTimeout(wire, 50);

    var btn = document.getElementById('googleSignInBtn') || document.querySelector('[data-google-btn]');
    if (!btn) return;

    // remove any prior listeners
    var clone = btn.cloneNode(true);
    if (btn.parentNode) btn.parentNode.replaceChild(clone, btn);
    btn = clone;

    btn.addEventListener('click', async function (e) {
      e.preventDefault();
      try {
        const result = await auth.signInWithPopup(provider);
        console.log('[auth] popup success:', !!(result && result.user));
      } catch (err) {
        console.error('[auth] popup error:', err && err.code, err && err.message);
        alert('שגיאה בהתחברות: ' + (err && err.message || err));
      }
    });

    auth.onAuthStateChanged(function (user) {
      console.log('[auth] state changed:', !!user);
      if (user && user.uid) console.log('Auth UID:', user.uid);
    });
  }
  wire();
})();