// ----- Firebase bootstrap -----
// פרטי הפרויקט שלך. אין כאן סודות — מפתח ה־Web של Firebase הוא ציבורי.
const firebaseConfig = {
  apiKey: "AIzaSyArvkyWzgOmPjYYXUIOdilmfrWtrWvXK-0", // מה-Console (Web API Key)
  authDomain: "travel-416ff.firebaseapp.com",
  projectId: "travel-416ff",
  storageBucket: "travel-416ff.appspot.com"
  // messagingSenderId / appId אינם הכרחיים ל־Auth/Firestore וניתן להוסיף בהמשך.
};

if (!firebaseConfig || !firebaseConfig.apiKey) {
  console.error("No Firebase config → local mode");
} else {
  firebase.initializeApp(firebaseConfig);
  // זמינים לכל הסקריפטים
  window.auth = firebase.auth();
  window.googleProvider = new firebase.auth.GoogleAuthProvider();
  window.db = firebase.firestore();
}
