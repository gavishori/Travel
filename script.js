
import { FB } from './firebase.js';
const $ = (id)=>document.getElementById(id);
const msg = (t)=>{ const el=$('msg'); if(el) el.textContent=t||''; };

async function doHardSignOut(){
  try{ await FB.hardSignOut(); }catch(_){}
  try{
    if('caches' in window){ const ks=await caches.keys(); await Promise.all(ks.map(k=>caches.delete(k))); }
  }catch(_){}
  try{
    if(navigator.serviceWorker){ const regs=await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r=>r.unregister().catch(()=>{}))); }
  }catch(_){}
  const ts=Date.now();
  location.replace(FB.APP_BASE + (FB.APP_BASE.includes('?')?'&':'?') + 'logout=' + ts);
}

async function sendLink(){
  const email = $('magicEmail')?.value?.trim();
  if(!email){ msg('נא להזין אימייל'); return; }
  msg('שולח לינק...');
  try{
    await FB.sendMagicLink(email, FB.APP_BASE);
    msg('נשלח לינק למייל. פתח/י אותו במכשיר הזה.');
  }catch(err){
    alert('שגיאה: ' + (err?.code||err?.message||err));
    msg('');
  }
}

document.addEventListener('DOMContentLoaded', async ()=>{
  try{ console.log('persistence:', await FB.ensurePersistence()); }catch(_){}
  try{ await FB.completeEmailLinkLogin(); }catch(_){}
  $('btnSendLink')?.addEventListener('click', (e)=>{ e?.preventDefault?.(); sendLink(); }, {passive:false});
  $('btnHardSignOut')?.addEventListener('click', (e)=>{ e?.preventDefault?.(); doHardSignOut(); }, {passive:false});
});
