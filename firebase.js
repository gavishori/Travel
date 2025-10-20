// Unified Firebase wrapper exposing the exact names script.js expects.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  setPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
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

// Base URL used for redirects (works on GitHub Pages /Travel/)
export const APP_BASE = new URL("./", location.href).toString();

// ---- Providers & Magic Link ----
export async function signInWithGoogleRedirect(){
  const provider = new GoogleAuthProvider();
  try{ provider.setCustomParameters({prompt:'select_account'});}catch(_){}
  return await signInWithRedirect(auth, provider);
}
export async function signInWithAppleRedirect(){
  const provider = new OAuthProvider('apple.com');
  return await signInWithRedirect(auth, provider);
}
export async function sendMagicLink(email, continueUrl = APP_BASE){
  await sendSignInLinkToEmail(auth, email, { url: continueUrl, handleCodeInApp: true });
  try{ localStorage.setItem('emailForSignIn', email); }catch(_){}
  return true;
}
export async function completeEmailLinkLogin(){
  const href = location.href;
  if (isSignInWithEmailLink(auth, href)){
    let email = null;
    try { email = localStorage.getItem('emailForSignIn'); } catch(_){}
    if (!email) email = prompt('אישור מייל עבור כניסה:');
    if (!email) return;
    await signInWithEmailLink(auth, email, href);
    try{ localStorage.removeItem('emailForSignIn'); }catch(_){}
    // clean querystring
    try{ history.replaceState({}, '', APP_BASE); }catch(_){}
  }
}
// passwordless + reset
export async function sendReset(email){ return await sendPasswordResetEmail(auth, email); }

// Persistence cascade for iOS
export async function ensurePersistence(){
  try{ await setPersistence(auth, indexedDBLocalPersistence); return 'indexedDB'; }
  catch(e1){ try{ await setPersistence(auth, browserLocalPersistence); return 'local'; }
  catch(e2){ try{ await setPersistence(auth, browserSessionPersistence); return 'session'; }
  catch(e3){ console.warn('All persistence failed', e1, e2, e3); return 'none'; }}}
}

// Hard sign-out
export async function hardSignOut(){
  try{ await signOut(auth);}catch(_){}
  try{
    const clearStore=(s)=>{try{Object.keys(s).forEach(k=>{ if(k.startsWith('firebase:')||k.includes('firebase')||k==='emailForSignIn'){ try{s.removeItem(k);}catch(_){}}});}catch(_){}};
    clearStore(localStorage); clearStore(sessionStorage);
  }catch(_){}
  try{
    if (indexedDB && indexedDB.deleteDatabase){
      ['firebaseLocalStorageDb','firebase-heartbeat-database'].forEach(n=>{try{indexedDB.deleteDatabase(n);}catch(_){}});
    }
  }catch(_){}
  return true;
}

try{
  FB.APP_BASE=APP_BASE;
  FB.signInWithGoogleRedirect=signInWithGoogleRedirect;
  FB.signInWithAppleRedirect=signInWithAppleRedirect;
  FB.sendMagicLink=sendMagicLink;
  FB.completeEmailLinkLogin=completeEmailLinkLogin;
  FB.ensurePersistence=ensurePersistence;
  FB.hardSignOut=hardSignOut;
  FB.sendReset=sendReset;
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


export async function sendReset(email){
  if(!email) throw new Error('missing email');
  return await sendPasswordResetEmail(auth, email);
}
try { FB.sendReset = sendReset; } catch(_){}
