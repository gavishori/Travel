
// Mobile Auth Fallback — independent, click+touch safe
// Relies on window.FB and exported `auth`, `hardSignOut` from firebase.js
(function(){
  const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 820;

  function $(s){ return document.querySelector(s); }
  function on(el, ev, fn){ el && el.addEventListener(ev, fn, {passive:false}); }
  function bindTap(el, fn){
    if(!el) return;
    let locked = false;
    const wrap = async (e)=>{ if(locked) return; locked=true; try{ e?.preventDefault?.(); e?.stopPropagation?.(); await fn(e);} finally{ locked=false; } };
    on(el, 'click', wrap);
    on(el, 'touchend', wrap);
  }

  function show(el){ el && (el.style.display='flex'); }
  function hide(el){ el && (el.style.display='none'); }

  function setErr(msg){ const e = $('#mError'); if(e) e.textContent = msg||''; }

  async function doLogin(){
    const email = $('#mEmail')?.value?.trim();
    const pass  = $('#mPass')?.value||'';
    if(!email || !pass){ setErr('אנא מלא אימייל וסיסמה'); return; }
    setErr('מתחבר...');
    try{
      // extra safety: ensure we have FB & auth
      const FBNS = window.FB;
      const auth = window.auth || (FBNS && FBNS.auth);
      if(!FBNS || !auth || !FBNS.signInWithEmailAndPassword) throw new Error('Auth לא מאותחל');
      await FBNS.signInWithEmailAndPassword(auth, email, pass);
      setErr('');
    }catch(err){
      console.error('Mobile fallback login error:', err);
      setErr('שגיאה בהתחברות: ' + (err?.message||err));
    }
  }

  async function doLogout(){
    setErr('מתנתק...');
    try{
      if(typeof window.hardSignOut === 'function') await window.hardSignOut();
      else if(window.FB?.signOut && (window.auth||window.FB?.auth)) await window.FB.signOut(window.auth||window.FB.auth);
      setErr('נותק.');
      // small pause so listeners can flip UI
      setTimeout(()=>setErr(''), 600);
    }catch(err){
      console.error('Mobile fallback logout error:', err);
      setErr('שגיאה בהתנתקות');
    }
  }

  function wire(){
    const overlay = document.getElementById('mobileAuthOverlay');
    if(!overlay) return;
    bindTap(document.getElementById('mLogin'), doLogin);
    bindTap(document.getElementById('mLogout'), doLogout);
    const email = document.getElementById('mEmail');
    const pass  = document.getElementById('mPass');
    if(email && pass){
      const submitOnEnter = (ev)=>{ if(ev.key === 'Enter'){ ev.preventDefault(); doLogin(); } };
      email.addEventListener('keydown', submitOnEnter);
      pass.addEventListener('keydown', submitOnEnter);
    }

    // Watch auth state and show/hide
    try{
      const FBNS = window.FB;
      const auth = window.auth || (FBNS && FBNS.auth);
      FBNS?.onAuthStateChanged?.(auth, (u)=>{
        if(u){
          hide(overlay);
          document.body.dataset.authstate = 'in';
        }else{
          if(isMobile()) show(overlay);
          document.body.dataset.authstate = 'out';
        }
      });
    }catch(e){ console.warn('Auth observer failed (fallback still works manual):', e); }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();
