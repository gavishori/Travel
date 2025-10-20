import { auth, sendMagicLink, completeMagicLinkIfNeeded, hardLogout } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

const APP_PATH = "./app/";  // שנה אם צריך

const emailInput = document.getElementById("email");
const sendBtn = document.getElementById("sendLinkBtn");
const logoutBtn = document.getElementById("logoutBtn");
const goBtn = document.getElementById("goAppBtn");
const statusEl = document.getElementById("status");

sendBtn.addEventListener("click", async () => {
  const email = (emailInput.value || "").trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){
    alert("נא להזין אימייל תקין");
    emailInput.focus();
    return;
  }
  sendBtn.disabled = true;
  try{
    await sendMagicLink(email);
  }catch(err){
    console.error(err);
    alert("שגיאה בשליחת לינק: " + (err.message || err));
  }finally{
    sendBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", hardLogout);
goBtn.addEventListener("click", () => { window.location.href = APP_PATH; });

await completeMagicLinkIfNeeded();

onAuthStateChanged(auth, (user) => {
  if (user){
    statusEl.textContent = "מחובר: " + (user.email || "");
    goBtn.style.display = "block";
  }else{
    statusEl.textContent = "לא מחובר";
    goBtn.style.display = "none";
  }
});
