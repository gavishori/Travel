(function(){
  const $ = id => document.getElementById(id);
  const emailEl = $('regEmail');
  const passEl  = $('regPass');
  const errBox  = $('regError');

  function showError(msg){
    if(!errBox){ console.error(msg); return; }
    errBox.textContent = msg;
    errBox.style.opacity = 1;
    setTimeout(()=>{ errBox.style.opacity = 0; }, 4500);
  }

  const toggleBtn = $('toggleRegPwdBtn');
  if(toggleBtn && passEl){
    toggleBtn.addEventListener('click', ()=>{
      passEl.type = (passEl.type === 'password') ? 'text' : 'password';
      toggleBtn.setAttribute('aria-pressed', passEl.type === 'text');
    });
  }

  const closeBtn = $('closeWin');
  if(closeBtn){
    closeBtn.addEventListener('click', (e)=>{ e.preventDefault(); window.close(); });
  }

  const regBtn = $('doRegister');
  if(regBtn){
    regBtn.addEventListener('click', async ()=>{
      try{
        const email = (emailEl.value||'').trim();
        const pass  = passEl.value||'';
        if(!email || !pass) return showError('אנא מלא אימייל וסיסמה');
        await auth.createUserWithEmailAndPassword(email, pass);
        alert('החשבון נוצר בהצלחה. ניתן לסגור חלון זה.');
      }catch(e){
        showError(mapAuthError(e));
      }
    });
  }

  function mapAuthError(e){
    const code = e?.code || '';
    switch(code){
      case 'auth/invalid-email': return 'האימייל אינו תקין';
      case 'auth/email-already-in-use': return 'האימייל כבר רשום';
      case 'auth/weak-password': return 'הסיסמה חלשה (לפחות 6 תווים)';
      case 'auth/network-request-failed': return 'שגיאת רשת – נסה שוב';
      default: return 'שגיאה: ' + (e?.message || code || 'לא ידועה');
    }
  }
})();