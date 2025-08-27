/* App bootstrap */
let app, auth, db;
try {
  app = firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  db   = firebase.firestore();
} catch (e) {
  console.error('Firebase init error:', e);
  alert('שגיאת אתחול Firebase. בדוק את firebase.js.');
}

/* Elements */
const loginBtn  = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const tripsEl   = document.getElementById('trips');
const hintEl    = document.getElementById('hint');

// Only run the app logic if Firebase was initialized successfully
if (app) {

  /* Auth UI */
  loginBtn.onclick = async () => {
    loginBtn.disabled = true;
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
    } catch (e) {
      console.error(e);
      alert('נכשל להתחבר: ' + (e.message || e));
    } finally {
      loginBtn.disabled = false;
    }
  };

  logoutBtn.onclick = () => auth.signOut();

  /* Render */
  function card(t) {
    const start = t.startDate?.toDate?.() ? t.startDate.toDate() : (t.startDate || '');
    const end   = t.endDate?.toDate?.()   ? t.endDate.toDate()   : (t.endDate || '');
    return `<article class="card">
      <h3>${t.title || 'טיול ללא שם'}</h3>
      <div class="badges">
        ${start ? `<span class="badge">מתחיל: ${new Date(start).toLocaleDateString('he-IL')}</span>` : ''}
        ${end   ? `<span class="badge">מסתיים: ${new Date(end).toLocaleDateString('he-IL')}</span>` : ''}
        ${Array.isArray(t.tags) ? t.tags.map(x=>`<span class="badge">${x}</span>`).join('') : ''}
      </div>
    </article>`;
  }

  function renderTrips(docs) {
    if (!docs || !docs.length) {
      tripsEl.innerHTML = '<p class="badge">אין טיולים עדיין.</p>';
      return;
    }
    tripsEl.innerHTML = docs.map(d => card({ id: d.id, ...d.data() })).join('');
  }

  /* Data */
  let unsub = null;

  auth.onAuthStateChanged(async user => {
    if (user) {
      // Signed in
      loginBtn.hidden  = true;
      logoutBtn.hidden = false;
      hintEl.hidden    = true;

      // Live query: trips owned by the user (ownerUid field)
      unsub && unsub();
      unsub = db.collection('trips')
        .where('ownerUid', '==', user.uid)
        .orderBy('startDate', 'desc')
        .onSnapshot(snap => renderTrips(snap.docs), (err) => {
          console.error(err);
          alert('טעינת טיולים נכשלה. בדוק את חוקי Firestore.');
        });
    } else {
      // Signed out
      loginBtn.hidden  = false;
      logoutBtn.hidden = true;
      hintEl.hidden    = false;
      tripsEl.innerHTML = '';
      unsub && unsub(); unsub = null;
    }
  });
}
