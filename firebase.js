
// === Firebase Auth bootstrap: iOS-stable (Google) ===
(function(){
  try{
    // Expect global firebase SDK already loaded by the page.
    if (!window.firebase) { console.error('Firebase SDK not loaded'); return; }

    // Keep existing config if page defines it; otherwise use project defaults.
    window.firebaseConfig = window.firebaseConfig || {
      apiKey: "AIzaSyArvkyWzgOmPjYYXUIOdilmtfrWt7WxK-0",
      authDomain: "travel-416ff.firebaseapp.com",
      projectId: "travel-416ff",
      storageBucket: "travel-416ff.appspot.com",
      messagingSenderId: "1075073511694",
      appId: "1:1075073511694:web:7876f492d18a702b09e75f",
      measurementId: "G-FT56H33X5J"
    };

    // Initialize app once
    if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);

    var auth = firebase.auth();
    var provider = new firebase.auth.GoogleAuthProvider();
    try { provider.setCustomParameters({ prompt: 'select_account' }); } catch(_){}

    // Helpers
    function setStatus(msg){
      try{ var s=document.getElementById('statusLine'); if(s) s.textContent = msg||''; }catch(_){}
    }
    function enterUI(user){
      try{
        document.body.classList.add('entered');
        document.body.classList.remove('splash-mode');
        var app=document.getElementById('app'); if(app) app.style.display='block';
        var splash=document.getElementById('splash'); if(splash) splash.style.display='none';
        setStatus('');
      }catch(_){}
    }

    // Persistence: iOS -> SESSION; others -> LOCAL with fallback to SESSION
    (function(){
      var isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      try{
        if (isiOS) {
          auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(function(){});
        } else {
          auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(){
            return auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
          });
        }
      }catch(_){}
    })();

    // Handle redirect result (iOS) and auth state
    auth.getRedirectResult().then(function(res){
      if (res && res.user) enterUI(res.user);
    }).catch(function(e){ setStatus(e && e.message || String(e)); });

    auth.onAuthStateChanged(function(u){
      if (u) enterUI(u);
    });

    // Single-flight sign-in
    var inflight = false;
    window.startGoogleSignIn = function(){
      if (inflight) return;
      inflight = true;
      var isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      var p = isiOS ? auth.signInWithRedirect(provider)
                    : auth.signInWithPopup(provider);
      p.catch(function(e){ setStatus(e && e.message || String(e)); })
       .finally(function(){ setTimeout(function(){ inflight=false; }, 4000); });
    };

    // Wire button once
    document.addEventListener('DOMContentLoaded', function(){
      var btn = document.getElementById('googleSignInBtn');
      if (btn && !btn.__wired_once){
        btn.__wired_once = true;
        btn.addEventListener('click', function(e){ e.preventDefault(); startGoogleSignIn(); }, {passive:false});
      }
    });

    console.info('Firebase auth (iOS-stable Google) ready');
  }catch(e){
    console.error('Auth init error', e);
  }
})();
