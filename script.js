// Minimal RTL trips list: keep cards, no colors, unified fonts, sort by departure date, 3-dots menu.
// Tries Firebase if configured; otherwise falls back to local sample data.

import { getTrips } from './firebase.js';

const tripsGrid = document.getElementById('tripsGrid');
const sortBtn = document.getElementById('sortBtn');
const sortDirEl = document.getElementById('sortDir');

let sortAsc = true;
let trips = [];

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
    const ms = Math.max(1, Math.round((b - a) / (1000*60*60*24)) + 1);
    return ms;
  }catch(e){ return null; }
}

function render(){
  // clear
  tripsGrid.innerHTML = '';

  // sort
  const sorted = [...trips].sort((a,b)=>{
    const ad = a.startDate ? new Date(a.startDate).getTime() : Infinity;
    const bd = b.startDate ? new Date(b.startDate).getTime() : Infinity;
    return sortAsc ? ad - bd : bd - ad;
  });

  for(const t of sorted){
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.id = t.id || '';

    // header
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

    // open/close menu
    menuAnchor.addEventListener('click', (e)=>{
      e.stopPropagation();
      const wasOpen = menu.classList.contains('open');
      document.querySelectorAll('.menu.open').forEach(m=>m.classList.remove('open'));
      if (!wasOpen) menu.classList.add('open');
    });

    document.addEventListener('click', ()=> menu.classList.remove('open'));

    // handle actions
    menu.addEventListener('click', (e)=>{
      const btn = e.target.closest('button[data-action]');
      if(!btn) return;
      const action = btn.dataset.action;
      if(action === 'edit'){
        // TODO: change to your edit route
        console.log('edit trip', t.id);
        // window.location.href = `/edit.html?id=${encodeURIComponent(t.id)}`;
      }else if(action === 'delete'){
        console.log('delete trip', t.id);
        // Here you can call your delete logic (Firestore or local);
        // For demo we just remove from UI:
        trips = trips.filter(x => x.id !== t.id);
        render();
      }
    });

    rowEnd.appendChild(menuAnchor);
    rowEnd.appendChild(menu);

    header.appendChild(title);
    header.appendChild(rowEnd);

    // meta chips
    const meta = document.createElement('div');
    meta.className = 'meta';

    const start = fmtDate(t.startDate);
    const end = fmtDate(t.endDate);
    const days = t.days ?? daysBetween(t.startDate, t.endDate);
    const type = t.type || '—';

    const chip1 = document.createElement('span');
    chip1.className = 'chip';
    chip1.textContent = `${start} – ${end}`;

    const chip2 = document.createElement('span');
    chip2.className = 'chip';
    chip2.textContent = `${days ?? '—'} ימים`;

    const chip3 = document.createElement('span');
    chip3.className = 'chip';
    chip3.textContent = type;

    meta.appendChild(chip1);
    meta.appendChild(chip2);
    meta.appendChild(chip3);

    // pack
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

async function bootstrap(){
  // try fetch from Firebase; else sample
  try{
    const result = await getTrips();
    if(Array.isArray(result) && result.length){
      trips = result;
    }else{
      trips = sampleTrips;
    }
  }catch(e){
    console.warn('Firebase not configured or failed; using sample data.', e);
    trips = sampleTrips;
  }
  render();
}

const sampleTrips = [
  { id: 't1', destination: 'מילאנו', startDate: '2025-10-04', endDate: '2025-10-07', days: 4, type: 'עיר' },
  { id: 't2', destination: 'וינה', startDate: '2025-11-12', endDate: '2025-11-15', days: 4, type: 'תרבות' },
  { id: 't3', destination: 'בודפשט', startDate: '2025-12-01', endDate: '2025-12-05', days: 5, type: 'אוכל' },
  { id: 't4', destination: 'רודוס', startDate: '2025-07-20', endDate: '2025-07-25', days: 6, type: 'חופים' }
];

bootstrap();
