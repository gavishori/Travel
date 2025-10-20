// Unified Firebase wrapper exposing the exact names script.js expects.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  indexedDBLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore,
  setLogLevel,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  addDoc,
  getDocs,
  enableNetwork,
  disableNetwork
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyArvkyWzgOmPjYYXUIOdilmtfrWt7WxK-0",
  authDomain: "travel-416ff.firebaseapp.com",
  projectId: "travel-416ff",
  storageBucket: "travel-416ff.appspot.com",
  messagingSenderId: "1032412697405",
  appId: "1:1032412697405:web:44c9d7c6c220a3e4a8e3a7"
};

export const app = initializeApp(firebaseConfig);
export const db  = initializeFirestore(app, { ignoreUndefinedProperties: true, experimentalAutoDetectLongPolling: true });
setLogLevel("error");

// --- AUTH ---
export const auth = getAuth(app);
/* __PERSISTENCE_APPLIED__ */
try {
  await (async () => {
    try {
      await setPersistence(auth, indexedDBLocalPersistence);
    } catch (e) {
      await setPersistence(auth, browserLocalPersistence);
    }
  })();
} catch (e) {
  // ignore; default persistence will apply
  console.debug('persistence fallback:', e?.message||e);
}
// Convenience named exports (used in a few places)
export const onAuth = onAuthStateChanged;
export const signOutUser = () => signOut(auth);

// --- FB namespace matching script.js expectations ---

// --- Hard sign-out for stubborn mobile sessions (iOS/Chrome/PWA) ---
export async function hardSignOut() {
  try { await signOut(auth); } catch(e) { console.debug('signOut err', e); }
  try {
    // Nuke Firebase auth/session artifacts that may stick on mobile
    const toDelete = ['firebaseLocalStorageDb','firebase-installations-database','firebase-heartbeat-database'];
    await Promise.all(toDelete.map(name => new Promise((res)=>{
      try {
        const req = indexedDB.deleteDatabase(name);
        req.onsuccess = req.onerror = req.onblocked = () => res();
      } catch(_){ res(); }
    })));
  } catch(e){ /* ignore */ }
  try {
    Object.keys(localStorage||{}).filter(k => k.startsWith('firebase:')).forEach(k => localStorage.removeItem(k));
  } catch(_){}
  try { sessionStorage?.clear?.(); } catch(_){}
  try { navigator?.credentials?.preventSilentAccess?.(); } catch(_){}
  return true;
}
try { window.hardSignOut = hardSignOut; } catch(_){}

export const FB = {
  hardSignOut,
  // db & auth handles
  db, auth,

  // auth API names as expected by script.js
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,

  // firestore API surface
  doc, getDoc, setDoc, updateDoc,
  collection, addDoc, getDocs,
  onSnapshot, query, where, orderBy, limit, startAfter,
  serverTimestamp,
  deleteDoc
};

// Network toggles (optional resilience)
window.addEventListener("offline", () => disableNetwork(db).catch(()=>{}));
window.addEventListener("online",  () => enableNetwork(db).catch(()=>{}));

/* ---- Global attach for legacy scripts that expect a global FB ---- */
try {
  window.FB = FB;
  window.auth = auth;
  window.db = db;
} catch (e) {
  // Ignore if window not available (SSR)
}
