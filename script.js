// script.js – Redirect only + In-App browser guard + on-screen logs
(function(){
  const auth = firebase.auth();
  const provider = new firebase.auth.GoogleAuthProvider();

  const $ = (id)=>document.getElementById(id);
  const el = {
    login: $("login"),
    logout: $("logout"),
    debug: $("debug"),
    signedIn: $("signed-in"),
    signedOut: $("signed-out"),
    name: $("displayName"),
    email: $("email"),
    avatar: $("avatar"),
    status: $("status"),
    logs: $("logs"),
    iab: $("iab-warning"),
  };

  const log = (m)=>{ el.logs.textContent += (m + "\n"); };
  const setStatus = (m)=>{ el.status.textContent = m || ""; };

  function isInAppBrowser(){
    const ua = navigator.userAgent || "";
    return /Instagram|FBAN|FBAV|FB_IAB|Line\/|Twitter|WhatsApp/i.test(ua);
  }

  if(isInAppBrowser()){
    el.iab.style.display = "block";
    log("In-App Browser detected. UA=" + navigator.userAgent);
  }

  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
      .catch(e=>log("setPersistence error: "+(e.code||e.message)));

  auth.getRedirectResult()
    .then((res)=>{
      log("getRedirectResult: " + (res && res.user ? "user ok" : "no user"));
    })
    .catch(e=>log("redirect error: " + (e.code || e.message)));

  el.login?.addEventListener("click", async ()=>{
    el.logs.textContent = "";
    setStatus("מתחבר...");
    try{
      if(isInAppBrowser()){
        setStatus("פתח/י את הקישור בדפדפן רגיל (Chrome/Safari)");
        log("Blocked sign-in in In-App browser");
        return;
      }
      await auth.signInWithRedirect(provider);
    }catch(err){
      log("login error: " + (err.code || err.message));
      setStatus("");
    }
  });

  el.logout?.addEventListener("click", async ()=>{
    try{ await auth.signOut(); }catch(e){ log("signOut error: " + (e.code||e.message)); }
  });

  el.debug?.addEventListener("click", ()=>{
    const u = auth.currentUser;
    alert(JSON.stringify({uid:u?.uid,email:u?.email,ua:navigator.userAgent}, null, 2));
  });

  auth.onAuthStateChanged((user)=>{
    log("onAuthStateChanged: " + (user ? "signed-in" : "signed-out"));
    if(user){
      el.signedOut.style.display = "none";
      el.signedIn.style.display = "flex";
      el.name.textContent = user.displayName || "Authenticated";
      el.email.textContent = user.email || "";
      el.avatar.src = user.photoURL || "https://ssl.gstatic.com/accounts/ui/avatar_2x.png";
      setStatus("מוכן.");
    }else{
      el.signedIn.style.display = "none";
      el.signedOut.style.display = "flex";
      setStatus("");
    }
  });

  log("boot " + new Date().toISOString());
  log("UA: " + navigator.userAgent);
})();
