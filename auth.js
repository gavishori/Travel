// auth.js
import { auth } from "./firebase.js";
import {
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

// שמור סשן מקומית (נשאר מחובר אחרי רענון/סגירה)
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("[auth] persistence error:", err.code, err.message);
});

// התחברות
export function loginWithGoogle() {
  signInWithRedirect(auth, provider).catch((err) => {
    console.error("[auth] redirect error:", err.code, err.message);
    alert("שגיאת התחברות. נסה שוב.");
  });
}

// התנתקות
export function logout() {
  signOut(auth).catch((err) => {
    console.error("[auth] signOut error:", err.code, err.message);
  });
}

// קריאה חד-פעמית אחרי החזרה מ-redirect
getRedirectResult(auth)
  .then((result) => {
    if (result && result.user) {
      console.log("[auth] redirect result user:", result.user.uid);
      // לדוגמה: localStorage.setItem("uid", result.user.uid);
    }
  })
  .catch((err) => {
    console.error("[auth] getRedirectResult error:", err.code, err.message);
  });

// ניטור מצב ההתחברות ועדכון UI
onAuthStateChanged(auth, (user) => {
  console.log("[auth] state changed:", !!user);
  const loginBtn = document.getElementById("googleSignInBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const userNameEl = document.getElementById("userName");
  const userAvatarEl = document.getElementById("userAvatar");

  if (user) {
    if (loginBtn) loginBtn.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "inline-flex";
    if (userNameEl) userNameEl.textContent = user.displayName || "משתמש";
    if (userAvatarEl && user.photoURL) {
      userAvatarEl.src = user.photoURL;
      userAvatarEl.alt = user.displayName || "avatar";
    }
  } else {
    if (loginBtn) loginBtn.style.display = "inline-flex";
    if (logoutBtn) logoutBtn.style.display = "none";
    if (userNameEl) userNameEl.textContent = "";
    if (userAvatarEl) userAvatarEl.removeAttribute("src");
  }
});

// מאזינים לכפתורים
document.getElementById("googleSignInBtn")?.addEventListener("click", loginWithGoogle);
document.getElementById("logoutBtn")?.addEventListener("click", logout);
