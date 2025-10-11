// Unified Firebase wrapper exposing the exact names script.js expects.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
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

// Prefer persistence that doesn't rely on 3p cookies (works on Chrome mobile)
let _auth;
try{
  _auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence]
  });
}catch(e){
  // Fallback for environments where initializeAuth was called already
  _auth = getAuth(app);
}
export const auth = _auth;

// Lightweight runtime detection to surface which persistence is effectively available (debug only)
(async function(){
  try{
    const ua = (typeof navigator!=="undefined" && navigator.userAgent) ? navigator.userAgent : "unknown";
    // test IndexedDB
    let mode = "memory";
    try{
      if (typeof indexedDB !== "undefined") {
        const req = indexedDB.open("flymily_test_db");
        await new Promise((res, rej)=>{ req.onerror=()=>rej(); req.onsuccess=()=>res(); req.onupgradeneeded=()=>res(); });
        mode = "indexedDB";
        try{ req.result.close(); }catch(_){}
        try{ indexedDB.deleteDatabase("flymily_test_db"); }catch(_){}
      }
    }catch(_){}
    // test localStorage only if not already indexedDB
    if(mode!=="indexedDB"){
      try{
        if (typeof localStorage!=="undefined") {
          const k="__flymily_test__"; localStorage.setItem(k,"1"); localStorage.removeItem(k);
          mode = "localStorage";
        }
      }catch(_){}
    }
    try{ window.__AUTH_PERSISTENCE = mode; window.__UA = ua; }catch(_){}
  }catch(_){}
})();

// Convenience named exports (used in a few places)
export const onAuth = onAuthStateChanged;
export const signOutUser = () => signOut(auth);

// --- FB namespace matching script.js expectations ---
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


/* SHIM: FB.getAuth fallback */
try{
  window.FB = window.FB || {};
  if (typeof window.FB.getAuth !== 'function') {
    window.FB.getAuth = function(){ try { return auth; } catch(e){ return null; } };
  }
}catch(e){}
