// No-scroll daily journal. Everything fits 100vh.
if (typeof L !== 'undefined' && L.Icon && L.Icon.Default) {
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
  });
}
const $ = (s, r=document)=>r.querySelector(s);
const noteEl = $("#note");
const dateEl = $("#whenDate");
const timeEl = $("#whenTime");
const placeEl = $("#placeName");
const tagsEl = $("#tags");
const statusEl = $("#status");
const cancelBtn = $("#cancelBtn");
const toggleTheme = $("#toggleTheme");
const form = $("#journalForm");

function nowLocalISODate(){ const d=new Date(); return d.toISOString().slice(0,10); }
function nowLocalTime(){ const d=new Date(); return d.toTimeString().slice(0,5); }
dateEl.value = nowLocalISODate(); timeEl.value = nowLocalTime();

let map, marker;
function initMap(){
  map = L.map('map', { zoomControl:true, attributionControl:true }).setView([31.771959, 35.217018], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
  function setMarker(latlng){
    if (!marker){ marker = L.marker(latlng, {draggable:true}).addTo(map); }
    else { marker.setLatLng(latlng); }
  }
  map.on('click', (e)=> setMarker(e.latlng));
  $("#useCurrent").addEventListener('click', ()=>{ if (marker){ map.removeLayer(marker); marker=null; }});
}
document.addEventListener('DOMContentLoaded', initMap);

// persist locally (silent)
const KEY="daily_journal_rows_v2";
function addRow(row){ let arr=[]; try{arr=JSON.parse(localStorage.getItem(KEY))||[]}catch{}; arr.unshift(row); localStorage.setItem(KEY, JSON.stringify(arr)); }

form.addEventListener('submit', (e)=>{
  e.preventDefault();
  const row = {
    date: dateEl.value, time: timeEl.value,
    place: placeEl.value.trim(), tags: tagsEl.value.trim(), note: noteEl.value.trim(),
    lat: marker? marker.getLatLng().lat.toFixed(6) : null,
    lng: marker? marker.getLatLng().lng.toFixed(6) : null,
    createdAt: Date.now()
  };
  addRow(row);
  statusEl.textContent = "✓ נשמר";
  statusEl.style.color = "var(--primary)";
  noteEl.value = ""; placeEl.value=""; tagsEl.value="";
});

cancelBtn.addEventListener('click', ()=>{
  noteEl.value = ""; placeEl.value=""; tagsEl.value="";
  statusEl.textContent = "בוטל";
});

toggleTheme.addEventListener('click', ()=>{
  const root = document.documentElement;
  root.classList.toggle('light');
});
