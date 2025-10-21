// firebase.js (ESM)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getAuth, isSignInWithEmailLink, sendSignInLinkToEmail,
  signInWithEmailLink, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";

export const firebaseConfig = {
  apiKey: "AIzaSyArvkyWzgOmPjYYXUIOdilmtfrWt7WxK-0",
  authDomain: "travel-416ff.firebaseapp.com",
  projectId: "travel-416ff",
  storageBucket: "travel-416ff.firebasestorage.app",
  messagingSenderId: "1075073511694",
  appId: "1:1075073511694:web:7876f492d18a702b09e75f",
  measurementId: "G-FT56H33X5J"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const api = { isSignInWithEmailLink, sendSignInLinkToEmail, signInWithEmailLink, onAuthStateChanged, signOut, auth };
