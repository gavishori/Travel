/* bootstrap_user.js — ensure user doc + a demo trip on first login */
(function(){
  if (!window.firebaseAuth || !window.firebaseDb) { return; }
  const auth = window.firebaseAuth;
  const db   = window.firebaseDb;

  auth.onAuthStateChanged(async (user) => {
    console.log("[bootstrap] auth changed:", !!user);
    if (!user) return;
    const uid = user.uid;

    try {
      // users/{uid}
      const userRef = db.collection('users').doc(uid);
      const snap = await userRef.get();
      if (!snap.exists) {
        await userRef.set({
          email: user.email || null,
          displayName: user.displayName || "",
          photoURL: user.photoURL || "",
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log("[bootstrap] user doc created");
      }

      // trips owned by the user — if none, create a small demo
      const q = await db.collection('trips').where('ownerUid', '==', uid).limit(1).get();
      if (q.empty) {
        await db.collection('trips').add({
          title: "נסיעה לדוגמה",
          destination: "ספרד",
          startDate: "2025-08-25",
          endDate: "2025-08-27",
          ownerUid: uid,
          tags: ["דוגמה"],
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log("[bootstrap] demo trip created");
      }
    } catch (e) {
      console.error("[bootstrap] error:", e);
    }
  });
})();