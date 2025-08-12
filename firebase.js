// firebase.js - initialises Firebase and exports Firestore + Storage helpers
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";


// Firebase config from the user's project
const firebaseConfig = {
    apiKey: "AIzaSyArvkyWzgOmPjYYXUIOdilmtfrWt7WxK-0",
    authDomain: "travel-416ff.firebaseapp.com",
    projectId: "travel-416ff",
    storageBucket: "travel-416ff.appspot.com",
    messagingSenderId: "1075073511694",
    appId: "1:1075073511694:web:7876f492d18a702b09e75f",
    measurementId: "G-FT56H33X5J"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);


// Using a global variable for appId to be accessible throughout the app
const appId = "travel-416ff";

// Export the initialized services and appId
export { app, db, storage, auth, appId };
