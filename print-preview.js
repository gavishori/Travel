
// In-page Print Preview (no pop-ups) — smart source detection
(function(){
  function ensureStyles(){
    if(document.getElementById('print-overlay-styles')) return;
    const css = `
    #print-overlay{position:fixed;inset:0;background:#fff;z-index:999999;display:flex;flex-direction:column}
    #print-toolbar{display:flex;gap:8px;padding:10px;border-bottom:1px solid #e5e5e5;align-items:center;justify-content:flex-end}
    #print-toolbar .btn{border:1px solid #ddd;border-radius:12px;padding:8px 14px;background:#fff;cursor:pointer}
    #print-content{flex:1;overflow:auto;padding:16px}
    @media print { #print-toolbar { display:none !important } #print-overlay { position:static; inset:auto; height:auto } }
    `;
    const style = document.createElement('style');
    style.id = 'print-overlay-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // Pick the right container to print (tries common IDs/classes; falls back to <main> or body)
  function getPrintSource(){
    const preferred = [
      '[data-print-root]','#print-root','#printRoot',
      '#trip-schedule','#tripSchedule',
      '#view-overview','#viewOverview',
      '.tab-pane.active','.tab-content>.active','[role="tabpanel"].active'
    ];
    for(const sel of preferred){
      const el = document.querySelector(sel);
      if(el && (el.children.length || (el.textContent||'').trim().length)) return el;
    }
    const main = document.querySelector('main');
    if(main && (main.children.length || (main.textContent||'').trim())) return main;
    return document.body;
  }

  function sanitizeClone(root){
    // Un-hide and normalize
    const HIDE_CLASSES = new Set(['hidden','d-none','sr-only','visually-hidden','is-hidden','u-hidden','tab-content']);
    root.querySelectorAll('*').forEach(el=>{
      if(el.hasAttribute('hidden')) el.removeAttribute('hidden');
      if(el.style){
        if(el.style.display === 'none' || getComputedStyle(el).display === 'none') el.style.removeProperty('display');
        if(el.style.visibility === 'hidden') el.style.removeProperty('visibility');
        if(getComputedStyle(el).position === 'fixed') el.style.position = 'static';
      }
      const toRemove=[]; el.classList?.forEach(c=>{ if(HIDE_CLASSES.has(c)) toRemove.push(c); }); toRemove.forEach(c=>el.classList.remove(c));
      if(el.classList && el.classList.contains('tab-content') && !el.classList.contains('active')) el.classList.add('active');
    });
    root.style.removeProperty('display');
    root.style.width = '100%';
    root.setAttribute('dir','rtl');
  }

  function openPrintPreview(){
    ensureStyles();
    const existing = document.getElementById('print-overlay'); if(existing) existing.remove();

    const src = getPrintSource();
    const clone = src.cloneNode(true);
    sanitizeClone(clone);

    const overlay = document.createElement('div'); overlay.id = 'print-overlay';
    const toolbar = document.createElement('div'); toolbar.id = 'print-toolbar';
    const btnPrint = document.createElement('button'); btnPrint.className='btn'; btnPrint.textContent='🖨️ הדפס';
    const btnClose = document.createElement('button'); btnClose.className='btn'; btnClose.textContent='✖️ סגור';
    btnPrint.addEventListener('click', ()=> window.print());
    btnClose.addEventListener('click', ()=> overlay.remove());
    toolbar.append(btnClose, btnPrint);

    const content = document.createElement('div'); content.id='print-content'; content.appendChild(clone);
    overlay.append(toolbar, content);
    document.body.appendChild(overlay);
  }

  window.openPrintPreview = openPrintPreview;
  window.openTripPrintPreview = openPrintPreview;

  function bind(){
    const btn = document.getElementById('btnExportTripSchedule');
    if(!btn || btn.dataset._ppBound) return;
    btn.dataset._ppBound = '1';
    btn.textContent = 'הצג לפני הדפסה';
    btn.removeAttribute('href'); btn.removeAttribute('target');
    btn.addEventListener('click', function(ev){
      ev.preventDefault(); ev.stopImmediatePropagation();
      openPrintPreview();
      return false;
    }, true); // capture
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    bind(); let tries=0; const iv=setInterval(()=>{ tries++; bind(); if(tries>20) clearInterval(iv); }, 500);
  });
})();
