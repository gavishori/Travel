
// === Firebase Auth Redirect-Only (stable across iOS) ===
(function(){
  try{
    if (!window.firebase) { console.error('Firebase SDK not loaded'); return; }

    // Use existing config if defined on page
    window.firebaseConfig = window.firebaseConfig || {
      apiKey: "AIzaSyArvkyWzgOmPjYYXUIOdilmtfrWt7WxK-0",
      authDomain: "travel-416ff.firebaseapp.com",
      projectId: "travel-416ff",
      storageBucket: "travel-416ff.appspot.com",
      messagingSenderId: "1075073511694",
      appId: "1:1075073511694:web:7876f492d18a702b09e75f",
      measurementId: "G-FT56H33X5J"
    };

    if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);

    var auth = firebase.auth();
    var provider = new firebase.auth.GoogleAuthProvider();
    try { provider.setCustomParameters({ prompt: 'select_account' }); } catch(_){}

    function setStatus(m){
      try { var s=document.getElementById('statusLine'); if(s) s.textContent=m||''; } catch(_){}
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

    // Session persistence is safest for redirect across platforms
    auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(function(){});

    // Handle redirect result once we come back from Google
    auth.getRedirectResult().then(function(res){
      if (res && res.user) {
        enterUI(res.user);
      }
    }).catch(function(e){
      setStatus((e && e.message) || String(e));
      console.error('redirect result error', e);
    });

    // Also take user if already signed in
    auth.onAuthStateChanged(function(u){ if (u) enterUI(u); });

    // Single-flight guard: a single redirect per click
    var inflight=false;
    window.startGoogleSignIn = function(){
      if (inflight) return;
      inflight = true;
      try {
        setStatus('');
        auth.signInWithRedirect(provider);
      } catch(e){
        inflight=false;
        setStatus((e && e.message) || String(e));
      }
    };

    // Defensive wiring for the button (in addition to inline)
    document.addEventListener('DOMContentLoaded', function(){
      var b = document.getElementById('googleSignInBtn');
      if (b && !b.__wired_redirect_only){
        b.__wired_redirect_only = true;
        b.addEventListener('click', function(ev){ /* inline handles; keep silent */ }, {passive:false});
      }
    });

    console.info('Firebase auth (redirect-only) ready');
  }catch(e){
    console.error('Auth init error', e);
  }
})();
