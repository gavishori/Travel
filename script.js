
// Safe Google auth for iOS + desktop (loop guard, no auto-login)
(function(){
  if (!(window.firebase && firebase.auth && window.auth)) return;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const redirectFlagKey = 'authRedirectInProgress';

  const loginBtn =
    document.getElementById('googleSignIn') ||
    document.querySelector('[data-google-login]') ||
    document.querySelector('button#googleSignIn, button[data-google-login]') ||
    document.querySelector('button');

  // 1) Use SESSION to avoid ITP issues
  auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(()=>{});

  // 2) Handle redirect result BEFORE anything else; clear the flag either way
  auth.getRedirectResult()
    .then(async (res) => {
      if (res && res.user && !auth.currentUser) {
        await auth.updateCurrentUser(res.user);
      }
    })
    .catch(()=>{})
    .finally(() => { try { sessionStorage.removeItem(redirectFlagKey); } catch(e){} });

  // 3) Reflect state (optional UI hook)
  auth.onAuthStateChanged((u) => {
    const emailEl = document.getElementById('authEmail');
    if (emailEl) emailEl.textContent = u ? (u.email || u.uid) : '';
    const statusEl = document.getElementById('authStatus');
    if (statusEl) statusEl.textContent = u ? 'מחובר' : 'לא מחובר';
  });

  // 4) Only initiate sign-in on explicit click; never on load
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      if (isIOS) {
        try {
          if (!sessionStorage.getItem(redirectFlagKey)) {
            sessionStorage.setItem(redirectFlagKey, '1');
            await auth.signInWithRedirect(provider);
          }
        } catch (e) {
          try { sessionStorage.removeItem(redirectFlagKey); } catch(_){}
        }
      } else {
        try {
          await auth.signInWithPopup(provider);
        } catch (e) {
          try { sessionStorage.setItem(redirectFlagKey, '1'); } catch(_){}
          await auth.signInWithRedirect(provider);
        }
      }
    });
  }
})();
