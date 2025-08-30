import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, onAuthStateChanged, signOut
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

// Helper functions for logging and UI
function log(...args) {
  const line = args.map(a => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  console.log(line);
  if (logEl) logEl.textContent += line + "\n";
}
function setPhase(p) { if (phaseEl) phaseEl.textContent = "phase: " + p; }

// Mobile detection
function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

if (uaEl) uaEl.textContent = navigator.userAgent;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

// Button handlers - try redirect first, popup as fallback
if (loginBtn) {
  loginBtn.onclick = async () => {
    try {
      setPhase("authenticating");
      log("Starting authentication...");
      log("User Agent:", navigator.userAgent);
      log("Current URL:", window.location.href);
      
      // Disable button to prevent multiple clicks
      loginBtn.disabled = true;
      loginBtn.textContent = "מתחבר...";
      
      // Always try redirect first (works better on mobile Chrome)
      log("Using redirect flow");
      await signInWithRedirect(auth, provider);
      
    } catch (err) {
      log("Authentication error:", { code: err.code, message: err.message });
      
      // Re-enable button
      loginBtn.disabled = false;
      loginBtn.textContent = "התחבר עם Google";
      
      // Try popup as fallback
      if (err.code === 'auth/redirect-cancelled-by-user' || 
          err.code === 'auth/unauthorized-domain' ||
          err.code === 'auth/operation-not-allowed') {
        try {
          log("Redirect failed, trying popup fallback...");
          const result = await signInWithPopup(auth, provider);
          log("Popup fallback success:", { uid: result.user.uid });
        } catch (popupErr) {
          log("Popup fallback failed:", { code: popupErr.code, message: popupErr.message });
          alert("התחברות נכשלה: " + popupErr.message);
        }
      } else {
        alert("התחברות נכשלה: " + err.message);
      }
    }
  };
}

if (logoutBtn) {
  logoutBtn.onclick = async () => {
    try {
      await signOut(auth);
      log("Signed out successfully");
    } catch (err) {
      log("signOut error:", { code: err.code, message: err.message });
      alert("התנתקות נכשלה: " + err.message);
    }
  };
}

// Main logic: handle redirect and auth state
setPhase("boot");
log("boot", new Date().toISOString());
log("Current URL:", window.location.href);
log("URL params:", window.location.search);

// Check if we're returning from OAuth redirect
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('code') || urlParams.get('state')) {
  log("Detected OAuth redirect parameters");
  setPhase("processing-redirect");
}

// 1) Handle redirect result first
getRedirectResult(auth)
  .then((result) => {
    if (result && result.user) {
      log("getRedirectResult -> success:", { uid: result.user.uid, email: result.user.email });
      setPhase("redirect-success");
      
      // Clean up URL parameters after successful auth
      if (window.history && window.history.replaceState) {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    } else {
      log("getRedirectResult -> no result");
    }
  })
  .catch((err) => {
    log("getRedirectResult error:", { code: err.code, message: err.message });
    setPhase("redirect-error");
    
    // If we have OAuth params but getRedirectResult failed, try manual refresh
    if (urlParams.get('code') || urlParams.get('state')) {
      log("OAuth params present but redirect failed, will retry...");
      setTimeout(() => {
        log("Retrying authentication...");
        window.location.reload();
      }, 2000);
    }
  })
  .finally(() => {
    // 2) Listen for auth state AFTER handling redirect
    onAuthStateChanged(auth, (user) => {
      if (user) {
        if (whoEl) whoEl.textContent = user.displayName ? `${user.displayName} · ${user.email}` : user.email || user.uid;
        if (pfpEl) { 
          pfpEl.src = user.photoURL || ''; 
          pfpEl.style.display = user.photoURL ? "block" : "none"; 
        }
        if (loginBtn) {
          loginBtn.style.display = "none";
          loginBtn.disabled = false;
          loginBtn.textContent = "התחבר עם Google";
        }
        if (logoutBtn) logoutBtn.style.display = "inline-block";
        log("onAuthStateChanged: signed-in", { uid: user.uid, email: user.email });
        setPhase("authenticated");
        document.body.classList.remove('splash-mode');
        document.body.classList.add('entered');
      } else {
        if (whoEl) whoEl.textContent = "";
        if (pfpEl) pfpEl.style.display = "none";
        if (loginBtn) {
          loginBtn.style.display = "inline-block";
          loginBtn.disabled = false;
          loginBtn.textContent = "התחבר עם Google";
        }
        if (logoutBtn) logoutBtn.style.display = "none";
        log("onAuthStateChanged: signed-out");
        setPhase("ready");
        document.body.classList.remove('entered');
        document.body.classList.add('splash-mode');
      }
    });
  });

// Add viewport meta tag for mobile if missing
if (!document.querySelector('meta[name="viewport"]')) {
  const viewport = document.createElement('meta');
  viewport.name = 'viewport';
  viewport.content = 'width=device-width, initial-scale=1';
  document.head.appendChild(viewport);
}
