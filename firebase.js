// Put your Firebase compat v8 sdk <script> tags in index.html normally.
// This file expects firebase compat already loaded globally.
// Provide your config + init + providers in this file.

// Example (replace with your real config):
// const firebaseConfig = { /* ... */ };
// firebase.initializeApp(firebaseConfig);

window.auth = window.auth || (firebase && firebase.auth && firebase.auth());
window.googleProvider = window.googleProvider || new firebase.auth.GoogleAuthProvider();
