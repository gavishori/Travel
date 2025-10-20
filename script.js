// script.js — לוגיקה של כפתורים
import { FB, sendMagicLink, hardSignOut } from './firebase.js';

export function initUI(){
  const $ = s => document.querySelector(s);
  const emailEl = $('#email');
  const msg = $('#msg');
  const sendBtn = $('#sendLink');
  const logoutBtn = $('#hardLogout');

  sendBtn.addEventListener('click', async () => {
    const email = (emailEl.value||'').trim();
    if(!email) { msg.textContent = 'נא להזין אימייל'; return; }
    try{
      sendBtn.disabled = true;
      await FB.ensurePersistence();
      await sendMagicLink(email, FB.APP_BASE);
      msg.textContent = 'שלחנו לינק כניסה לאימייל. פתח/י מהנייד והכניסה תאושר.';
    }catch(err){
      console.error(err);
      alert('שגיאה בשליחת הלינק: ' + (err?.message||err));
    }finally{
      sendBtn.disabled = false;
    }
  });

  logoutBtn.addEventListener('click', async () => {
    try{
      logoutBtn.disabled = true;
      await hardSignOut();
      location.href = FB.APP_BASE + '?logout=' + Date.now();
    }catch(err){
      console.error(err);
      alert('שגיאה בהתנתקות: ' + (err?.message||err));
    }finally{
      logoutBtn.disabled = false;
    }
  });
}
