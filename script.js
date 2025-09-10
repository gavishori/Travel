// --- Global state ---
const state = {
  trips: [],
  currentTripId: null,
  rates: { USD:1, EUR:0.9, ILS:3.6 },
  localCurrency: "USD",
  theme: localStorage.getItem("theme") || "dark",
  maps: { mini:null, main:null, location:null, expense:null, journal: null },
  locationPick: { lat:null, lng:null, forType:null, tempId:null },
  sortAsc: false,
  journalSortAsc: false,
  tripsSortAsc: false, // New state variable for trip sorting
  lastStatusTimer: null,
};

// ... (existing code)

async function renderHome(){
  $("#homeView")?.classList.add("active");
  $("#tripView")?.classList.remove("active");

  const trips = await Store.listTrips();
  state.trips = trips;

  // Add event listener for the new trip sort button
  const sortTripsBtn = el("sortTripsBtn");
  if (sortTripsBtn) {
    sortTripsBtn.onclick = () => {
      state.tripsSortAsc = !state.tripsSortAsc; // Toggle sort direction
      renderTripList();
    };
  }

  // Initial render of the trip list
  renderTripList();
}

function renderTripList() {
  let tripsToRender = [...state.trips]; // Create a copy to sort
  const q = (el("tripSearch")?.value || "").trim().toLowerCase();
  
  // Filter trips based on search query
  if (q) {
    tripsToRender = tripsToRender.filter(x => (x.destination || "").toLowerCase().includes(q));
  }

  // Sort trips based on the new state variable
  tripsToRender.sort((a, b) => {
    const aDate = dayjs(a.start);
    const bDate = dayjs(b.start);
    if (state.tripsSortAsc) {
      return aDate.diff(bDate);
    } else {
      return bDate.diff(aDate);
    }
  });

  const list = el("tripList");
  if (!list) return;

  list.innerHTML = "";
  for (const t of tripsToRender) {
    const li = document.createElement("li");
    const days = (t.start && t.end) ? (dayjs(t.end).diff(dayjs(t.start), "day") + 1) : 0;
    const translatedTripTypes = (t.tripType || []).map(type => TRIP_TYPE_HEBREW[type] || type).join(", ");
    
    // Check if there are any trip types to display
    const tripTypeBadge = translatedTripTypes ? `<span class="badge">${translatedTripTypes}</span>` : '';

    li.innerHTML = `
      <div class="trip-header">
        <div class="trip-title">${t.destination || "—"}</div>
        <button class="menu-btn">...</button>
      </div>
      <div class="trip-meta">
        <div class="muted">${t.start ? dayjs(t.start).format("DD/MM/YY") : ""}–${t.end ? dayjs(t.end).format("DD/MM/YY") : ""} • ${days || "?"} ימים</div>
        ${tripTypeBadge}
      </div>
      <div class="actions-menu">
        <button class="btn edit">ערוך</button>
        <button class="btn view">פתח</button>
        <button class="btn danger delete">מחק</button>
      </div>
    `;

    // Event listeners for the new 3-dot menu
    const menuBtn = $(".menu-btn", li);
    const actionsMenu = $(".actions-menu", li);
    if (menuBtn) {
      menuBtn.onclick = (e) => {
        e.stopPropagation();
        actionsMenu.classList.toggle("active");
      };
      // Close menu when clicking outside
      document.addEventListener("click", () => {
        actionsMenu.classList.remove("active");
      });
    }

    const viewButton = $(".view", li);
    if (viewButton) {
      viewButton.onclick = (e) => {
        e.stopPropagation();
        openTrip(t.id);
      };
    }
    const editButton = $(".edit", li);
    if (editButton) {
      editButton.onclick = async (e) => {
        e.stopPropagation();
        await openTrip(t.id);
        // This will stay on the default 'overview' tab after opening the trip, as per the original script.
      };
    }
    const deleteButton = $(".delete", li);
    if (deleteButton) {
      deleteButton.onclick = (e) => {
        e.stopPropagation();
        confirmDeleteTrip(t.id, t.destination);
      };
    }
    list.appendChild(li);
  }
}

// ... (other functions remain the same, just replaced the `renderHome` function body)

async function init(){
  applyTheme();
  
  async function loadUserContent(){
    if (window.AppDataLayer?.mode === "firebase") {
      const user = firebase.auth().currentUser;
      if (user) {
        console.log("Auth UID:", user.uid);
        renderHome(); // Use renderHome directly, which will handle the list
      } else {
        console.log("No user signed in.");
        const list = el("tripList");
        if (list) list.innerHTML = "";
      }
    } else {
      renderHome(); // Use renderHome directly for local mode
    }
  }

  // Buttons
  if (el("themeToggle")) el("themeToggle").onclick = toggleTheme;
  if (el("addTripFab")) el("addTripFab").onclick = ()=> el("tripDialog").showModal();
  if (el("tripSearch")) el("tripSearch").oninput = renderTripList; // Updated to call the new render function
  
  if (el("createTripBtn")) el("createTripBtn").onclick = async (e)=>{
    e.preventDefault();
    const dest = el("newTripDestination").value.trim();
    const start = el("newTripStart").value;
    const end = el("newTripEnd").value;
    if (!dest || !start || !end) return;
    const t = await Store.createTrip({ destination: dest, start, end, tripType: [], participants:"" });
    el("tripDialog").close();
    setStatus("נסיעה נוצרה");
    await renderHome();
    openTrip(t.id);
  };
  if (el("backToHome")) el("backToHome").onclick = renderHome;
  
  // ... (the rest of the init function is unchanged)

  await fetchRates("USD");

  const params = new URLSearchParams(location.search);
  if (params.get("view")==="shared" && params.get("tripId")){
    await openTrip(params.get("tripId"));
    $$(".share-controls, .tabs .tab[data-tab='meta'], .tabs .tab[data-tab='export']").forEach(x=> x?.classList?.add?.("hidden"));
    if (el("addExpenseBtn")) el("addExpenseBtn").classList.add("hidden");
    if (el("addJournalBtn")) el("addJournalBtn").classList.add("hidden");
  } else {
    // Auth state listener handles the initial render
  }

  firebase.auth().onAuthStateChanged(user => {
    loadUserContent();
  });
}

// ... (rest of the file is unchanged)