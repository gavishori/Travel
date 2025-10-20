import { initAuth, sendMagicLink, completeSignInIfNeeded, hardLogout } from './firebase.js';
const emailEl = document.getElementById('email');
const sendBtn = document.getElementById('send');
const logoutBtn = document.getElementById('hardLogout');
const msgEl = document.getElementById('msg');
initAuth();
completeSignInIfNeeded(msgEl);
sendBtn.addEventListener('click', async () => {
  const email = (emailEl.value || '').trim();
  if (!email) { show('נא להזין אימייל.', true); return; }
  try {
    sendBtn.disabled = true;
    window.localStorage.setItem('emailForSignIn', email);
    await sendMagicLink(email);
    show('לינק נשלח! פתח את המייל מהמכשיר ולחץ על הקישור.', false, true);
  } catch (e) {
    console.error(e);
    show(`שגיאה בשליחת הלינק: ${e.message || e}`, true);
  } finally {
    sendBtn.disabled = false;
  }
});
logoutBtn.addEventListener('click', async () => {
  try {
    await hardLogout();
    show('בוצעה התנתקות מלאה ונוקה מטמון.', false, true);
    const u = new URL(window.location.href);
    u.searchParams.set('logout', Date.now());
    location.replace(u.toString());
  } catch (e) {
    console.error(e);
    show('שגיאה בהתנתקות: ' + (e.message || e), true);
  }
});
function show(text, isErr=false, persist=false){
  msgEl.textContent = text;
  msgEl.className = 'msg ' + (isErr ? 'error' : 'success');
  if (!persist) setTimeout(()=>{ msgEl.textContent=''; msgEl.className='msg'; }, 7000);
}