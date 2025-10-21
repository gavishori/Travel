import { api, auth } from './firebase.js';

const $ = (s, r=document) => r.querySelector(s);
const form = $('#loginForm');
const email = $('#email');
const sendBtn = $('#sendBtn');
const msgEl = $('#msg');

const say = (t, type='ok') => {
  msgEl.textContent = t;
  msgEl.className = 'msg ' + type;
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const address = (email.value || '').trim();
  if (!address) return email.focus();
  sendBtn.disabled = true; say('שולח לינק...');

  try {
    const appUrl = new URL('./app.html', location.href).href;
    const actionCodeSettings = { url: appUrl, handleCodeInApp: true };
    await api.sendSignInLinkToEmail(auth, address, actionCodeSettings);
    localStorage.setItem('emailForSignIn', address);
    say('נשלח! בדקו מייל.', 'ok');
  } catch (err) {
    say(err.message || String(err), 'err');
  } finally {
    sendBtn.disabled = false;
  }
});
