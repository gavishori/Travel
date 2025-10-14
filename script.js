
/* Bulletproof Auth layer (login/logout only)
   - Global handlers via window.__AUTH_DO to avoid any listener issues
   - Visible debug panel
   - Works even if header/login DOM is re-rendered
*/
import { auth, FB } from './firebase.js';

function qs(sel, el=document){ return el.querySelector(sel); }
function ce(tag, cls){ const el=document.createElement(tag); if(cls) el.className=cls; return el; }
function safeText(el, txt){ if(el) el.textContent = txt; }

// ---- Debug panel ----
function ensureDebug(){
  if(qs('#authDebug')) return;
  const box = ce('div'); box.id='authDebug';
  box.style.cssText='position:fixed;inset:auto 8px 8px auto;max-width:70vw;background:#111c;padding:10px 12px;border-radius:10px;color:#fff;font:12px/1.4 system-ui;z-index:9999;opacity:.92;display:none;direction:rtl;';
  box.innerHTML = '<div style="font-weight:700;margin-bottom:6px">Auth Debug</div><div id="authDebugBody"></div>';
  document.body.appendChild(box);
}
function dbg(msg){
  ensureDebug();
  const body = qs('#authDebugBody');
  if(body){
    const line = ce('div');
    line.textContent = (new Date()).toLocaleTimeString() + ' — ' + msg;
    body.prepend(line);
    qs('#authDebug').style.display='block';
  }
  console.log('[AUTH]', msg);
}

// ---- Header auth UI (idempotent) ----
function ensureHeaderAuth(){
  let header = qs('header') || document.body;
  let btn = qs('#btnLogin');
  if(!btn){
    btn = ce('button'); btn.id='btnLogin'; btn.className='btn primary';
    btn.textContent = 'התחברות';
    btn.setAttribute('onclick', "window.__AUTH_DO && window.__AUTH_DO('scrollToLogin')");
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

// ---- Login screen (idempotent) ----
function ensureLoginScreen(){
  if (qs('.login-screen')) return;
  const wrap = ce('div', 'login-screen');
  const card = ce('div', 'login-card');
  card.innerHTML = `
    <h1>כניסה לחשבון</h1>
    <label>אימייל
      <input id="authEmail" class="input" type="email" inputmode="email" autocomplete="email" placeholder="name@example.com" />
    </label>
    <label>סיסמה
      <input id="authPass" class="input" type="password" autocomplete="current-password" placeholder="••••••••" />
    </label>
    <div class="row">
      <button id="btnDoLogin" class="btn primary" style="flex:2" onclick="window.__AUTH_DO && window.__AUTH_DO('login')">התחברות</button>
      <button id="btnDoSignup" class="btn" style="flex:1" onclick="window.__AUTH_DO && window.__AUTH_DO('signup')">הרשמה</button>
    </div>
    <button id="btnDoReset" class="btn" style="width:100%" onclick="window.__AUTH_DO && window.__AUTH_DO('reset')">איפוס סיסמה</button>
  `;
  wrap.appendChild(card);
  const hdr = qs('header');
  if (hdr && hdr.parentNode) hdr.parentNode.insertBefore(wrap, hdr.nextSibling);
  else document.body.appendChild(wrap);
}

// ---- Global action dispatcher ----
window.__AUTH_DO = async function(action){
  try{
    dbg('action='+action);
    if(action==='scrollToLogin'){
      if(document.body.classList.contains('logged-out')){
        qs('.login-card')?.scrollIntoView({behavior:'smooth', block:'start'});
      } else {
        // act as logout when logged-in
        await FB.signOut(auth);
        dbg('signed out');
      }
      return;
    }
    const email = (qs('#authEmail')?.value || '').trim();
    const pass  = (qs('#authPass')?.value || '');
    if(action==='login'){
      if(!email || !pass) return alert('נא למלא אימייל וסיסמה');
      await FB.signInWithEmailAndPassword(auth, email, pass);
      dbg('login request sent');
    } else if(action==='signup'){
      if(!email || !pass) return alert('נא למלא אימייל וסיסמה');
      await FB.createUserWithEmailAndPassword(auth, email, pass);
      dbg('signup request sent');
    } else if(action==='reset'){
      if(!email) return alert('נא למלא אימייל לאיפוס');
      await FB.sendPasswordResetEmail(auth, email);
      alert('נשלח מייל לאיפוס סיסמה');
      dbg('reset email sent');
    }
  }catch(e){
    console.error(e);
    dbg('ERROR: '+(e.message||e.code||e));
    alert((e && (e.message||e.code)) || 'שגיאת אימות');
  }
};

// ---- Auth state handling ----
let __unsub;
function startAuthWatcher(){
  if(__unsub) try{ __unsub(); }catch(_){}
  __unsub = FB.onAuthStateChanged(auth, (user)=>{
    const { btn, badge } = ensureHeaderAuth();
    if(user){
      document.body.classList.remove('logged-out');
      safeText(btn, 'ניתוק');
      btn.classList.add('danger');
      btn.setAttribute('onclick', "window.__AUTH_DO && window.__AUTH_DO('scrollToLogin')");
      badge.style.display='inline-flex';
      safeText(badge, user.email || 'משתמש');
      const ls = qs('.login-screen'); if(ls) ls.style.display='none';
      dbg('AUTH OK: '+(user.email||''));
    } else {
      document.body.classList.add('logged-out');
      safeText(btn, 'התחברות');
      btn.classList.remove('danger');
      badge.style.display='none'; safeText(badge, '');
      const ls = qs('.login-screen'); if(ls) ls.style.display='';
      dbg('AUTH: logged-out');
    }
  });
}

// ---- Boot ----
document.addEventListener('DOMContentLoaded', ()=>{
  ensureDebug();
  ensureHeaderAuth();
  ensureLoginScreen();
  startAuthWatcher();
  dbg('booted');
});
