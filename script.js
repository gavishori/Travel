
/* Mobile-first auth layer – ONLY login/logout wiring (no other features touched)
   - Injects a minimal login card (email/password)
   - Wires header primary button (#btnLogin) to logout when logged-in
   - Updates #userBadge with current user email
   - Body.logged-out hides the main container (CSS-only) without modifying desktop layout
*/
import { auth, FB } from './firebase.js';

// ---- Utilities ----
function qs(sel, el=document){ return el.querySelector(sel); }
function ce(tag, cls){ const el=document.createElement(tag); if(cls) el.className=cls; return el; }
function safeText(el, txt){ if(el) el.textContent = txt; }

// ---- Inject a minimal login screen if missing ----
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
    <p class="muted" style="margin:6px 0 0">טיפ: ב-Mobile אין זום/מסכים צפים. כל החלונות קבועים.</p>
  `;
  wrap.appendChild(card);
  // Insert right after header so header remains visible
  const hdr = qs('header');
  if (hdr && hdr.parentNode) hdr.parentNode.insertBefore(wrap, hdr.nextSibling);
  else document.body.appendChild(wrap);
}

// ---- Wire header primary auth button to toggle (login ↔ logout) UI state ----
function wireAuthPrimaryButton(){
  const btn = qs('#btnLogin');
  if(!btn || btn.dataset.authWired==='1') return;
  btn.dataset.authWired='1';
  btn.addEventListener('click', (e)=>{
    // When logged in the button performs logout (we attach handler dynamically on state change).
    // When logged out it just scrolls to the login card.
    const bodyLoggedOut = document.body.classList.contains('logged-out');
    if(bodyLoggedOut){
      e.preventDefault();
      const card = qs('.login-card');
      card?.scrollIntoView({behavior:'smooth', block:'start'});
    }
  }, {passive:true});
}

// ---- Attach login form handlers ----
function wireLoginForm(){
  const email = qs('#authEmail');
  const pass  = qs('#authPass');
  const doLogin  = qs('#btnDoLogin');
  const doSignup = qs('#btnDoSignup');
  const doReset  = qs('#btnDoReset');
  if(!email || !pass || !doLogin || !doSignup || !doReset) return;

  function val(){ return { email: (email.value||'').trim(), pass: pass.value||'' }; }

  doLogin.onclick = async ()=>{
    const v = val();
    if(!v.email || !v.pass) return alert('נא למלא אימייל וסיסמה');
    try{ await FB.signInWithEmailAndPassword(auth, v.email, v.pass); }
    catch(e){ console.error(e); alert('כניסה נכשלה: '+(e.message||e.code||'')); }
  };

  doSignup.onclick = async ()=>{
    const v = val();
    if(!v.email || !v.pass) return alert('נא למלא אימייל וסיסמה');
    try{ await FB.createUserWithEmailAndPassword(auth, v.email, v.pass); }
    catch(e){ console.error(e); alert('הרשמה נכשלה: '+(e.message||e.code||'')); }
  };

  doReset.onclick = async ()=>{
    const vEmail = (email.value||'').trim();
    if(!vEmail) return alert('נא למלא אימייל לאיפוס');
    try{ await FB.sendPasswordResetEmail(auth, vEmail); alert('נשלח מייל לאיפוס סיסמה'); }
    catch(e){ console.error(e); alert('שגיאה באיפוס: '+(e.message||e.code||'')); }
  };
}

// ---- Auth state handling (single source of truth) ----
let __unsub;
function startAuthWatcher(){
  if(__unsub) try{ __unsub(); }catch(_){}
  __unsub = FB.onAuthStateChanged(auth, (user)=>{
    const btn = qs('#btnLogin');
    const badge = qs('#userBadge');
    if(user){
      // Logged in
      document.body.classList.remove('logged-out');
      safeText(btn, 'ניתוק');
      btn?.classList.add('danger');
      // fresh handler: logout
      const clone = btn?.cloneNode(true);
      if(btn && clone){
        btn.parentNode.replaceChild(clone, btn);
        clone.id = 'btnLogin';
        clone.classList.add('danger');
        clone.onclick = async (e)=>{
          e?.preventDefault();
          try{ await FB.signOut(auth); }catch(e){ console.error(e); }
        };
      }
      if(badge){
        badge.style.display = 'inline-flex';
        safeText(badge, user.email || 'משתמש');
      }
      // Hide login screen
      const ls = document.querySelector('.login-screen'); if(ls) ls.style.display = 'none';
    } else {
      // Logged out
      document.body.classList.add('logged-out');
      if(btn){
        safeText(btn, 'התחברות');
        btn.classList.remove('danger');
      }
      if(badge){
        badge.style.display = 'none';
        safeText(badge, '');
      }
      const ls = document.querySelector('.login-screen'); if(ls) ls.style.display = '';
      wireLoginForm();
    }
  });
}

// ---- Boot ----
document.addEventListener('DOMContentLoaded', ()=>{
  ensureLoginScreen();
  wireAuthPrimaryButton();
  startAuthWatcher();
});
