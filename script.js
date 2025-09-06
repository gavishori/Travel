// Email/Password auth for Firebase (modular v10)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const app = initializeApp(window.firebaseConfig);
const auth = getAuth(app);

// UI elements
const el = (id) => document.getElementById(id);
const authSection = el("auth");
const appSection  = el("app");
const msg = el("msg");
const who = el("who");

function show(t) { msg.textContent = t || ""; }
function toggle(authed) {
  authSection.hidden = authed;
  appSection.hidden  = !authed;
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    who.textContent = user.email;
    toggle(true);
  } else {
    toggle(false);
  }
});

// Sign in
document.getElementById("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = el("email").value.trim();
  const pass  = el("password").value;
  show("");
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found") {
      show("לא נמצא משתמש או סיסמה שגויה.");
    } else if (err.code === "auth/too-many-requests") {
      show("יותר מדי ניסיונות. נסה שוב מאוחר יותר.");
    } else {
      show(err.message);
    }
  }
});

// Sign up
el("signup").addEventListener("click", async () => {
  const email = el("email").value.trim();
  const pass  = el("password").value;
  show("");
  if (!email || pass.length < 6) {
    return show("סיסמה חייבת להיות לפחות 6 תווים.");
  }
  try {
    await createUserWithEmailAndPassword(auth, email, pass);
    show("נוצר משתמש חדש והתחברת.");
  } catch (err) {
    if (err.code === "auth/email-already-in-use") {
      show("האימייל כבר בשימוש.");
    } else {
      show(err.message);
    }
  }
});

// Reset password
el("reset").addEventListener("click", async () => {
  const email = el("email").value.trim();
  if (!email) return show("הכנס אימייל תחילה.");
  try {
    await sendPasswordResetEmail(auth, email);
    show("נשלח מייל לאיפוס סיסמה.");
  } catch (err) {
    show(err.message);
  }
});

// Logout
el("logout").addEventListener("click", async () => {
  await signOut(auth);
  show("");
});
