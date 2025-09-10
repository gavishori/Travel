// Firebase glue. Works if you paste your config; otherwise getTrips() returns [].
// This file avoids breaking the page when Firebase isn't available.

export async function getTrips(){
  // If you want Firebase integration:
  // 1) Paste your config below
  // 2) Ensure index.html loads Firebase v10+ modules or compat builds if needed
  // 3) Replace the mock return with Firestore fetch
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
    return []; // fall back to sample in script.js
  }

  try{
    // Dynamic import Firebase (module build)
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js');
    const { getFirestore, collection, getDocs, query, orderBy } = await import('https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js');

    const app = initializeApp(config);
    const db = getFirestore(app);

    // Adjust collection/fields to match your schema
    const q = query(collection(db, 'trips')); // order in UI is handled client-side by sort button
    const snap = await getDocs(q);

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
    console.warn('Firebase import/fetch failed:', err);
    return [];
  }
}
