
/* Mobile-first auth layer – ONLY login/logout wiring (no other features touched)
   Robust: wires handlers immediately + via delegation, and doesn't assume existing header button.
*/
import { auth, FB } from './firebase.js';

function qs(sel, el=document){ return el.querySelector(sel); }
function ce(tag, cls){ const el=document.createElement(tag); if(cls) el.className=cls; return el; }
function safeText(el, txt){ if(el) el.textContent = txt; }

// Ensure header has a primary auth button + (optional) user badge
function ensureHeaderAuth(){
  let header = qs('header');
  if(!header){ header = document.body; } // fallback
  let btn = qs('#btnLogin');
  if(!btn){
    btn = ce('button'); btn.id='btnLogin'; btn.className='btn primary';
    btn.textContent = 'התחברות';
    header.appendChild(btn);
  }
  let badge = qs('#userBadge');
  if(!badge){
    badge = ce('span'); badge.id='userBadge'; badge.style.display='none';
    badge.style.marginInlineStart = '8px';
    header.appendChild(badge);
  }
  return { btn, badge };
}

// Inject a minimal login screen if missing
function ensureLoginScreen(){
  if (qs('.login-screen')) return;
  const wrap = ce('div', 'login-screen');
  const card = ce('div', 'login-card');
  card.innerHTML = `
    <h1>כניסה לחשבון</h1>
    <label>
      אימייל
      <input id="authEmail" class="input" type="email" inputmode="email" autocomplete="email" placeholder="name@example.com" />
    </label>
    <label>
      סיסמה
      <input id="authPass" class="input" type="password" autocomplete="current-password" placeholder="••••••••" />
    </label>
    <div class="row">
      <button id="btnDoLogin" class="btn primary" style="flex:2">התחברות</button>
      <button id="btnDoSignup" class="btn" style="flex:1">הרשמה</button>
    </div>
    <button id="btnDoReset" class="btn" style="width:100%">איפוס סיסמה</button>
  `;
  wrap.appendChild(card);
  const hdr = qs('header');
  if (hdr && hdr.parentNode) hdr.parentNode.insertBefore(wrap, hdr.nextSibling);
  else document.body.appendChild(wrap);
}

// Wire the header primary button basic behavior (scroll to login when logged-out)
function wireAuthPrimaryButton(){
  const btn = qs('#btnLogin');
  if(!btn || btn.dataset.authWired==='1') return;
  btn.dataset.authWired='1';
  btn.addEventListener('click', (e)=>{
    const bodyLoggedOut = document.body.classList.contains('logged-out');
    if(bodyLoggedOut){
      e.preventDefault();
      const card = qs('.login-card');
      if(card && card.scrollIntoView) card.scrollIntoView({behavior:'smooth', block:'start'});
    }
  }, {passive:false});
}

// Attach direct handlers to the login form (idempotent)
function wireLoginFormDirect(){
  const email = qs('#authEmail');
  const pass  = qs('#authPass');
  const doLogin  = qs('#btnDoLogin');
  const doSignup = qs('#btnDoSignup');
  const doReset  = qs('#btnDoReset');

  function val(){ return { email: (email?.value||'').trim(), pass: pass?.value||'' }; }

  if(doLogin && !doLogin.dataset.wired){
    doLogin.dataset.wired='1';
    doLogin.addEventListener('click', async ()=>{
      const v = val();
      if(!v.email || !v.pass) return alert('נא למלא אימייל וסיסמה');
      try{ await FB.signInWithEmailAndPassword(auth, v.email, v.pass); }
      catch(e){ console.error(e); alert('כניסה נכשלה: '+(e.message||e.code||'')); }
    });
  }
  if(doSignup && !doSignup.dataset.wired){
    doSignup.dataset.wired='1';
    doSignup.addEventListener('click', async ()=>{
      const v = val();
      if(!v.email || !v.pass) return alert('נא למלא אימייל וסיסמה');
      try{ await FB.createUserWithEmailAndPassword(auth, v.email, v.pass); }
      catch(e){ console.error(e); alert('הרשמה נכשלה: '+(e.message||e.code||'')); }
    });
  }
  if(doReset && !doReset.dataset.wired){
    doReset.dataset.wired='1';
    doReset.addEventListener('click', async ()=>{
      const vEmail = (email?.value||'').trim();
      if(!vEmail) return alert('נא למלא אימייל לאיפוס');
      try{ await FB.sendPasswordResetEmail(auth, vEmail); alert('נשלח מייל לאיפוס סיסמה'); }
      catch(e){ console.error(e); alert('שגיאה באיפוס: '+(e.message||e.code||'')); }
    });
  }
}

