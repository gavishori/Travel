<script type=\"module\">
  const { app, auth, api } = window.__FIREBASE__ || {};
  const { isSignInWithEmailLink, sendSignInLinkToEmail, signInWithEmailLink, onAuthStateChanged, signOut } = api || {};

  const $ = (s, r = document) => r.querySelector(s);
  const emailInp  = $("#email1");
  const sendBtn   = $("#sendBtn");
  const msg       = $("#msg1");
  const authBadge = $("#authBadge");
  const logoutBtn = $("#logoutBtn");
  const goAppBtn  = $("#goAppBtn");

  function say(type, text) {
    if(!msg) return;
    msg.className = "msg mt-10 " + type;
    msg.textContent = text;
  }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = emailInp.value.trim();
    if (!email) { say("err", "נא להקליד אימייל"); return; }

    const actionCodeSettings = {
      url: location.origin + location.pathname,
      handleCodeInApp: true
    };

    sendBtn.disabled = true;
    try {
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      localStorage.setItem("emailForSignIn", email);
      say("ok", "לינק כניסה נשלח אל: " + email);
    } catch (err) {
      console.error(err);
      say("err", "שגיאה בשליחת לינק: " + (err?.code || err?.message || err));
    } finally {
      sendBtn.disabled = false;
    }
  });

  async function completeFromEmailLinkIfNeeded() {
    if (!isSignInWithEmailLink(auth, location.href)) return;
    let email = localStorage.getItem("emailForSignIn");
    if (!email) email = prompt("אשר/י אימייל אליו נשלח הלינק:");

    try {
      await signInWithEmailLink(auth, email, location.href);
      localStorage.removeItem("emailForSignIn");
      history.replaceState({}, "", location.pathname);
      say("ok", "התחברת בהצלחה");
    } catch (err) {
      console.error(err);
      say("err", "שגיאה באימות הלינק: " + (err?.code || err?.message || err));
    }
  }

  onAuthStateChanged(auth, (user) => {
    if (user) {
      authBadge.textContent = user.email || "מחובר/ת";
      goAppBtn.hidden = false;
      logoutBtn.hidden = false;
    } else {
      authBadge.textContent = "אורח/ת";
      goAppBtn.hidden = true;
      logoutBtn.hidden = true;
    }
  });

  logoutBtn.addEventListener("click", async () => {
    logoutBtn.disabled = true;
    try { await signOut(auth); say("ok", "נותקת בהצלחה"); }
    catch (err){ console.error(err); say("err", "שגיאה בהתנתקות: " + (err?.code||err?.message||err)); }
    finally { logoutBtn.disabled = false; }
  });

  goAppBtn.addEventListener("click", (e) => {
    e.preventDefault();
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  });

  completeFromEmailLinkIfNeeded();
</script>
