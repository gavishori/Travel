<script type="module">
  const { auth, api } = window.__FIREBASE__;
  const { isSignInWithEmailLink, sendSignInLinkToEmail, signInWithEmailLink, onAuthStateChanged, signOut } = api;

  const APP_REDIRECT = "/Travel/app/";

  const $ = (s,root=document)=>root.querySelector(s);
  const emailIpt   = $("#email");
  const sendBtn    = $("#sendLinkBtn");
  const logoutBtn  = $("#logoutBtn");
  const goAppBtn   = $("#goAppBtn");
  const authBadge  = $("#authBadge");
  const msgEl      = $("#msg");

  const actionCodeSettings = {
    url: location.origin + location.pathname,
    handleCodeInApp: true
  };

  function say(text, type="") {
    msgEl.className = "msg " + (type||"");
    msgEl.textContent = text;
  }

  $("#loginForm").addEventListener("submit", async (e)=>{
    e.preventDefault();
    const email = emailIpt.value.trim();
    if(!email){ emailIpt.focus(); return; }
    sendBtn.disabled = true; say("שולח לינק כניסה…");
    try{
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      localStorage.setItem("emailForSignIn", email);
      say("שלחנו לינק ל-" + email, "ok");
    }catch(err){
      console.error(err);
      say("שגיאה בשליחת הלינק: " + (err.code||err.message), "err");
    }finally{
      sendBtn.disabled = false;
    }
  });

  async function completeFromLinkIfNeeded(){
    if(isSignInWithEmailLink(auth, location.href)){
      say("מאמת לינק…");
      let email = localStorage.getItem("emailForSignIn");
      if(!email){
        email = prompt("הכניסו את כתובת האימייל שאיתה ביקשתם את הלינק:");
      }
      try{
        await signInWithEmailLink(auth, email, location.href);
        localStorage.removeItem("emailForSignIn");
        say("מחובר/ת כעת ✓", "ok");
        history.replaceState({}, "", location.pathname);
      }catch(err){
        console.error(err);
        say("שגיאה באימות הלינק: " + (err.code||err.message), "err");
      }
    }
  }

  onAuthStateChanged(auth, (user)=>{
    if(user){
      authBadge.textContent = user.email || "מחובר/ת";
      logoutBtn.hidden = false;
      goAppBtn.hidden  = false;
    }else{
      authBadge.textContent = "אורח/ת";
      logoutBtn.hidden = true;
      goAppBtn.hidden  = true;
    }
  });

  logoutBtn.addEventListener("click", async ()=>{
    logoutBtn.disabled = true;
    try {
      await signOut(auth);
      say("התנתקת בהצלחה.", "ok");
    } catch(err){
      console.error(err);
      say("שגיאה בהתנתקות: " + (err.code||err.message), "err");
    } finally {
      logoutBtn.disabled = false;
    }
  });

  goAppBtn.addEventListener("click", ()=>{ location.href = APP_REDIRECT; });

  completeFromLinkIfNeeded();
</script>
