// Firebase compat init (השלם כאן את הקונפיג שלך)
// קבל את הפרטים מ- Firebase Console > Project settings
const firebaseConfig = {
  apiKey: "PUT_YOUR_KEY_HERE",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "0000000000",
  appId: "1:0000000000:web:00000000000000"
};

// אתחול האפליקציה
firebase.initializeApp(firebaseConfig);

// מופעים גלובליים
window.auth = firebase.auth();
window.googleProvider = new firebase.auth.GoogleAuthProvider();
window.db = firebase.firestore();
