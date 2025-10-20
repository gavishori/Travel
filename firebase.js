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

// === Providers & Redirect/Magic-Link helpers ===
export async function signInWithGoogleRedirect() {
  const provider = new GoogleAuthProvider();
  try { provider.setCustomParameters({ prompt: 'select_account' }); } catch(_){}
  await signInWithRedirect(auth, provider);
}
export async function signInWithAppleRedirect() {
  const provider = new OAuthProvider('apple.com');
  await signInWithRedirect(auth, provider);
}
export async function sendMagicLink(email, continueUrl=location.origin+location.pathname) {
  await sendSignInLinkToEmail(auth, email, { url: continueUrl, handleCodeInApp: true });
  try { localStorage.setItem('emailForSignIn', email); } catch(_){}
}
export async function completeEmailLinkLogin() {
  const href = location.href;
  if (isSignInWithEmailLink(auth, href)) {
    let email = null;
    try { email = localStorage.getItem('emailForSignIn'); } catch(_){}
    if (!email) email = prompt('אשר/י אימייל:');
    if (!email) return;
    await signInWithEmailLink(auth, email, href);
    try { localStorage.removeItem('emailForSignIn'); } catch(_){}
    history.replaceState({}, '', (location.origin+location.pathname));
  }
}
try{
  FB.signInWithGoogleRedirect = signInWithGoogleRedirect;
  FB.signInWithAppleRedirect  = signInWithAppleRedirect;
  FB.sendMagicLink            = sendMagicLink;
  FB.completeEmailLinkLogin   = completeEmailLinkLogin;
  FB.getRedirectResult        = getRedirectResult;
}catch(_){} 

export const FB = {
  // db & auth handles
  db, auth,

  // auth API names as expected by script.js
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
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
