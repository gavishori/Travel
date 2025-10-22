// script.js
import { api, auth } from './firebase.js';

const $ = (s) => document.querySelector(s);
const emailInput = $('#emailInput');
const sendBtn = $('#sendBtn');
const msg = $('#msg');
const tabLink = $('#tab-link');
const tabPass = $('#tab-pass');
const paneLink = $('#pane-link');
const panePass = $('#pane-pass');
const passForm = $('#passForm');
const emailInputP = $('#emailInputP');
const passInput = $('#passInput');
const signUpBtn = $('#signUpBtn');

const APP_REDIRECT = new URL('./', location.href).href;

// Tabs
tabLink?.addEventListener('click', ()=>activate('link'));
tabPass?.addEventListener('click', ()=>activate('pass'));
function activate(which){
  const isLink = which === 'link';
  tabLink.classList.toggle('active', isLink);
  tabPass.classList.toggle('active', !isLink);
  paneLink.classList.toggle('active', isLink);
  panePass.classList.toggle('active', !isLink);
}

// Email Link flow
$('#loginForm')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = (emailInput?.value || '').trim();
  if(!email) return;

  sendBtn.disabled = true;
  say('שולח לינק...', 'info');
  const actionCodeSettings = { url: APP_REDIRECT, handleCodeInApp: true };

  try {
    await api.sendSignInLinkToEmail(auth, email, actionCodeSettings);
    localStorage.setItem('emailForSignIn', email);
    say('נשלח מייל. בדוק/י את הדואר ולחץ/י על הלינק.', 'ok');
  } catch(err) {
    console.error(err);
    const code = parseCode(err);
    if(code === 'auth/quota-exceeded'){
      say('חרגת ממכסת השליחה היומית. עוברים למצב סיסמה ↓', 'err');
      activate('pass');
      if(email && emailInputP) emailInputP.value = email;
    }else{
      say(humanize(err), 'err');
    }
  } finally { sendBtn.disabled = false; }
});

// Complete Email Link
async function completeIfNeeded(){
  if(api.isSignInWithEmailLink(auth, location.href)){
    let email = localStorage.getItem('emailForSignIn');
    if(!email){ email = prompt('נא לאשר את כתובת האימייל איתה התחברת:'); if(!email) return; }
    try{
      await api.signInWithEmailLink(auth, email, location.href);
      localStorage.removeItem('emailForSignIn');
      location.replace(APP_REDIRECT);
    }catch(err){ console.error(err); say(humanize(err), 'err'); }
  }
}
completeIfNeeded();

// Email+Password
passForm?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = (emailInputP?.value || '').trim();
  const pass = (passInput?.value || '').trim();
  if(!email || !pass) return;
  say('מתחבר...', 'info');
  try{
    await api.signInWithEmailAndPassword(auth, email, pass);
    say('התחברת בהצלחה.', 'ok');
  }catch(err){
    if(parseCode(err) === 'auth/invalid-credential'){
      say('משתמש לא קיים או סיסמה שגויה. אפשר ליצור משתמש חדש.', 'err');
    }else{
      say(humanize(err), 'err');
    }
  }
});

signUpBtn?.addEventListener('click', async ()=>{
  const email = (emailInputP?.value || '').trim();
  const pass = (passInput?.value || '').trim();
  if(!email || !pass){ say('נא למלא אימייל וסיסמה', 'err'); return; }
  say('יוצר משתמש...', 'info');
  try{
    await api.createUserWithEmailAndPassword(auth, email, pass);
    say('נוצר משתמש והתחברת.', 'ok');
  }catch(err){ say(humanize(err), 'err'); }
});

// helpers
function say(text, type='info'){ if(!msg) return; msg.className = 'msg ' + type; msg.textContent = text; }
function parseCode(err){ return (err && (err.code||'')).replace('Firebase: ','').replace(' (auth/', 'auth/').replace(').',''); }
function humanize(err){
  const code = parseCode(err);
  const map = {
    'auth/invalid-action-code':'הלינק אינו תקף/פג. בקש/י לינק חדש.',
    'auth/expired-action-code':'הלינק פג תוקף.',
    'auth/quota-exceeded':'חרגת ממכסת השליחה היומית של המיילים. נסה/י מחר או עבר/י לסיסמה.',
    'auth/network-request-failed':'שגיאת רשת.',
    'auth/invalid-email':'כתובת אימייל לא תקינה.',
  };
  return map[code] || (err?.message || 'שגיאה');
}
