import cfg from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
let app, auth;
export function initAuth() {
  app = initializeApp(cfg);
  auth = getAuth(app);
  onAuthStateChanged(auth, (u) => {
    console.log('[auth] user:', u ? (u.email || u.uid) : 'signed-out');
  });
}
function baseReturnUrl(){
  const u = new URL(window.location.href);
  u.search = ''; u.hash='';
  return u.toString();
}
export async function sendMagicLink(email){
  const actionCodeSettings = { url: baseReturnUrl(), handleCodeInApp: true };
  return await sendSignInLinkToEmail(auth, email, actionCodeSettings);
}
export async function completeSignInIfNeeded(msgEl){
  try {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let email = window.localStorage.getItem('emailForSignIn');
      if (!email) email = prompt('הקלד/י את האימייל שאיתו שלחנו את הלינק:');
      const cred = await signInWithEmailLink(auth, email, window.location.href);
      window.localStorage.removeItem('emailForSignIn');
      if (msgEl) { msgEl.textContent = 'מחובר: ' + (cred.user.email || ''); msgEl.className='msg success'; }
      const u = new URL(window.location.href); u.search=''; u.hash=''; history.replaceState({}, '', u.toString());
    }
  } catch (e) {
    console.error(e);
    if (msgEl) { msgEl.textContent = 'שגיאה בהשלמת ההתחברות: ' + (e.message||e); msgEl.className='msg error'; }
  }
}
export async function hardLogout(){
  try { await signOut(auth); } catch (e) {}
  try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
  try {
    if (indexedDB && indexedDB.databases) {
      const dbs = await indexedDB.databases();
      for (const db of dbs) if (db.name) try { indexedDB.deleteDatabase(db.name); } catch(e){}
    } else {
      ['firebase-installations-database','firebaseLocalStorageDb','keyval-store'].forEach(n=>{ try{indexedDB.deleteDatabase(n)}catch(e){} });
    }
  } catch (e) { console.warn('indexedDB cleanup issue', e); }
}