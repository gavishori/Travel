// Minimal Firebase wrapper (no trailing commas, ES2015-safe)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, setPersistence, browserLocalPersistence, browserSessionPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, setLogLevel, query, where, orderBy, limit, startAfter, serverTimestamp, deleteDoc, doc, getDoc, setDoc, updateDoc, onSnapshot, collection, addDoc, getDocs, enableNetwork, disableNetwork } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyArvkyWzgOmPjYYXUIOdilmtfrWt7WxK-0",
  authDomain: "travel-416ff.firebaseapp.com",
  projectId: "travel-416ff",
  storageBucket: "travel-416ff.appspot.com",
  messagingSenderId: "1032412697405",
  appId: "1:1032412697405:web:44c9d7c6c220a3e4a8e3a7"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true, experimentalAutoDetectLongPolling: true });
setLogLevel("error");
try { setPersistence(auth, browserLocalPersistence).catch(function(){ return setPersistence(auth, browserSessionPersistence); }); } catch(e) {}

export const FB = {
  app: app,
  auth: auth,
  db: db,
  onAuthStateChanged: onAuthStateChanged,
  signInWithEmailAndPassword: signInWithEmailAndPassword,
  createUserWithEmailAndPassword: createUserWithEmailAndPassword,
  sendPasswordResetEmail: sendPasswordResetEmail,
  signOut: signOut,
  doc: doc,
  getDoc: getDoc,
  setDoc: setDoc,
  updateDoc: updateDoc,
  collection: collection,
  addDoc: addDoc,
  getDocs: getDocs,
  onSnapshot: onSnapshot,
  query: query,
  where: where,
  orderBy: orderBy,
  limit: limit,
  startAfter: startAfter,
  serverTimestamp: serverTimestamp,
  deleteDoc: deleteDoc
};

export { onAuthStateChanged as onAuth };
