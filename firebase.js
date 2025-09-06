// ==== Firebase bootstrap (compat) with mobile-first auth UX ====
(function(){
  try {
    // --- Config ---
    window.firebaseConfig = window.firebaseConfig || {
      apiKey: "AIzaSyArvkyWzgOmPjYYXUIOdilmtfrWt7WxK-0",
      authDomain: "travel-416ff.firebaseapp.com",
      projectId: "travel-416ff",
      storageBucket: "travel-416ff.appspot.com",
      messagingSenderId: "1075073511694",
      appId: "1:1075073511694:web:7876f492d18a702b09e75f",
      measurementId: "G-FT56H33X5J"
    };

    if (!firebase || !firebase.apps) throw new Error('Firebase SDK not loaded');
    if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);

    // --- Helpers ---
    window.isIOS = window.isIOS || function(){
      try {
        var ua = navigator.userAgent || '';
        var iOS = /iPad|iPhone|iPod/.test(ua);
        var iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
        return iOS || iPadOS;
      } catch(e){ return false; }
    };

    var auth = firebase.auth();
    var db = (firebase.firestore && firebase.firestore()) || null;
    window.auth = auth;
    window.db = db;

    // --- Persistence: LOCAL everywhere, SESSION for iOS if needed ---
    var P = firebase.auth.Auth.Persistence;
    var persistence = window.isIOS() ? P.SESSION : P.LOCAL;
    auth.setPersistence(persistence).catch(function(e){
      console.warn('[auth] setPersistence failed', e && e.code, e && e.message);
    });

    // --- 7-day auto sign-out guard ---
    var WEEK = 7 * 24 * 60 * 60 * 1000;
    function shouldForceSignOut(){
      try{
        var last = Number(localStorage.getItem('lastLoginAt') || '0');
        return last && (Date.now() - last) > WEEK;
      }catch(e){ return false; }
    }

    // Resolve on first state (used elsewhere to wait for session restore)
    window.authReady = new Promise(function(resolve){
      var unsub = auth.onAuthStateChanged(function(user){
        try{
          if (user){
            localStorage.setItem('lastLoginAt', String(Date.now()));
            document.body.classList.add('auth-ok');
            document.body.classList.remove('auth-anon');
          } else {
            document.body.classList.remove('auth-ok');
            document.body.classList.add('auth-anon');
          }
        }catch(_){}
        if (unsub){ unsub(); }
        resolve(user || null);
      });
    });

    // Public ensureAuth: no UI pop-up here; just returns uid or null
    window.AppDataLayer = window.AppDataLayer || {};
    window.AppDataLayer.mode = 'firebase';
    window.AppDataLayer.db = db;
    window.AppDataLayer.ensureAuth = async function(){
      // wait for restore
      var u = await window.authReady;
      // enforce 7-day rule
      if (u && shouldForceSignOut()){
        try { await auth.signOut(); } catch(_){}
        u = null;
      }
      return (u && u.uid) || (auth.currentUser && auth.currentUser.uid) || null;
    };

    // --- Sign-in flows ---
    var googleProvider = new firebase.auth.GoogleAuthProvider();

    // Central entry; called from UI
    window.__attemptSignIn = async function(){
      var dlg = document.getElementById('emailAuthDialog');
      if (dlg && dlg.showModal) dlg.showModal();
    };

    // Wire email dialog controls
    function wireEmailAuth(){
      var dialog = document.getElementById('emailAuthDialog');
      if (!dialog) return;

      var emailEl = document.getElementById('email-auth-email');
      var passEl  = document.getElementById('email-auth-password');
      var loginBtn = document.getElementById('email-auth-login');
      var regBtn   = document.getElementById('email-auth-register');
      var resetBtn = document.getElementById('email-auth-reset');
      var closeBtn = document.getElementById('email-auth-close');
      var errorBox = document.getElementById('email-auth-error');

      function showErr(msg){
        if (!errorBox) return;
        errorBox.style.display = 'block';
        errorBox.textContent = msg || 'שגיאת התחברות';
      }
      function hideErr(){ if (errorBox) errorBox.style.display = 'none'; }

      async function signInEmail(){
        hideErr();
        try{
          await auth.signInWithEmailAndPassword(emailEl.value.trim(), passEl.value.trim());
          if (dialog.open) dialog.close();
        }catch(e){
          console.error('[auth] email sign-in', e);
          showErr(e && e.message || 'שגיאת התחברות');
        }
      }

      async function registerEmail(){
        hideErr();
        try{
          await auth.createUserWithEmailAndPassword(emailEl.value.trim(), passEl.value.trim());
          if (dialog.open) dialog.close();
        }catch(e){
          console.error('[auth] email register', e);
          showErr(e && e.message || 'שגיאת הרשמה');
        }
      }

      async function resetPass(){
        hideErr();
        try{
          await auth.sendPasswordResetEmail(emailEl.value.trim());
          alert('שלחנו קישור לאיפוס סיסמה למייל.');
        }catch(e){
          console.error('[auth] reset', e);
          showErr(e && e.message || 'שגיאת איפוס');
        }
      }

      function autoTry(){
        // Mobile UX: try automatically when נראה שהשדות מולאו
        var ok = (emailEl.value.indexOf('@')>0) && (passEl.value.length >= 6);
        if (ok) signInEmail();
      }

      if (emailEl && !emailEl.__wired){
        emailEl.__wired = true;
        emailEl.addEventListener('input', autoTry);
        emailEl.addEventListener('change', autoTry);
        emailEl.addEventListener('keyup', function(e){ if (e.key==='Enter') autoTry(); });
      }
      if (passEl && !passEl.__wired){
        passEl.__wired = true;
        passEl.addEventListener('input', autoTry);
        passEl.addEventListener('change', autoTry);
        passEl.addEventListener('keyup', function(e){ if (e.key==='Enter') autoTry(); });
      }
      if (loginBtn && !loginBtn.__wired){ loginBtn.__wired = true; loginBtn.addEventListener('click', signInEmail); }
      if (regBtn   && !regBtn.__wired){ regBtn.__wired   = true; regBtn.addEventListener('click', registerEmail); }
      if (resetBtn && !resetBtn.__wired){ resetBtn.__wired = true; resetBtn.addEventListener('click', resetPass); }
      if (closeBtn && !closeBtn.__wired){ closeBtn.__wired = true; closeBtn.addEventListener('click', function(){ if (dialog.open) dialog.close(); }); }
    }
    document.addEventListener('DOMContentLoaded', wireEmailAuth);

    console.info('Firebase init ok');
  } catch(e){
    console.error('Firebase init error – falling back to local', e);
    window.AppDataLayer = { mode: 'local', db: null };
  }
})(); 
