
// firebase.js - Fixed to avoid duplicate-app error
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
} else {
  firebase.app(); // Use existing app
}
