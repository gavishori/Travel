// ===== DATA =====
/**
 * departure is ISO date string (YYYY-MM-DD) for reliable sorting.
 * We format for UI separately.
 */
const trips = [
  {
    id: 1,
    title: "ארה״ב, סיאטל — מבקרים את רום",
    tags: ["עירוני"],
    days: 21,
    departure: "2026-06-01",
    return: "2026-06-21"
  },
  {
    id: 2,
    title: "אינדונזיה 2026",
    tags: ["סקי","בטן-גב"],
    days: 8,
    departure: "2026-02-04",
    return: "2026-02-28"
  },
  {
    id: 3,
    title: "איטליה 1248",
    tags: ["טרקים","עירוני"],
    days: 12,
    departure: "2025-09-23",
    return: "2025-10-04"
  },
  {
    id: 4,
    title: "איטליה 124",
    tags: ["סקי","טרקים","עירוני"],
    days: 12,
    departure: "2025-09-23",
    return: "2025-10-04"
  },
  {
    id: 5,
    title: "תאילנד",
    tags: ["בטן-גב","טרקים"],
    days: 8,
    departure: "2025-09-17",
    return: "2025-09-24"
  }
];

// ===== STATE =====
const state = {
  view: "list",       // "list" | "gallery"
  sortAsc: true,      // true earliest first
  query: ""
};

// ===== HELPERS =====
const qs = (sel, root=document) => root.querySelector(sel);
const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const fmtDate = (iso) => {
  const [y,m,d] = iso.split("-");
  return `${d}/${m}/${String(y).slice(2)}`;
};
const formatMeta = (t) => `${t.days} ימים • ${fmtDate(t.departure)}–${fmtDate(t.return)}`;

function sortTrips(list){
  const factor = state.sortAsc ? 1 : -1;
  return [...list].sort((a,b) => (a.departure > b.departure ? 1 : -1) * factor);
}
function filterTrips(list){
  if(!state.query) return list;
  const q = state.query.trim().toLowerCase();
  return list.filter(t => 
    t.title.toLowerCase().includes(q) ||
    t.tags.some(tag => tag.toLowerCase().includes(q))
  );
}

// ===== RENDERERS =====
function renderList(list){
  const ul = qs("#listView");
  ul.innerHTML = "";
  list.forEach(t => {
    const li = document.createElement("li");
    li.className = "trip-row";
    li.innerHTML = `
      <button class="kebab" type="button" aria-label="עוד אפשרויות" data-id="${t.id}">⋯</button>
      <div class="trip-main">
        <div class="trip-line">
          <span class="trip-title">${t.title}</span>
          <span class="trip-meta">${formatMeta(t)}</span>
        </div>
        <div class="trip-tags">
          ${t.tags.map(tag => `<span class="tag">${tag}</span>`).join("")}
        </div>
      </div>
    `;
    ul.appendChild(li);
  });
}

function renderGallery(list){
  const grid = qs("#galleryView");
  grid.innerHTML = "";
  list.forEach(t => {
    const art = document.createElement("article");
    art.className = "card";
    art.innerHTML = `
      <div class="hd">${t.title}</div>
      <div class="muted">${formatMeta(t)}</div>
      <div class="muted">${t.tags.join(" • ")}</div>
    `;
    grid.appendChild(art);
  });
}

function applyView(){
  const listView = qs("#listView");
  const galleryView = qs("#galleryView");
  const listBtn = qs("#btnList");
  const galleryBtn = qs("#btnGallery");
  if(state.view === "list"){
    listView.hidden = false;
    listView.setAttribute("aria-hidden","false");
    galleryView.hidden = true;
    galleryView.setAttribute("aria-hidden","true");
    listBtn.setAttribute("aria-pressed","true");
    galleryBtn.setAttribute("aria-pressed","false");
  }else{
    listView.hidden = true;
    listView.setAttribute("aria-hidden","true");
    galleryView.hidden = false;
    galleryView.setAttribute("aria-hidden","false");
    listBtn.setAttribute("aria-pressed","false");
    galleryBtn.setAttribute("aria-pressed","true");
  }
}

function render(){
  const base = sortTrips(filterTrips(trips));
  if(state.view === "list"){
    renderList(base);
  } else {
    renderGallery(base);
  }
  applyView();
}

// ===== EVENTS =====
function wire(){
  qs("#btnList").addEventListener("click", () => {
    state.view = "list";
    render();
  });
  qs("#btnGallery").addEventListener("click", () => {
    state.view = "gallery";
    render();
  });
  qs("#btnSort").addEventListener("click", () => {
    state.sortAsc = !state.sortAsc;
    render();
  });
  qs("#tripSearch").addEventListener("input", (e) => {
    state.query = e.target.value;
    render();
  });
}
document.addEventListener("DOMContentLoaded", () => {
  wire();
  render();
});
