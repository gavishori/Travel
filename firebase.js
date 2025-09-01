// Firebase init (compat)
window.firebaseConfig = {
  apiKey: "AIzaSyArvkyWzgOmPjYYXUIOdilmtfrWt7WxK-0",
  authDomain: "travel-416ff.firebaseapp.com",
  projectId: "travel-416ff",
  storageBucket: "travel-416ff.appspot.com",
  messagingSenderId: "1075073511694",
  appId: "1:1075073511694:web:7876f492d18a702b09e75f",
  measurementId: "G-FT56H33X5J"
};

(function(){
  if (!window._app) {
    window._app = firebase.initializeApp(window.firebaseConfig);
    window.auth = firebase.auth();
    window.db = firebase.firestore();
    auth.languageCode = 'he';
  }
})();