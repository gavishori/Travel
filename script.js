(function(){
  const dbg = document.getElementById('debug');
  const log = (...a)=>{ try{ dbg.textContent += a.join(' ') + "\n"; }catch(e){ /* ignore */}};
  window._dbg = log;
  log("UI ready");
})();