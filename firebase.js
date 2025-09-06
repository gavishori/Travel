(function(){
  try {
    const firebaseConfig = {
      apiKey: "AIzaSyArvkyWzgOmPjYYXUIOdilmtfrWt7WxK-0",
      authDomain: "travel-416ff.firebaseapp.com",
      projectId: "travel-416ff",
      storageBucket: "travel-416ff.appspot.com",
      messagingSenderId: "1075073511694",
      appId: "1:1075073511694:web:7876f492d18a702b09e75f",
      measurementId: "G-FT56H33X5J"
    };
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    window.db = firebase.firestore();
    window.auth = firebase.auth();

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const persistence = isIOS
      ? firebase.auth.Auth.Persistence.SESSION
      : firebase.auth.Auth.Persistence.LOCAL;
    auth.setPersistence(persistence).catch(e => console.warn('setPersistence', e?.code, e?.message));

    console.info('Firebase init (email/password) complete');
  } catch (e) {
    console.error('Firebase init error', e);
  }
})();