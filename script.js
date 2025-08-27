// ----- App logic -----

const els = {
  loginBtn: document.getElementById('loginBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  hint: document.getElementById('hint'),
  trips: document.getElementById('trips'),
  fab: document.getElementById('fab'),
};

// Guard if Firebase didn't init
if (!window.auth || !window.db) {
  console.error('Auth provider not ready');
} else {
  // Sign-in handlers
  els.loginBtn.addEventListener('click', async () => {
    try {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
        await auth.signInWithRedirect(googleProvider);
      } else {
        await auth.signInWithPopup(googleProvider);
      }
    } catch (err) {
      console.error('Sign-in error:', err);
      alert('נכשל להתחבר: ' + err.message);
    }
  });

  els.logoutBtn.addEventListener('click', async () => {
    try { await auth.signOut(); } catch(e) { console.error(e); }
  });

  // Auth state
  auth.onAuthStateChanged(async (user) => {
    console.log('[auth] state changed:', !!user);
    els.loginBtn.hidden = !!user;
    els.logoutBtn.hidden = !user;
    els.fab.hidden = !user;
    if (!user) {
      els.hint.hidden = false;
      els.trips.hidden = true;
      els.trips.innerHTML = '';
      return;
    }
    els.hint.hidden = true;
    els.trips.hidden = false;
    loadTrips(user.uid);
  });

  // Example FAB: create empty trip owned by user
  els.fab.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) return;
    const name = prompt('שם הטיול?');
    if (name === null) return;
    try {
      await db.collection('trips').add({
        name: name || 'ללא שם',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        ownerUid: user.uid,
        tags: [],
        days: 0
      });
      loadTrips(user.uid);
    } catch (e) {
      console.error('Create trip failed', e);
      alert('נכשל ליצור טיול');
    }
  });
}

// Load only trips of this user, skip unnamed without ownerUid
async function loadTrips(uid) {
  try {
    // Prefer server then cache
    const q = db.collection('trips')
      .where('ownerUid', '==', uid)
      .orderBy('createdAt', 'desc');
    const snap = await q.get({ source: 'server' }).catch(async () => q.get({ source: 'default' }));

    const trips = [];
    snap.forEach(doc => {
      const t = doc.data() || {};
      // Double-guard
      if (!t || t.ownerUid !== uid) return;
      trips.push({ id: doc.id, ...t });
    });

    renderTrips(trips);
  } catch (e) {
    console.error('loadTrips failed', e);
    alert('שגיאה בטעינת טיולים');
  }
}

function renderTrips(trips) {
  const c = els.trips;
  c.innerHTML = '';
  if (!trips.length) {
    c.innerHTML = `<div class="empty">אין טיולים עדיין • לחץ על ＋ כדי להוסיף</div>`;
    return;
  }
  for (const t of trips) {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-title">${escapeHtml(t.name || 'ללא שם')}</div>
      <div class="card-sub">${(t.days||0)} ימים • ${formatDateRange(t)}</div>
      <div class="actions">
        <button class="btn">ערוך</button>
        <button class="btn danger" data-id="${t.id}">מחק</button>
      </div>`;
    c.appendChild(card);
  }
  c.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-id]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (!confirm('למחוק את הטיול?')) return;
    try { await db.collection('trips').doc(id).delete(); }
    catch (e) { console.error(e); alert('מחיקה נכשלה'); }
    loadTrips(auth.currentUser?.uid);
  }, { once: true });
}

function formatDateRange(t) {
  // placeholder – depends on your schema
  return (t.range?.text) || '';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}
