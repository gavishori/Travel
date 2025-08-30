import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { firebaseConfig } from "./firebase.js";

// ---------- helpers ----------
const $ = (sel) => document.querySelector(sel);
const logEl = $("#log");
const phaseEl = $("#phase");
const whoEl = $("#who");
const pfpEl = $("#pfp");
const loginBtn = $("#loginBtn");
const logoutBtn = $("#logoutBtn");

const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isInApp = /(FBAN|FBAV|Instagram|WhatsApp|Messenger|Line|Twitter|TikTok)/i.test(navigator.userAgent);
const useRedirect = isIOS || isInApp; // <-- mobile in-app/iOS prefer redirect (popup gets blocked)

function log(...args){
  const line = args.map(a => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  console.debug("[app]", ...args);
  if (logEl) logEl.textContent += line + "\\n";
}
function setPhase(text){
  if (phaseEl) phaseEl.textContent = text;
}
function renderUser(user){
  if (!user){
    if (whoEl) whoEl.textContent = "";
    if (pfpEl) pfpEl.src = "";
    if (loginBtn) loginBtn.style.display = "";
    if (logoutBtn) logoutBtn.style.display = "none";
    document.body?.classList?.add("splash-mode");
    return;
  }
  if (whoEl) whoEl.textContent = user.displayName || user.email || user.uid;
  if (pfpEl && user.photoURL) pfpEl.src = user.photoURL;
  if (loginBtn) loginBtn.style.display = "none";
  if (logoutBtn) logoutBtn.style.display = "";
  document.body?.classList?.remove("splash-mode");
}

// ---------- init ----------
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// soft UX hint if opened inside in-app browser
if (isInApp){
  const note = document.createElement("div");
  note.style.cssText = "background:#241f2e;border:1px solid #3a2f4c;color:#e6e6ff;padding:10px;border-radius:10px;margin:10px 0;font-size:14px;";
  note.innerText = "טיפ: אם ההתחברות לא נפתחת, פתחו את הקישור בדפדפן חיצוני (⋯ ואז Open in Browser).";
  const btnWrap = loginBtn?.parentElement || document.body;
  btnWrap?.insertBefore(note, btnWrap.firstChild);
}

// Handle redirect result on page load (after returning from Google)
setPhase("initializing…");
getRedirectResult(auth).then((result)=>{
  if (result && result.user){
    log("getRedirectResult: success", { uid: result.user.uid });
    renderUser(result.user);
    setPhase("signed-in");
  }
}).catch((err)=>{
  // Often benign when coming from a fresh load
  log("getRedirectResult error:", { code: err.code, message: err.message });
});

// Auth state listener
onAuthStateChanged(auth, (user)=>{
  if (user){
    log("onAuthStateChanged: signed-in", { uid: user.uid });
    renderUser(user);
    setPhase("signed-in");
  } else {
    log("onAuthStateChanged: signed-out");
    renderUser(null);
    setPhase("ready");
  }
});

// ---------- actions ----------
loginBtn?.addEventListener("click", async () => {
  try{
    setPhase("signing-in…");
    if (useRedirect){
      log("Using redirect flow");
      await signInWithRedirect(auth, provider);
      // the page will navigate away; after return we handle it via getRedirectResult
    }else{
      log("Using popup flow");
      const result = await signInWithPopup(auth, provider);
      renderUser(result.user);
      setPhase("signed-in");
    }
  }catch(err){
    log("Sign-in error:", { code: err.code, message: err.message });
    setPhase("error");
  }
});

logoutBtn?.addEventListener("click", async () => {
  try{
    await signOut(auth);
    renderUser(null);
    setPhase("signed-out");
  }catch(err){
    log("Sign-out error:", { code: err.code, message: err.message });
    setPhase("error");
  }
});

// Ensure we have a viewport tag (defensive for some embedded contexts)
if (!document.querySelector('meta[name="viewport"]')) {
  const viewport = document.createElement('meta');
  viewport.name = 'viewport';
  viewport.content = 'width=device-width, initial-scale=1, user-scalable=no';
  document.head.appendChild(viewport);
}
