import {
  getAuth, GoogleAuthProvider,
  signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth();
const provider = new GoogleAuthProvider();

const $ = (id) => document.getElementById(id);
const logs = $("logs");
const statusEl = $("status");

function log(s){ if(logs) logs.textContent += s + "\n"; else console.log(s); }
function setStatus(s){ if(statusEl) statusEl.textContent = s || ""; }

function isMobile(){
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

// UI elements
const loginBtn = $("loginBtn");
const logoutBtn = $("logoutBtn");
const signedOut = $("signedOut");
const signedIn = $("signedIn");
const displayName = $("displayName");
const email = $("email");
const avatar = $("avatar");

// Login handler
if (loginBtn){
  loginBtn.addEventListener("click", async () => {
    try{
      loginBtn.disabled = true;
      setStatus("מתחבר...");
      if (isMobile()){
        sessionStorage.setItem("auth_redirect","1");
        await signInWithRedirect(auth, provider);
      }else{
        await signInWithPopup(auth, provider);
      }
    }catch(e){
      log("login error: " + (e.code || e.message));
      setStatus("");
    }finally{
      loginBtn.disabled = false;
    }
  });
}

// Logout
if (logoutBtn){
  logoutBtn.addEventListener("click", async () => {
    try { await signOut(auth); } catch(e){ log("signOut error: " + (e.code||e.message)); }
  });
}

// After redirect (mobile)
getRedirectResult(auth)
  .then(res => { if (res && res.user) log("redirect OK"); })
  .catch(e => log("redirect error: " + (e.code||e.message)));

// Update UI on auth state
onAuthStateChanged(auth, async (user) => {
  if (!user && sessionStorage.getItem("auth_redirect")){
    try{
      const rr = await getRedirectResult(auth);
      if (rr && rr.user) user = rr.user;
    }catch(e){ log("redirectResult error: " + (e.code||e.message)); }
    sessionStorage.removeItem("auth_redirect");
  }

  if (user){
    signedOut.style.display = "none";
    signedIn.style.display = "block";
    displayName.textContent = user.displayName || "מחובר";
    email.textContent = user.email || "";
    avatar.src = user.photoURL || "https://ssl.gstatic.com/accounts/ui/avatar_2x.png";
    setStatus("מוכן.");
  } else {
    signedIn.style.display = "none";
    signedOut.style.display = "flex";
    setStatus("");
  }
});
