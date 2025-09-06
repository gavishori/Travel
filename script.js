// script.js (ESM) — Email/Password auth
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const firebaseConfig = window.firebaseConfig;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const $ = (s) => document.querySelector(s);
const emailEl = $('#email');
const passEl  = $('#password');
const toggle  = $('#togglePass');
const btnIn   = $('#btnSignIn');
const btnUp   = $('#btnSignUp');
const btnReset= $('#btnReset');
const msgEl   = $('#msg');

function setBusy(isBusy) {
  [btnIn, btnUp, btnReset, toggle].forEach(b => b && (b.disabled = isBusy));
}

function showMsg(txt, isError = true) {
  msgEl.textContent = txt || '';
  msgEl.style.color = isError ? '#ffbdad' : '#a7f3d0';
}

// Toggle password visibility
toggle?.addEventListener('click', () => {
  const show = passEl.type === 'password';
  passEl.type = show ? 'text' : 'password';
  toggle.setAttribute('aria-pressed', String(show));
});

// Sign in
btnIn?.addEventListener('click', async () => {
  setBusy(true); showMsg('');
  try {
    const email = emailEl.value.trim();
    const pass  = passEl.value;
    await signInWithEmailAndPassword(auth, email, pass);
    showMsg('מחובר ✔️', false);
  } catch (e) {
    showMsg(humanize(e));
  } finally {
    setBusy(false);
  }
});

// Sign up
btnUp?.addEventListener('click', async () => {
  setBusy(true); showMsg('');
  try {
    const email = emailEl.value.trim();
    const pass  = passEl.value;
    await createUserWithEmailAndPassword(auth, email, pass);
    showMsg('החשבון נוצר והתחברת ✔️', false);
  } catch (e) {
    showMsg(humanize(e));
  } finally {
    setBusy(false);
  }
});

// Forgot password
btnReset?.addEventListener('click', async (ev) => {
  ev.preventDefault();
  setBusy(true); showMsg('');
  try {
    const email = emailEl.value.trim();
    await sendPasswordResetEmail(auth, email);
    showMsg('קישור לאיפוס סיסמה נשלח למייל', false);
  } catch (e) {
    showMsg(humanize(e));
  } finally {
    setBusy(false);
  }
});

function humanize(err) {
  const code = (err && err.code) || '';
  switch (code) {
    case 'auth/invalid-email':       return 'האימייל לא תקין';
    case 'auth/missing-password':    return 'לא הוזנה סיסמה';
    case 'auth/weak-password':       return 'סיסמה חלשה (לפחות 6 תווים)';
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
    case 'auth/wrong-password':      return 'אימייל או סיסמה שגויים';
    case 'auth/email-already-in-use':return 'האימייל כבר בשימוש';
    default:                         return err.message || 'שגיאה לא צפויה';
  }
}
