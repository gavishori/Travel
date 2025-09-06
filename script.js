(function(){
  const $ = id => document.getElementById(id);
  const emailEl = $('emailInput');
  const passEl  = $('passwordInput');
  const errBox  = $('errorBox');

  function showError(msg){
    if(!errBox){ console.error(msg); return; }
    errBox.textContent = msg;
    errBox.style.opacity = 1;
    setTimeout(()=>{ errBox.style.opacity = 0; }, 4500);
  }

  const toggleBtn = $('togglePwdBtn');
  if(toggleBtn && passEl){
    toggleBtn.addEventListener('click', ()=>{
      passEl.type = (passEl.type === 'password') ? 'text' : 'password';
      toggleBtn.setAttribute('aria-pressed', passEl.type === 'text');
    });
  }

  const loginBtn = $('loginBtn');
  if(loginBtn){
    loginBtn.addEventListener('click', async ()=>{
      try{
        const email = (emailEl.value||'').trim();
        const pass  = passEl.value||'';
        if(!email || !pass) return showError('אנא מלא אימייל וסיסמה');
        await auth.signInWithEmailAndPassword(email, pass);
        location.reload();
      }catch(e){
        showError(mapAuthError(e));
      }
    });
  }

  const resetLink = $('resetLink');
  if(resetLink){
    resetLink.addEventListener('click', async (ev)=>{
      ev.preventDefault();
      try{
        const email = (emailEl.value||'').trim();
        if(!email) return showError('כתוב/י אימייל לפני איפוס');
        await auth.sendPasswordResetEmail(email);
        showError('קישור לאיפוס סיסמה נשלח למייל (בדוק/י דואר זבל)');
      }catch(e){
        showError(mapAuthError(e));
      }
    });
  }

  auth.onAuthStateChanged(u => {
    console.log('[auth] state:', !!u, u?.email || null);
  });

  function mapAuthError(e){
    const code = e?.code || '';
    switch(code){
      case 'auth/invalid-email': return 'האימייל אינו תקין';
      case 'auth/user-not-found':
      case 'auth/wrong-password': return 'אימייל או סיסמה שגויים';
      case 'auth/email-already-in-use': return 'האימייל כבר רשום';
      case 'auth/weak-password': return 'הסיסמה חלשה (לפחות 6 תווים)';
      case 'auth/network-request-failed': return 'שגיאת רשת – נסה שוב';
      default: return 'שגיאה: ' + (e?.message || code || 'לא ידועה');
    }
  }
})();