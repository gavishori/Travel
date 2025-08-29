// script.js — DROP-IN FIX (redirect-only, no popups, no inline onclick required)
(function () {
  function wire() {
    function enterApp(){ try{ document.body.classList.add('entered'); }catch(e){} }

    var auth = window.auth;
    var provider = window.googleProvider;
    if (!auth || !provider) return setTimeout(wire, 50);

    var btn = document.getElementById('googleSignInBtn') || document.querySelector('[data-google-btn]');
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
        if (auth && auth.currentUser) { enterApp(); return; }
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
        if (user && user.uid) { console.log('Auth UID:', user.uid); enterApp(); } else { try{ document.body.classList.remove('entered'); }catch(e){} }
      });
    }
  }
  wire();
})();
// === Trip loading ===
auth.onAuthStateChanged(async (user) => {
  console.log('[auth] state changed:', !!user);
  if (!user) { document.body.classList.remove('entered'); return; }
  console.log('Auth UID:', user.uid);
  document.body.classList.add('entered');
  await loadTrips(user.uid);
});

async function loadTrips(uid){
  try{
    const db = firebase.firestore();
    const snap = await db.collection('trips')
      .where('ownerUid', '==', uid)
      .orderBy('startDate', 'desc')
      .get();
    const list = document.getElementById('tripList');
    list.innerHTML = '';
    if (snap.empty){
      list.innerHTML = '<li class="muted">אין עדיין נסיעות. לחץ על ＋ כדי ליצור.</li>';
      return;
    }
    snap.forEach(doc => {
      const t = doc.data();
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="trip-title">${t.destination || 'ללא יעד'}</div>
        <div class="muted">${t.startDate || ''} – ${t.endDate || ''}</div>
        <div class="row bottom-row">
          <button class="btn primary" data-open="${doc.id}">פתח</button>
        </div>`;
      list.appendChild(li);
    });
    list.addEventListener('click', (e)=>{
      const id = e.target?.getAttribute('data-open');
      if (!id) return;
      console.log('Open trip', id);
      // implement loadTrip(id) if needed
    }, { once: true });
  }catch(err){
    console.error('loadTrips error', err);
    alert('שגיאה בטעינת נסיעות: ' + (err?.message || err));
  }
}
