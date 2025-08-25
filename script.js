;(() => {
  const onReady = (fn) => (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", fn) : fn());

  onReady(() => {
    const signInBtn  = document.getElementById('signInWithGoogle');
    const signOutBtn = document.getElementById('signOut');
    const appEl      = document.getElementById('app');
    const splashEl   = document.getElementById('splash');

    if (!window.fb || !window.fb.auth) {
      console.warn('Firebase Auth not ready');
      return;
    }
    const { auth, provider } = window.fb;

    // Sign in
    if (signInBtn) {
      signInBtn.addEventListener('click', async () => {
        try {
          await auth.signInWithPopup(provider);
        } catch (e) {
          console.error('Google sign-in failed', e);
          alert('התחברות נכשלה: ' + (e.message || e));
        }
      });
    }

    // Sign out
    if (signOutBtn) {
      signOutBtn.addEventListener('click', () => auth.signOut());
    }

    // Auth state
    auth.onAuthStateChanged((user) => {
      console.log('Auth UID:', user ? user.uid : undefined);
      if (user) {
        // show app
        if (splashEl) splashEl.style.display = 'none';
        if (appEl) appEl.style.display = 'block';
        if (signInBtn)  signInBtn.style.display = 'none';
        if (signOutBtn) signOutBtn.style.display = 'inline-flex';
      } else {
        if (splashEl) splashEl.style.display = 'flex';
        if (appEl) appEl.style.display = 'none';
        if (signInBtn)  signInBtn.style.display = 'inline-flex';
        if (signOutBtn) signOutBtn.style.display = 'none';
      }
    });
  });
})();
