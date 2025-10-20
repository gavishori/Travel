// Unified Firebase wrapper exposing the exact names script.js expects.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
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
// Convenience named exports (used in a few places)
export const onAuth = onAuthStateChanged;
export const signOutUser = () => signOut(auth);

// --- FB namespace matching script.js expectations ---

// --- Mobile-friendly persistence picker ---
export async function applyMobilePersistence() {
  try {
    const ua = (navigator.userAgent||'').toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isMobileChrome = /android|mobile/.test(ua) && /chrome/.test(ua);
    const target = isIOS ? browserSessionPersistence : (isMobileChrome ? browserLocalPersistence : indexedDBLocalPersistence);
    await setPersistence(auth, target).catch(async ()=>{
      try { await setPersistence(auth, browserLocalPersistence); } catch(_) {}
    });
  } catch(_) {}
}
try{
  FB.applyMobilePersistence = applyMobilePersistence;
  FB.setPersistence = setPersistence;
  FB.browserLocalPersistence = browserLocalPersistence;
  FB.browserSessionPersistence = browserSessionPersistence;
  FB.indexedDBLocalPersistence = indexedDBLocalPersistence;
}catch(_){} 

export const FB = {
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

try{window.__authDebug={auth};}catch(_){}
