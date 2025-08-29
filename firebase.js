/* firebase.js — Firebase compat + aliases */
(function () {
  if (window.firebaseApp) return;

  const firebaseConfig = {
    apiKey: "AIzaSyArvkyWzgOmPjYYXUIOdilmtfrWt7WxK-0",
    authDomain: "travel-416ff.firebaseapp.com",
    projectId: "travel-416ff",
    storageBucket: "travel-416ff.appspot.com",
    messagingSenderId: "1075073511694",
    appId: "1:1075073511694:web:7876f492d18a702b09e75f",
    measurementId: "G-FT56H33X5J"
  };

  const app  = firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db   = firebase.firestore();

  window.firebaseApp    = app;
  window.firebaseAuth   = auth;
  window.firebaseDb     = db;
  window.googleProvider = new firebase.auth.GoogleAuthProvider();

  // legacy aliases
  window.auth     = auth;
  window.db       = db;
  window.provider = window.googleProvider;

  try {
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  } catch (e) {}

  console.log("Firebase initialized (compat).");
})();