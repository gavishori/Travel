// auth.js – Redirect only, no popups, no inline onclick
import {
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
  browserLocalPersistence,
  setPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth, provider } from "./firebase.js";

const $ = (id)=>document.getElementById(id);
const stateEl = $("state");
const uidEl = $("uid");
const avatarEl = $("avatar");
const loginBtn = $("login");
const logoutBtn = $("logout");

// session persistence
await setPersistence(auth, browserLocalPersistence).catch(()=>{});

// wire buttons
loginBtn.addEventListener("click", () => {
  // redirect is the ONLY flow we use
  signInWithRedirect(auth, provider).catch(err => {
    alert("שגיאת התחברות: " + (err?.code || err));
    console.error(err);
  });
});
logoutBtn.addEventListener("click", () => {
  signOut(auth).catch(console.error);
});

// handle redirect result once
getRedirectResult(auth).then(res => {
  if (res?.user) {
    console.log("[auth] redirect user:", res.user.uid);
  }
}).catch(err => console.warn("[auth] redirect error", err?.code, err?.message));

// reflect state
onAuthStateChanged(auth, (user) => {
  const isIn = !!user;
  stateEl.textContent = "מצב: " + (isIn ? "מחובר" : "מנותק");
  uidEl.textContent = isIn ? ("UID: " + (user.uid || "")) : "";
  if (isIn && user.photoURL) {
    avatarEl.src = user.photoURL;
    avatarEl.style.display = "inline-block";
  } else {
    avatarEl.removeAttribute("src");
    avatarEl.style.display = "none";
  }
  loginBtn.style.display = isIn ? "none" : "inline-block";
  logoutBtn.style.display = isIn ? "inline-block" : "none";
});
