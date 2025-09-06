import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { app } from "./firebase.js";

const auth = getAuth(app);

document.getElementById("createAccountBtn").addEventListener("click", async () => {
  const email = document.getElementById("regEmail").value;
  const password = document.getElementById("regPassword").value;
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    document.getElementById("registerMsg").innerText = "החשבון נוצר בהצלחה! עכשיו תוכל להתחבר.";
  } catch (err) {
    document.getElementById("registerMsg").innerText = "שגיאה: " + err.message;
  }
});
