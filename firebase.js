// firebase.js — ES module that initializes Firebase and exports handles
// Auto-filled from your provided credentials.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, query, where, orderBy, onSnapshot,
  doc, getDoc, setDoc, updateDoc, deleteField
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyArvkyWzgOmPjYYXUIOdilmtfrWt7WxK-0",
  authDomain: "travel-416ff.firebaseapp.com",
  projectId: "travel-416ff",
  storageBucket: "travel-416ff.appspot.com",
  messagingSenderId: "1075073511694",
  appId: "1:1075073511694:web:7876f492d18a702b09e75f",
  measurementId: "G-FT56H33X5J"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Re-export helpers for convenience
export const FB = {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut, collection, query, where, orderBy,
  onSnapshot, doc, getDoc, setDoc, updateDoc, deleteField
};
