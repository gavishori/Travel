// Firebase Magic Link — גרסה ללא תקיית app, 4 קבצים בלבד
import config from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import {
  getAuth, sendSignInLinkToEmail, isSignInWithEmailLink,
  signInWithEmailLink, onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';

// אתחול Firebase
export const app = initializeApp(config);
const auth = getAuth(app);

// אלמנטים
const emailInput = document.getElementById('emailInput');
const sendLinkBtn = document.getElementById('sendLinkBtn');
const fullSignOutBtn = document.getElementById('fullSignOutBtn');
const goAppBtn = document.getElementById('goAppBtn');
const loginSection = document.getElementById('loginSection');
const appSection = document.getElementById('appSection');
const msg = document.getElementById('msg');
const signedAs = document.getElementById('signedAs');
const userEmailOut = document.getElementById('userEmail');

// חישוב URL חזרה תקין לגיטהאב פייג׳ס — תמיד חוזר לעמוד הזה
function currentBaseUrl() {
  const url = new URL(window.location.href);
  // מסיר פרמטרים וזנבות index.html
  let path = url.pathname.replace(/index\.html?$/i, '');
  if (!path.endsWith('/')) path += '/';
  return url.origin + path;
}

// שליחת לינק
sendLinkBtn.addEventListener('click', async () => {
  const email = (emailInput.value || '').trim();
  if (!email) { show('נא להזין אימייל'); return; }

  sendLinkBtn.disabled = true;
  try {
    const actionCodeSettings = {
      url: currentBaseUrl(), // חוזר לדף הזה
      handleCodeInApp: true,
    };
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('pendingEmail', email);
    show('נשלח קישור כניסה למייל. פתח/י אותו במכשיר זה.');
  } catch (e) {
    show('שגיאה בשליחת הלינק: ' + (e?.message || e));
  } finally {
    sendLinkBtn.disabled = false;
  }
});

// השלמת התחברות אם חזרנו עם Magic Link
(async function completeFromLink() {
  try {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let email = window.localStorage.getItem('pendingEmail');
      if (!email) {
        email = window.prompt('הכניסו את האימייל איתו ביקשתם את הלינק:');
      }
      await signInWithEmailLink(auth, email, window.location.href);
      window.localStorage.removeItem('pendingEmail');
      // מנקה את ה-URL
      const clean = currentBaseUrl();
      window.history.replaceState({}, '', clean);
      show('התחברת בהצלחה.');
    }
  } catch (e) {
    show('שגיאה בהשלמת התחברות: ' + (e?.message || e));
  }
})();

// ניתוק מלא
fullSignOutBtn.addEventListener('click', async () => {
  try {
    await signOut(auth);
  } finally {
    window.localStorage.removeItem('pendingEmail');
    show('התנתקת.');
  }
});

// מעבר לתוכן האפליקציה (בדמו זה רק מחליף תצוגה)
goAppBtn.addEventListener('click', () => {
  appSection.classList.remove('hidden');
  appSection.scrollIntoView({ behavior: 'smooth' });
});

// ניהול תצוגה לפי סטטוס התחברות
onAuthStateChanged(auth, (user) => {
  if (user) {
    signedAs.classList.remove('hidden');
    signedAs.textContent = 'מחובר: ' + (user.email || '');
    userEmailOut.textContent = user.email || '';
    appSection.classList.remove('hidden');
  } else {
    signedAs.classList.add('hidden');
    appSection.classList.add('hidden');
  }
});

function show(t) {
  msg.textContent = t;
}
