import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { app } from "./firebase.js";

const auth = getAuth(app);

document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "app.html";
  } catch (err) {
    alert("שגיאה בהתחברות: " + err.message);
  }
});

document.getElementById("forgotPassword").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  try {
    await sendPasswordResetEmail(auth, email);
    document.getElementById("resetMsg").innerText = "קישור לאיפוס סיסמה נשלח למייל (בדוק גם בספאם).";
  } catch (err) {
    alert("שגיאה בשליחת מייל איפוס: " + err.message);
  }
});

document.getElementById("registerBtn").addEventListener("click", () => {
  window.open("register.html", "_blank", "width=400,height=500");
});

document.getElementById("togglePassword").addEventListener("click", () => {
  const pwd = document.getElementById("password");
  pwd.type = pwd.type === "password" ? "text" : "password";
});
