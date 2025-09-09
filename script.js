// --- Updated rendering logic for the "timeline" style ---
async function renderHome(){
  $("#homeView")?.classList.add("active");
  $("#tripView")?.classList.remove("active");

  const trips = await Store.listTrips();
  state.trips = trips;

  const q = (el("tripSearch")?.value||"").trim().toLowerCase();
  const list = el("tripList");
  if (!list) return;
  list.innerHTML = "";

  for (const t of trips.filter(x => (x.destination||"").toLowerCase().includes(q))){
    const days = (t.start && t.end) ? (dayjs(t.end).diff(dayjs(t.start), "day")+1) : 0;
    const li = document.createElement("li");
    li.className = "timeline-item";
    
    // Choose an icon based on trip type
    let icon = "✈️";
    if (t.tripType && t.tripType.includes("beach")) { icon = "🏖️"; }
    else if (t.tripType && t.tripType.includes("ski")) { icon = "⛷️"; }
    else if (t.tripType && t.tripType.includes("trek")) { icon = "🏔️"; }
    else if (t.tripType && t.tripType.includes("urban")) { icon = "🏛️"; }

    li.innerHTML = `
      <div class="timeline-item-icon">${icon}</div>
      <div class="timeline-content">
          <div class="timeline-title">${t.destination||"—"}</div>
          <div class="timeline-dates">${t.start?dayjs(t.start).format("DD/MM/YY"):""} – ${t.end?dayjs(t.end).format("DD/MM/YY"):""} (${days||"?"} ימים)</div>
      </div>
      <div class="timeline-actions">
          <button class="btn edit-btn" title="ערוך">✏️</button>
          <button class="btn delete-btn" title="מחק">🗑️</button>
      </div>
    `;
    
    // Attach event listeners to the new buttons
    const editButton = $(".edit-btn", li);
    if (editButton) {
      editButton.onclick = async ()=>{
        await openTrip(t.id);
        openTab('meta');
      };
    }
    const deleteButton = $(".delete-btn", li);
    if (deleteButton) {
      deleteButton.onclick = ()=> confirmDeleteTrip(t.id, t.destination);
    }
    li.onclick = ()=> openTrip(t.id);
    list.appendChild(li);
  }
}