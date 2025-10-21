const { app, auth, api } = window.__FIREBASE__;
const APP_REDIRECT = "./";

const $ = (s, r=document)=>r.querySelector(s);
const emailInput = $("#email");
const sendBtn = $("#sendBtn");
const msg = $("#msg");
const userBadge = $("#userBadge");
const logoutBtn = $("#logoutBtn");
const goAppBtn = $("#goAppBtn");

const actionCodeSettings = {
  url: location.origin + location.pathname,
  handleCodeInApp: true,
};

function say(text, type=""){
  msg.className = "msg " + type;
  msg.textContent = text;
}

$("#loginForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const email = emailInput.value.trim();
  if(!email){ say("נא להזין אימייל תקין.", "err"); return; }
  sendBtn.disabled = true;
  try{
    await api.sendSignInLinkToEmail(auth, email, actionCodeSettings);
    localStorage.setItem("emailForSignIn", email);
    say("שלחנו לינק ל‑" + email, "ok");
  }catch(err){
    console.error(err);
    say("שגיאה: " + (err.code||err.message), "err");
  }finally{
    sendBtn.disabled = false;
  }
});

async function completeFromLinkIfNeeded(){
  if(api.isSignInWithEmailLink(auth, location.href)){
    let email = localStorage.getItem("emailForSignIn");
    if(!email){
      email = prompt("אשר/י את האימייל אליו נשלח הלינק:");
      if(!email) return;
    }
    try{
      await api.signInWithEmailLink(auth, email, location.href);
      localStorage.removeItem("emailForSignIn");
      say("התחברת בהצלחה", "ok");
      history.replaceState({}, "", location.pathname);
    }catch(err){
      console.error(err);
      say("שגיאה בכניסה: " + (err.code||err.message), "err");
    }
  }
}

api.onAuthStateChanged(auth, (user)=>{
  if(user){
    userBadge.textContent = user.email || "מזוהה";
    logoutBtn.hidden = false;
    goAppBtn.hidden = false;
  }else{
    userBadge.textContent = "—/אורח";
    logoutBtn.hidden = true;
    goAppBtn.hidden = true;
  }
});

logoutBtn.addEventListener("click", async ()=>{
  logoutBtn.disabled = true;
  try{
    await api.signOut(auth);
    say("התנתקת", "ok");
  }catch(err){
    console.error(err);
    say("שגיאה: " + (err.code||err.message), "err");
  }finally{
    logoutBtn.disabled = false;
  }
});

goAppBtn.addEventListener("click", ()=>{ location.href = APP_REDIRECT; });

completeFromLinkIfNeeded();
