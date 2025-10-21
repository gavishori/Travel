// script.js
import { api, auth } from './firebase.js';

const $ = (s) => document.querySelector(s);
const emailInput = $('#emailInput');
const sendBtn = $('#sendBtn');
const msg = $('#msg');

// ✅ Redirect to the *current directory* so it also works on GitHub Project Pages (/repo/)
const APP_REDIRECT = new URL('./', location.href).href;

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
    say(cleanErr(err), 'err');
  } finally { sendBtn.disabled = false; }
});

async function completeIfNeeded(){
  if(api.isSignInWithEmailLink(auth, location.href)){
    let email = localStorage.getItem('emailForSignIn');
    if(!email){ email = prompt('נא לאשר את כתובת האימייל איתה התחברת:'); if(!email) return; }
    try{
      await api.signInWithEmailLink(auth, email, location.href);
      localStorage.removeItem('emailForSignIn');
      // strip the action parameters and stay on the same page
      location.replace(APP_REDIRECT);
    }catch(err){ console.error(err); say(cleanErr(err), 'err'); }
  }
}
completeIfNeeded();

function say(text, type='info'){ if(!msg) return; msg.className = 'msg ' + type; msg.textContent = text; }
function cleanErr(err){ return (err && (err.message||err.code)) || 'שגיאה'; }
