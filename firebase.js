// ==== Firebase bootstrap (compat) with iOS redirect & tap-gate ====
(function(){
  try {
    // Firebase config must be defined
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

    window.db = firebase.firestore();
    window.auth = firebase.auth();
}catch(e){}

    // A utility function to detect if the user is on an iOS device.
    window.isIOS = window.isIOS || function(){
      try{ var ua=navigator.userAgent||''; return /iPad|iPhone|iPod/.test(ua) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1); }catch(e){ return false; }
    };

    // Use session persistence for iOS and local persistence for other platforms.
    var persistence = (window.isIOS&&window.isIOS()) ? firebase.auth.Auth.Persistence.SESSION : firebase.auth.Auth.Persistence.LOCAL;
    auth.setPersistence(persistence).catch(function(e){ console.warn('[auth] setPersistence failed', e&&e.code, e&&e.message); });

    // Check for a redirect result after sign-in.
    auth.getRedirectResult().then(function(res){
      if (res && res.user){ 
        console.log('[auth] redirect ok', res.user.uid); 
      }
    }).catch(function(e){
      console.error('[auth] redirect error: ', e);
    });

    // Public starter: must be called from the Google button (user gesture)
    window.startGoogleSignIn = function(){
        
    // Email/Password auth helpers
    window.emailAuth = window.emailAuth || {};
    window.emailAuth.signIn = function(email, password){
      return auth.signInWithEmailAndPassword(email, password);
    };
    window.emailAuth.signUp = function(email, password){
      return auth.createUserWithEmailAndPassword(email, password);
    };
    window.emailAuth.reset = function(email){
      return auth.sendPasswordResetEmail(email);
    };
        

    // The core sign-in logic
    
    // Email/Password auth helpers
    window.emailAuth = window.emailAuth || {};
    window.emailAuth.signIn = function(email, password){
      return auth.signInWithEmailAndPassword(email, password);
    };
    window.emailAuth.signUp = function(email, password){
      return auth.createUserWithEmailAndPassword(email, password);
    };
    window.emailAuth.reset = function(email){
      return auth.sendPasswordResetEmail(email);
    };
        

    // DataLayer surface
    window.AppDataLayer = window.AppDataLayer || {}; /*__FALLBACK_LOCAL__*/
    window.AppDataLayer.mode = 'firebase';
    window.AppDataLayer.db = window.db;
    window.AppDataLayer.ensureAuth = async function(){ return (auth.currentUser && auth.currentUser.uid) || null; };
    window.emailAuth.signIn = function(email, password){
      return auth.signInWithEmailAndPassword(email, password);
    };
    window.emailAuth.signUp = function(email, password){
      return auth.createUserWithEmailAndPassword(email, password);
    };
    window.emailAuth.reset = function(email){
      return auth.sendPasswordResetEmail(email);
    };
        

    console.info('Firebase init complete');
  } catch(e){
    console.error('Firebase init error → local mode', e);
    window.AppDataLayer = { mode: 'local' };
  }
})();
