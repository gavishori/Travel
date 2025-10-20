// firebase.js - imports + init + helpers
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import cfg from "./firebase-config.js";

export const app = initializeApp(cfg);
export const auth = getAuth(app);
await setPersistence(auth, browserLocalPersistence);

// שליחת לינק קסם
export async function sendMagicLink(email){
  const url = window.location.origin + window.location.pathname + "?mode=ml";
  const settings = { url, handleCodeInApp: true };
  await sendSignInLinkToEmail(auth, email, settings);
  localStorage.setItem("pendingEmail", email);
  alert("שלחנו לינק כניסה למייל: " + email);
}

// השלמת התחברות אם פתחנו את הלינק מהמייל
export async function completeMagicLinkIfNeeded(){
  if (isSignInWithEmailLink(auth, window.location.href)){
    let email = localStorage.getItem("pendingEmail");
    if (!email) email = prompt("הקלד אימייל כדי להשלים כניסה:");
    await signInWithEmailLink(auth, email, window.location.href);
    localStorage.removeItem("pendingEmail");
    // ניקוי הפרמטרים מה־URL
    const clean = window.location.origin + window.location.pathname;
    history.replaceState({}, "", clean);
  }
}

// התנתקות אגרסיבית (ניקוי קש/אינדקסדב/אחסון)
export async function hardLogout(){
  try{ await signOut(auth);}catch(e){}
  try{ localStorage.clear(); sessionStorage.clear(); }catch(e){}
  try{ if ('caches' in window){ const names = await caches.keys(); await Promise.all(names.map(n=>caches.delete(n))); } }catch(e){}
  try{
    if (indexedDB && indexedDB.databases){
      const dbs = await indexedDB.databases();
      await Promise.all(dbs.map(d=>indexedDB.deleteDatabase(d.name)));
    }
  }catch(e){}
  location.replace(window.location.origin + window.location.pathname + "?logout=1");
}
