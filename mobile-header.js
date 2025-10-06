
// mobile-header.js — zero-collision mobile header
(function(){
  if (window.__MobileHeaderMounted) return;
  window.__MobileHeaderMounted = true;

  const mount = document.getElementById('MobileHeaderMount');
  if (!mount) return;

  // Inline SVG logo (no external file → no 404)
  const logoSVG = `
  <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-label="logo">
    <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#7CC5FF"/><stop offset="1" stop-color="#2F74FF"/></linearGradient></defs>
    <circle cx="24" cy="24" r="22" fill="url(#g)" opacity=".15"/>
    <path d="M12 28c5-9 9-13 12-13s7 4 12 13" fill="none" stroke="url(#g)" stroke-width="3" stroke-linecap="round"/>
    <path d="M18 24l6 8 6-8" fill="none" stroke="#2F74FF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  // Build header DOM
  const el = document.createElement('div');
  el.className = 'mheader';
  el.innerHTML = `
    <div class="logo">${logoSVG}</div>
    <div class="email m-pill m-email" id="mEmail">—</div>
    <button class="logout m-btn" id="mLogout">יציאה</button>
    <button class="theme m-btn" id="mTheme">מצב תאורה</button>
    <div class="search"><input class="m-input" id="mSearch" placeholder="חפש נסיעה / מילה" autocomplete="off"></div>
    <button class="sort m-btn" id="mSort">מיין תאריכי יציאה</button>
  `;
  mount.innerHTML = '';
  mount.appendChild(el);

  // Wiring with guards
  const emailEl  = document.getElementById('mEmail');
  const logoutEl = document.getElementById('mLogout');
  const themeEl  = document.getElementById('mTheme');
  const searchEl = document.getElementById('mSearch');
  const sortEl   = document.getElementById('mSort');

  // Fill email via Firebase if present
  try{
    if (window.onAuth && window.auth) {
      window.onAuth(window.auth, (u)=>{ if(emailEl) emailEl.textContent = (u && u.email) || '—'; });
    }
  }catch{}

  // Logout
  logoutEl && logoutEl.addEventListener('click', async ()=>{
    try{
      if (window.signOutUser) await window.signOutUser();
      else if (window.FB && window.auth && window.FB.signOut) await window.FB.signOut(window.auth);
    }catch(e){ console.warn('signout failed', e); }
  });

  // Theme
  const applyTheme = t => { document.body.setAttribute('data-theme', t); try{ localStorage.setItem('theme', t); }catch{} };
  try{ const saved = localStorage.getItem('theme'); if (saved) applyTheme(saved); }catch{}
  themeEl && themeEl.addEventListener('click', ()=>{
    const next = document.body.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
  });

  // Search passthrough: if you have an existing '#searchTrips' handler, trigger it
  searchEl && searchEl.addEventListener('input', ()=>{
    const proxy = document.querySelector('#searchTrips');
    if (proxy) { proxy.value = searchEl.value; proxy.dispatchEvent(new Event('input', {bubbles:true})); }
  });

  // Sort passthrough
  sortEl && sortEl.addEventListener('click', ()=>{
    const proxy = document.querySelector('#btnSortTrips');
    if (proxy) proxy.click();
  });
})();