// Add event delegation as a backup (handles dynamically replaced nodes)
function wireDelegation(){
  if(document.body.dataset.authDelegation==='1') return;
  document.body.dataset.authDelegation='1';
  document.addEventListener('click', async (ev)=>{
    const t = ev.target;
    if(!t) return;
    const id = t.id;
    const email = qs('#authEmail');
    const pass  = qs('#authPass');
    const vEmail = (email?.value||'').trim();
    const vPass  = pass?.value||'';
    try{
      if(id==='btnDoLogin'){
        ev.preventDefault();
        if(!vEmail || !vPass) return alert('נא למלא אימייל וסיסמה');
        await FB.signInWithEmailAndPassword(auth, vEmail, vPass);
      } else if(id==='btnDoSignup'){
        ev.preventDefault();
        if(!vEmail || !vPass) return alert('נא למלא אימייל וסיסמה');
        await FB.createUserWithEmailAndPassword(auth, vEmail, vPass);
      } else if(id==='btnDoReset'){
        ev.preventDefault();
        if(!vEmail) return alert('נא למלא אימייל לאיפוס');
        await FB.sendPasswordResetEmail(auth, vEmail);
        alert('נשלח מייל לאיפוס סיסמה');
      }
    }catch(e){
      console.error(e);
      alert((e && (e.message||e.code)) || 'שגיאת אימות');
    }
  }, {capture:true});
}

// Auth state handling
let __unsub;
function startAuthWatcher(){
  try{
    if(__unsub) try{ __unsub(); }catch(_){}
    __unsub = FB.onAuthStateChanged(auth, (user)=>{
      const { btn, badge } = ensureHeaderAuth();
      if(user){
        document.body.classList.remove('logged-out');
        safeText(btn, 'ניתוק');
        btn.classList.add('danger');
        // Fresh logout handler
        const clone = btn.cloneNode(true);
        btn.parentNode.replaceChild(clone, btn);
        clone.id = 'btnLogin';
        clone.classList.add('danger');
        clone.onclick = async (e)=>{
          e && e.preventDefault && e.preventDefault();
          try{ await FB.signOut(auth); }catch(e){ console.error(e); }
        };
        badge.style.display='inline-flex';
        safeText(badge, user.email || 'משתמש');
        const ls = qs('.login-screen'); if(ls) ls.style.display='none';
      } else {
        document.body.classList.add('logged-out');
        safeText(btn, 'התחברות');
        btn.classList.remove('danger');
        badge.style.display='none'; safeText(badge, '');
        const ls = qs('.login-screen'); if(ls) ls.style.display='';
        wireLoginFormDirect(); // ensure direct wiring while logged-out
      }
    });
  }catch(e){
    console.error('Auth watcher error', e);
    alert('שגיאה בטעינת אימות. ודא שהדומיין מורשה ב-Firebase ('+location.host+').');
  }
}

// Global error hook to surface early failures
window.addEventListener('error', (e)=>{
  try{
    const msg = (e && (e.message || (e.error && e.error.message))) || 'שגיאה לא ידועה';
    console.log('GlobalError:', msg);
  }catch(_){}
});

// Boot
document.addEventListener('DOMContentLoaded', ()=>{
  ensureHeaderAuth();
  ensureLoginScreen();
  wireAuthPrimaryButton();
  wireLoginFormDirect();    // wire immediately
  wireDelegation();         // + delegation safety net
  startAuthWatcher();
});
