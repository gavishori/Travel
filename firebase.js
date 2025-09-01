// --- iOS-safe Firebase Auth + Data Layer bootstrap ---

window.firebaseConfig = {
  apiKey: "AIzaSyArvkyWzgOmPjYYXUIOdilmtfrWt7WxK-0",
  authDomain: "travel-416ff.firebaseapp.com",
  projectId: "travel-416ff",
  storageBucket: "travel-416ff.appspot.com",
  messagingSenderId: "1075073511694",
  appId: "1:1075073511694:web:7876f492d18a702b09e75f",
  measurementId: "G-FT56H33X5J"
};

// Log messages to an on-screen div for debugging on mobile
function logToScreen(message) {
  let logEl = document.getElementById('debug-log');
  if (!logEl) {
    logEl = document.createElement('div');
    logEl.id = 'debug-log';
    logEl.style.position = 'fixed';
    logEl.style.bottom = '10px';
    logEl.style.left = '10px';
    logEl.style.width = '90%';
    logEl.style.maxHeight = '200px';
    logEl.style.overflowY = 'auto';
    logEl.style.background = 'rgba(0, 0, 0, 0.8)';
    logEl.style.color = 'white';
    logEl.style.padding = '10px';
    logEl.style.border = '1px solid #ccc';
    logEl.style.borderRadius = '5px';
    logEl.style.zIndex = '99999';
    logEl.style.fontFamily = 'monospace';
    logEl.style.fontSize = '12px';
    logEl.style.direction = 'ltr';
    document.body.appendChild(logEl);
  }
  const timestamp = new Date().toLocaleTimeString('en-US');
  logEl.innerHTML += `<span>[${timestamp}] ${message}</span><br>`;
  logEl.scrollTop = logEl.scrollHeight;
}


(function initFirebase(){
  const hasConfig = window.firebaseConfig && window.firebaseConfig.apiKey;
  if (!hasConfig){
    logToScreen("Firebase config missing -> running in local mode (localStorage).");
    window.AppDataLayer = { mode: "local" };
    return;
  }

  try{
    firebase.initializeApp(window.firebaseConfig);
    const db = firebase.firestore();
    window.AppDataLayer = { mode: "firebase", db };
    logToScreen("Firebase initialized.");
  }catch(err){
    logToScreen("Firebase init error -> fallback to local mode: " + (err.message || err));
    window.AppDataLayer = { mode: "local" };
  }
})();

(function bootstrapAuth(){
  var isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
              (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
  logToScreen("Platform detected: " + (isiOS ? "iOS" : "Non-iOS"));

  try {
    window.auth = firebase.auth();
    window.googleProvider = new firebase.auth.GoogleAuthProvider();
    logToScreen("Auth and Google provider configured.");
    
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(e){
      logToScreen('[auth] setPersistence failed: ' + (e.code || '') + ' ' + (e.message || ''));
    });
  } catch(e){
    logToScreen('[auth] init early failed: ' + (e.message || e));
  }

  var FLAG = 'authRedirectPending';

  // This block is the crucial change. It runs on every page load to check for a redirect result.
  // We wrap it in a function and call it immediately to ensure it's not missed.
  async function handleRedirectResult() {
      try {
          const result = await auth.getRedirectResult();
          if (result.user) {
              logToScreen('[auth] redirect result OK: ' + result.user.uid);
              // Clear the flag ONLY if a user was successfully authenticated.
              sessionStorage.removeItem(FLAG);
              // The onAuthStateChanged listener will now handle the rest.
          } else if (sessionStorage.getItem(FLAG)) {
              // If there's a flag but no user, something went wrong. Clear the flag to allow a new attempt.
              logToScreen('[auth] No user after redirect, clearing flag to allow new sign-in attempt.');
              sessionStorage.removeItem(FLAG);
          } else {
              logToScreen('[auth] No redirect result or user.');
          }
      } catch(err) {
          logToScreen('[auth] redirect error: ' + (err.code || '') + ' ' + (err.message || ''));
          // Clear the flag on error to allow a new sign-in attempt.
          sessionStorage.removeItem(FLAG);
      }
  }
  handleRedirectResult();


  window.__attemptSignIn = async function(){
    try{
      if (!window.auth) {
        logToScreen('[auth] not ready yet, skipping sign-in.');
        return;
      }
      
      if (sessionStorage.getItem(FLAG)) {
        logToScreen('[auth] redirect already pending, skip.');
        return;
      }

      if (isiOS) {
        logToScreen('[auth] iOS detected, attempting signInWithRedirect.');
        sessionStorage.setItem(FLAG, '1');
        await auth.signInWithRedirect(googleProvider);
        return;
      }

      try{
        logToScreen('[auth] Non-iOS, attempting signInWithPopup.');
        await auth.signInWithPopup(googleProvider);
      }catch(err){
        var code = err && err.code || '';
        var fallback = [
          'auth/popup-blocked',
          'auth/popup-closed-by-user',
          'auth/cancelled-popup-request',
          'auth/operation-not-supported-in-this-environment'
        ].indexOf(code) !== -1;
        if (fallback){
          logToScreen('[auth] Popup failed, falling back to signInWithRedirect.');
          sessionStorage.setItem(FLAG, '1');
          await auth.signInWithRedirect(googleProvider);
        } else {
          logToScreen('[auth] sign-in failed: ' + code + ' ' + (err && err.message || ''));
        }
      }
    }catch(e){
      sessionStorage.removeItem(FLAG);
      logToScreen('[auth] __attemptSignIn fatal: ' + (e.message || e));
    }
  };
})();