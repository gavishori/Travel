// Firebase helpers: getTrips, getCurrentUser, signOutIfAvailable.
// Paste your Firebase config to enable real data/auth.

export async function getTrips(){
  const config = null; /* Example:
  const config = {
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "...",
  }; */
  if(!config){
    return [];
  }
  try{
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js');
    const { getFirestore, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');

    const app = initializeApp(config);
    const db = getFirestore(app);
    const snap = await getDocs(collection(db, 'trips'));
    const items = [];
    snap.forEach(doc => {
      const d = doc.data();
      items.push({
        id: doc.id,
        destination: d.destination || d.title || '',
        startDate: d.startDate || d.start || d.dateFrom || '',
        endDate: d.endDate || d.end || d.dateTo || '',
        days: d.days || null,
        type: d.type || d.category || '',
      });
    });
    return items;
  }catch(err){
    console.warn('Firebase trips fetch failed:', err);
    return [];
  }
}

export async function getCurrentUser(){
  const config = null; /* Paste same config if using Auth */
  if(!config) return null;
  try{
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js');
    const { getAuth, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js');
    const app = initializeApp(config);
    const auth = getAuth(app);
    return await new Promise((resolve)=>{
      onAuthStateChanged(auth, (user)=>{
        if(!user) resolve(null);
        else resolve({
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
        });
      });
    });
  }catch(e){
    console.warn('getCurrentUser failed', e);
    return null;
  }
}

export async function signOutIfAvailable(){
  const config = null; /* Paste same config if using Auth */
  if(!config) return;
  try{
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js');
    const { getAuth, signOut } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js');
    const app = initializeApp(config);
    const auth = getAuth(app);
    await signOut(auth);
  }catch(e){
    console.warn('signOut failed', e);
  }
}
