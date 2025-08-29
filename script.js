// script.js — DROP-IN FIX (redirect-only, no popups, no inline onclick required)
(function () {
  function wire() {
    var auth = window.auth;
    var provider = window.googleProvider;
    if (!auth || !provider) return setTimeout(wire, 50);

    var btn = document.getElementById('googleSignInBtn') || document.querySelector('[data-google-btn]');
    function isInAppBrowser(){
      var ua = navigator.userAgent || '';
      return /(FBAN|FBAV|Instagram|Line|Twitter|WhatsApp|Messenger|Snapchat|WeChat|Weibo)/i.test(ua);
    }
    if (btn) {
      // neutralize default navigation (anchors/forms)
      if (btn.tagName === 'A') {
        btn.href = 'javascript:void(0)';
        btn.removeAttribute('target');
      }
      btn.setAttribute('type', 'button');

      // drop legacy listeners
      var clone = btn.cloneNode(true);
      btn.parentNode.replaceChild(clone, btn);

      var go = function (e) {
        if (e && e.preventDefault) e.preventDefault();
        auth.signInWithRedirect(provider).catch(function (err) {
          console.warn('[auth] redirect error:', err && err.code, err && err.message);
          alert('שגיאת התחברות: ' + (err && err.code ? err.code : err));
        });
      };

      clone.addEventListener('click', go, false);
      clone.addEventListener('touchend', go, false);
    }

    if (typeof auth.getRedirectResult === 'function') {
      auth.getRedirectResult().then(function (res) {
        if (res && res.user) console.log('[auth] redirect user:', res.user.uid);
      }).catch(function (err) {
        console.warn('[auth] getRedirectResult:', err && err.code, err && err.message);
      });
    }

    if (typeof auth.onAuthStateChanged === 'function') {
      auth.onAuthStateChanged(function (user) {
        console.log('[auth] state changed:', !!user);
        if (user && user.uid) console.log('Auth UID:', user.uid);
      });
    }
  }
  wire();
})();