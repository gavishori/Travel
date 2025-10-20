
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut,
  setPersistence, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence,
  isSignInWithEmailLink, sendSignInLinkToEmail, signInWithEmailLink,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import config from './firebase-config.json' assert { type: 'json' };
export const app = initializeApp(config);
export const auth = getAuth(app);
export const APP_BASE = new URL("./", location.href).toString();

export async function ensurePersistence(){
  try{ await setPersistence(auth, indexedDBLocalPersistence); return 'indexedDB'; }
  catch(e1){ try{ await setPersistence(auth, browserLocalPersistence); return 'local'; }
  catch(e2){ try{ await setPersistence(auth, browserSessionPersistence); return 'session'; }
  catch(e3){ console.warn('All persistence failed', e1,e2,e3); return 'none'; }}}
}

export async function sendMagicLink(email, continueUrl = APP_BASE){
  const settings = { url: continueUrl, handleCodeInApp: true };
  await sendSignInLinkToEmail(auth, email, settings);
  try{ localStorage.setItem('emailForSignIn', email);}catch(_){}
  return true;
}

export async function completeEmailLinkLogin(){
  const href = location.href;
  if(!isSignInWithEmailLink(auth, href)) return false;
  let email=null; try{ email = localStorage.getItem('emailForSignIn'); }catch(_){}
  if(!email) email = prompt('נא לאשר אימייל עבור כניסה:');
  if(!email) return false;
  await signInWithEmailLink(auth, email, href);
  try{ localStorage.removeItem('emailForSignIn'); }catch(_){}
  try{ history.replaceState({}, '', APP_BASE); }catch(_){}
  return true;
}

export async function hardSignOut(){
  try{ await signOut(auth);}catch(_){}
  try{
    const clr=(s)=>{ try{ Object.keys(s).forEach(k=>{ if(k.startsWith('firebase:')||k.includes('firebase')||k==='emailForSignIn'){ try{s.removeItem(k);}catch(_){}} }); }catch(_){}};
    clr(localStorage); clr(sessionStorage);
  }catch(_){}
  try{
    if(indexedDB && indexedDB.deleteDatabase){
      ['firebaseLocalStorageDb','firebase-heartbeat-database'].forEach(n=>{ try{ indexedDB.deleteDatabase(n); }catch(_){} });
    }
  }catch(_){}
  return true;
}

export const FB = { app, auth, APP_BASE, ensurePersistence, sendMagicLink, completeEmailLinkLogin, hardSignOut };
