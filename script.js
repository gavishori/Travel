// Trips list with: left-aligned 3-dots (RTL), account pill + disconnect, theme toggle, sort-by-departure.
import { getTrips, getCurrentUser, signOutIfAvailable } from './firebase.js';

const tripsGrid = document.getElementById('tripsGrid');
const sortBtn = document.getElementById('sortBtn');
const sortDirEl = document.getElementById('sortDir');

const themeBtn = document.getElementById('themeBtn');
const accountNameEl = document.getElementById('accountName');
const accountAvatarEl = document.getElementById('accountAvatar');
const disconnectBtn = document.getElementById('disconnectBtn');

let sortAsc = true;
let trips = [];

/* THEME */
function detectInitialTheme(){
  const stored = localStorage.getItem('theme');
  if(stored === 'dark' || stored === 'light') return stored;
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}
function applyTheme(mode){
  document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem('theme', mode);
}
function toggleTheme(){
  const current = document.documentElement.getAttribute('data-theme') || detectInitialTheme();
  applyTheme(current === 'dark' ? 'light' : 'dark');
}
applyTheme(detectInitialTheme());
themeBtn.addEventListener('click', toggleTheme);

/* DATES & RENDER */
function fmtDate(iso){
  if(!iso) return '—';
  try{
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yyyy = String(d.getFullYear());
    return `${dd}.${mm}.${yyyy}`;
  }catch(e){ return '—'; }
}

function daysBetween(startISO, endISO){
  try{
    const a = new Date(startISO);
    const b = new Date(endISO);
    if (Number.isNaN(a) || Number.isNaN(b)) return null;
    const days = Math.max(1, Math.round((b - a) / (1000*60*60*24)) + 1);
    return days;
  }catch(e){ return null; }
}

function render(){
  tripsGrid.innerHTML = '';

  const sorted = [...trips].sort((a,b)=>{
    const ad = a.startDate ? new Date(a.startDate).getTime() : Infinity;
    const bd = b.startDate ? new Date(b.startDate).getTime() : Infinity;
    return sortAsc ? ad - bd : bd - ad;
  });

  for(const t of sorted){
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.id = t.id || '';

    const header = document.createElement('div');
    header.className = 'card-header';

    const title = document.createElement('h2');
    title.className = 'dest';
    title.textContent = t.destination || 'ללא יעד';

    const rowEnd = document.createElement('div');
    rowEnd.className = 'row-end';

    const menuAnchor = document.createElement('button');
    menuAnchor.className = 'menu-anchor';
    menuAnchor.setAttribute('aria-label','תפריט');
    menuAnchor.innerHTML = '<span class="menu-dots" aria-hidden="true"></span>';

    const menu = document.createElement('div');
    menu.className = 'menu';
    menu.innerHTML = `
      <ul>
        <li><button data-action="edit">ערוך</button></li>
        <li><button data-action="delete">מחק</button></li>
      </ul>
    `;

    menuAnchor.addEventListener('click', (e)=>{
      e.stopPropagation();
      const wasOpen = menu.classList.contains('open');
      document.querySelectorAll('.menu.open').forEach(m=>m.classList.remove('open'));
      if (!wasOpen) menu.classList.add('open');
    });
    document.addEventListener('click', ()=> menu.classList.remove('open'));

    menu.addEventListener('click', (e)=>{
      const btn = e.target.closest('button[data-action]');
      if(!btn) return;
      const action = btn.dataset.action;
      if(action === 'edit'){
        console.log('edit trip', t.id);
        // window.location.href = `/edit.html?id=${encodeURIComponent(t.id)}`;
      }else if(action === 'delete'){
        console.log('delete trip', t.id);
        trips = trips.filter(x => x.id !== t.id);
        render();
      }
    });

    rowEnd.appendChild(menuAnchor);
    rowEnd.appendChild(menu);

    header.appendChild(title);
    header.appendChild(rowEnd);

    const meta = document.createElement('div');
    meta.className = 'meta';

    const start = fmtDate(t.startDate);
    const end = fmtDate(t.endDate);
    const days = t.days ?? daysBetween(t.startDate, t.endDate);
    const type = t.type || '—';

    const chip1 = document.createElement('span'); chip1.className = 'chip'; chip1.textContent = `${start} – ${end}`;
    const chip2 = document.createElement('span'); chip2.className = 'chip'; chip2.textContent = `${days ?? '—'} ימים`;
    const chip3 = document.createElement('span'); chip3.className = 'chip'; chip3.textContent = type;

    meta.appendChild(chip1); meta.appendChild(chip2); meta.appendChild(chip3);

    card.appendChild(header);
    card.appendChild(meta);
    tripsGrid.appendChild(card);
  }
}

sortBtn.addEventListener('click', ()=>{
  sortAsc = !sortAsc;
  sortDirEl.textContent = sortAsc ? 'עולה' : 'יורד';
  render();
});

async function setupAccount(){
  try{
    const u = await getCurrentUser();
    if(u){
      accountNameEl.textContent = u.displayName || u.email || 'מחובר';
      if(u.photoURL){
        accountAvatarEl.src = u.photoURL;
        accountAvatarEl.hidden = false;
      }
    }else{
      accountNameEl.textContent = 'אורח';
    }
  }catch(e){
    console.warn('account fetch failed', e);
    accountNameEl.textContent = 'אורח';
  }

  disconnectBtn.addEventListener('click', async ()=>{
    try{
      await signOutIfAvailable();
    }catch(e){ console.warn('signout error', e); }
    // Fallback: redirect or update UI
    accountNameEl.textContent = 'אורח';
    accountAvatarEl.hidden = true;
  });
}

async function bootstrap(){
  try{
    const result = await getTrips();
    trips = Array.isArray(result) && result.length ? result : sampleTrips;
  }catch(e){
    console.warn('Firebase not configured/failed; using sample data.', e);
    trips = sampleTrips;
  }
  await setupAccount();
  render();
}

const sampleTrips = [
  { id: 't1', destination: 'מילאנו', startDate: '2025-10-04', endDate: '2025-10-07', days: 4, type: 'עיר' },
  { id: 't2', destination: 'וינה', startDate: '2025-11-12', endDate: '2025-11-15', days: 4, type: 'תרבות' },
  { id: 't3', destination: 'בודפשט', startDate: '2025-12-01', endDate: '2025-12-05', days: 5, type: 'אוכל' },
  { id: 't4', destination: 'רודוס', startDate: '2025-07-20', endDate: '2025-07-25', days: 6, type: 'חופים' }
];

bootstrap();
