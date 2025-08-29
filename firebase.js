// firebase.js (modular v10) – שים כאן את ההגדרות האמיתיות שלך
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

for (const [k,v] of Object.entries(firebaseConfig)) {
  if (String(v).includes("YOUR_")) {
    alert("⚠️ לא הוגדר firebaseConfig אמיתי. פתח firebase.js ועדכן את הערכים.");
    throw new Error("Missing firebaseConfig");
  }
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });
console.log("Firebase initialized.");
