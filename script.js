import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithRedirect,
  getRedirectResult, onAuthStateChanged, signOut, browserLocalPersistence, setPersistence
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { firebaseConfig } from "./firebase.js";

const $ = sel => document.querySelector(sel);
const logEl = $("#log");
const phaseEl = $("#phase");
const uaEl = $("#ua");
const whoEl = $("#who");
const pfpEl = $("#pfp");
const loginBtn = $("#loginBtn");
const logoutBtn = $("#logoutBtn");

function log(...args) {
  const line = args.map(a => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  console.log(line);
  logEl.textContent += line + "\n";
}

function setPhase(p) { phaseEl.textContent = "phase: " + p; }

uaEl.textContent = navigator.userAgent;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

await setPersistence(auth, browserLocalPersistence);

setPhase("boot");
log("boot", new Date().toISOString());

// 1) Handle redirect result if returning from Google
try {
  setPhase("getRedirectResult");
  const res = await getRedirectResult(auth);
  if (res) {
    log("getRedirectResult -> success");
    if (res.user) {
      log("user:", { uid: res.user.uid, email: res.user.email });
    }
  } else {
    log("getRedirectResult -> no result");
  }
} catch (err) {
  log("getRedirectResult error:", { code: err.code, message: err.message });
} finally {
  setPhase("listen auth");
}

// 2) Listen for auth state
onAuthStateChanged(auth, (user) => {
  if (user) {
    whoEl.textContent = user.displayName ? `${user.displayName} · ${user.email}` : user.email || user.uid;
    if (user.photoURL) { pfpEl.src = user.photoURL; pfpEl.style.display="block"; }
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    log("onAuthStateChanged: signed-in", { uid: user.uid, email: user.email });
  } else {
    whoEl.textContent = "";
    pfpEl.style.display = "none";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    log("onAuthStateChanged: signed-out");
  }
});

// 3) Button handlers
loginBtn.onclick = async () => {
  try {
    setPhase("redirecting");
    log("signInWithRedirect...");
    await signInWithRedirect(auth, provider);
  } catch (err) {
    log("signInWithRedirect error:", { code: err.code, message: err.message });
  }
};

logoutBtn.onclick = async () => {
  try {
    await signOut(auth);
    log("signOut ok");
  } catch (err) {
    log("signOut error:", { code: err.code, message: err.message });
  }
};
