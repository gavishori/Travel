/* Minimal ready-to-run app with sticky Save/Cancel footer */
// Leaflet marker assets (avoid 404s)
if (typeof L !== 'undefined' && L.Icon && L.Icon.Default) {
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
  });
}

const $ = (s, r=document)=>r.querySelector(s);
const tbody = $("#rowsTable tbody");
const statusEl = $("#status");
const form = $("#journalForm");
const noteEl = $("#note");
const dateEl = $("#whenDate");
const timeEl = $("#whenTime");
const placeEl = $("#placeName");
const tagsEl = $("#tags");
const clearAllBtn = $("#clearAll");
const cancelBtn = $("#cancelBtn");
const toggleTheme = $("#toggleTheme");

function nowLocalISODate(){ const d=new Date(); return d.toISOString().slice(0,10); }
function nowLocalTime(){ const d=new Date(); return d.toTimeString().slice(0,5); }
dateEl.value = nowLocalISODate();
timeEl.value = nowLocalTime();

let map, marker;
function initMap(){
  map = L.map('map').setView([31.771959, 35.217018], 7); // Israel
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  function setMarker(latlng){
    if (!marker){
      marker = L.marker(latlng, {draggable:true}).addTo(map);
      marker.on('dragend', ()=>{});
    }else{
      marker.setLatLng(latlng);
    }
  }
  map.on('click', (e)=> setMarker(e.latlng));
  $("#useCurrent").addEventListener('click', ()=>{
    if (marker){ map.removeLayer(marker); marker = null; }
  });
}
document.addEventListener('DOMContentLoaded', initMap);

// Persistence: localStorage
const KEY = "daily_journal_rows_v1";
function loadRows(){ try{ return JSON.parse(localStorage.getItem(KEY))||[] }catch{return []} }
function saveRows(rows){ localStorage.setItem(KEY, JSON.stringify(rows)); }
function addRow(row){ const rows=loadRows(); rows.unshift(row); saveRows(rows); }
function removeRow(idx){ const rows=loadRows(); rows.splice(idx,1); saveRows(rows); renderRows(); }

function renderRows(){
  const rows = loadRows();
  tbody.innerHTML = "";
  rows.forEach((r, i)=>{
    const tr = document.createElement('tr');
    const link = r.lat && r.lng ? `<a class="link" target="_blank" href="https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lng}#map=16/${r.lat}/${r.lng}">מפה</a>` : "—";
    tr.innerHTML = `
      <td>${r.date || ""}</td>
      <td>${r.time || ""}</td>
      <td>${r.place || "—"}</td>
      <td>${(r.note||"").replace(/</g,'&lt;')}</td>
      <td>${link}</td>
      <td><button class="btn small" data-i="${i}">מחק</button></td>
    `;
    tr.querySelector("button").addEventListener('click', (ev)=>{
      const idx = parseInt(ev.currentTarget.getAttribute('data-i'),10);
      removeRow(idx);
    });
    tbody.appendChild(tr);
  });
}
renderRows();

form.addEventListener('submit', (e)=>{
  e.preventDefault();
  const row = {
    date: dateEl.value,
    time: timeEl.value,
    place: placeEl.value.trim(),
    tags: tagsEl.value.trim(),
    note: noteEl.value.trim(),
    lat: marker ? marker.getLatLng().lat.toFixed(6) : null,
    lng: marker ? marker.getLatLng().lng.toFixed(6) : null,
    createdAt: Date.now()
  };
  addRow(row);
  renderRows();
  statusEl.textContent = "✓ נשמר";
  statusEl.style.color = "var(--ok)";
  form.scrollIntoView({behavior:'smooth', block:'nearest'});
  // reset minimal
  noteEl.value = "";
  placeEl.value = "";
  tagsEl.value = "";
});

cancelBtn.addEventListener('click', ()=>{
  noteEl.value = "";
  placeEl.value = "";
  tagsEl.value = "";
  statusEl.textContent = "בוטל";
  statusEl.style.color = "var(--muted)";
});

clearAllBtn.addEventListener('click', ()=>{
  if (confirm("למחוק את כל הרשומות שנשמרו?")) { saveRows([]); renderRows(); }
});

// Theme toggle
toggleTheme.addEventListener('click', ()=>{
  const root = document.documentElement;
  if (root.classList.contains('light')){
    root.classList.remove('light');
  } else {
    root.classList.add('light');
  }
});
