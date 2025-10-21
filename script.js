const { app, auth, api } = window.__FIREBASE__;
const { isSignInWithEmailLink, sendSignInLinkToEmail, signInWithEmailLink, onAuthStateChanged, signOut } = api;

const APP_REDIRECT = "/Travel/app/";

const $ = (s, r=document) => r.querySelector(s);
const emailEl = $("#email");
const sendBtn = $("#sendBtn");
const logoutBtn = $("#logoutBtn");
const goAppBtn = $("#goAppBtn");
const msgEl = $("#msg");
const userBadge = $("#userBadge");

const actionCodeSettings = {
  url: location.origin + APP_REDIRECT,
  handleCodeInApp: true
};

function say(text, type="") {
  msgEl.className = "msg" + (type? " "+type : "");
  msgEl.textContent = text;
  msgEl.style.display = "block";
}

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = (emailEl.value||"").trim();
  if(!email) { say("נא להזין אימייל", "err"); return; }
  sendBtn.disabled = true;
  try{
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem("emailForSignIn", email);
    say("שלחנו לינק ל־" + email, "ok");
  }catch(err){
    console.error(err);
    say("שגיאה: " + (err.code||err.message), "err");
  }finally{
    sendBtn.disabled = false;
  }
});

async function completeFromLinkIfNeeded(){
  if(isSignInWithEmailLink(auth, location.href)){
    let email = window.localStorage.getItem("emailForSignIn");
    if(!email){
      email = prompt("הזינו אימייל כדי להשלים כניסה");
      if(!email) return;
    }
    try{
      await signInWithEmailLink(auth, email, location.href);
      window.localStorage.removeItem("emailForSignIn");
      history.replaceState({}, "", location.pathname);
      say("התחברת!", "ok");
    }catch(err){
      console.error(err);
      say("שגיאה בהשלמת כניסה: " + (err.code||err.message), "err");
    }
  }
}

onAuthStateChanged(auth, (user)=>{
  if(user){
    userBadge.textContent = user.email || "מזוהה";
    logoutBtn.hidden = false;
    goAppBtn.hidden = false;
  }else{
    userBadge.textContent = "אורח/ת";
    logoutBtn.hidden = true;
    goAppBtn.hidden = true;
  }
});

logoutBtn.addEventListener("click", async ()=>{
  logoutBtn.disabled = true;
  try{
    await signOut(auth);
    say("נותקת בהצלחה", "ok");
  }catch(err){
    console.error(err);
    say("שגיאת התנתקות: " + (err.code||err.message), "err");
  }finally{
    logoutBtn.disabled = false;
  }
});

goAppBtn.addEventListener("click", ()=>{ location.href = APP_REDIRECT; });

completeFromLinkIfNeeded();
