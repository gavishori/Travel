(function(){
  const $ = s => document.querySelector(s);
  const foot = $('#foot');
  const btn = $('#googleBtn');
  const out = $('#logoutBtn');
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  const set = t => foot.textContent = t;

  // More reliable on iOS
  auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(()=>{});

  // Handle redirect return
  auth.getRedirectResult().then(res => {
    if (res && res.user && !auth.currentUser) return auth.updateCurrentUser(res.user);
  }).catch(()=>{});

  auth.onAuthStateChanged(u => {
    if (u) {
      set('מחובר: ' + (u.email || u.uid));
      btn.style.display = 'none';
      out.style.display = '';
    } else {
      set('לא מחובר');
      btn.style.display = '';
      out.style.display = 'none';
    }
  });

  btn.addEventListener('click', async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({prompt:'select_account'});
    if (isIOS) {
      await auth.signInWithRedirect(provider);
    } else {
      try {
        await auth.signInWithPopup(provider);
      } catch (e) {
        await auth.signInWithRedirect(provider);
      }
    }
  });

  out.addEventListener('click', () => auth.signOut());
})();