import { auth } from "./firebase.js";
import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const emailInput = document.getElementById("email");
const sendLinkBtn = document.getElementById("send-link");
const gotoAppBtn = document.getElementById("goto-app");
const logoutBtn = document.getElementById("logout");
const statusEl = document.getElementById("status");

const actionCodeSettings = {
  url: window.location.origin + window.location.pathname, // come back to login page
  handleCodeInApp: true
};

function setStatus(txt) { if (statusEl) statusEl.textContent = txt || ""; }

// Handle returning via magic link
(async () => {
  if (isSignInWithEmailLink(auth, window.location.href)) {
    try {
      let email = window.localStorage.getItem('emailForSignIn');
      if (!email) {
        email = window.prompt('הכנס אימייל כדי להשלים התחברות:');
      }
      await signInWithEmailLink(auth, email, window.location.href);
      window.localStorage.removeItem('emailForSignIn');
      setStatus("התחברת בהצלחה ✓");
      // after login auto-redirect to app/
      setTimeout(() => location.assign("./app/"), 400);
    } catch (e) {
      console.error(e);
      alert("שגיאה בהתחברות: " + (e?.message || e));
    }
  }
})();

sendLinkBtn?.addEventListener("click", async () => {
  try {
    const email = emailInput.value.trim();
    if (!email) return alert("הכנס אימייל");
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
    alert("נשלח לינק כניסה לאימייל.");
  } catch (e) {
    console.error(e);
    alert("שגיאה בשליחת לינק: " + (e?.message || e));
  }
});

gotoAppBtn?.addEventListener("click", () => {
  location.assign("./app/");
});

logoutBtn?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    setStatus("התנתקת");
  } catch (e) {
    console.error(e);
    alert("שגיאה בהתנתקות: " + (e?.message || e));
  }
});

onAuthStateChanged(auth, (user) => {
  const badge = document.getElementById("badge");
  if (user) {
    badge.textContent = "מחובר";
    badge.className = "chip success";
    setStatus(user.email + " :מחובר");
  } else {
    badge.textContent = "אורח";
    badge.className = "chip";
    setStatus("");
  }
});