// script.js - main application logic (module)
import { db, storage, auth, appId } from './firebase.js';
import { onAuthStateChanged, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, setDoc, onSnapshot, collection, getDocs, getDoc, updateDoc, deleteDoc, addDoc, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";


// DOM elements
const addTripBtn = document.getElementById("addTripBtn");
const tripList = document.getElementById("tripList");
const mainScreen = document.getElementById("main-screen");
const tripEditor = document.getElementById("tripEditor");
const backBtn = document.getElementById("backBtn");
const saveTripDetailsBtn = document.getElementById("saveTripDetails");
const tripDestinationHeader = document.getElementById("tripDestinationHeader");

const destinationInput = document.getElementById("destinationInput");
const holidayTypeInput = document.getElementById("holidayTypeInput");
const participantsInput = document.getElementById("participantsInput");
const startDateInput = document.getElementById("startDateInput");
const endDateInput = document.getElementById("endDateInput");

const usdInput = document.getElementById("usdBudget");
const eurInput = document.getElementById("eurBudget");
const ilsInput = document.getElementById("ilsBudget");
const updateBudgetBtn = document.getElementById("updateBudgetBtn");
const editBudgetBtn = document.getElementById("editBudgetBtn");

const totalUsdSpentEl = document.getElementById("totalUsdSpent");
const totalEurSpentEl = document.getElementById("totalEurSpent");
const totalIlsSpentEl = document.getElementById("totalIlsSpent");

const remainingUsdEl = document.getElementById("remainingUsd");
const remainingEurEl = document.getElementById("remainingEur");
const remainingIlsEl = document.getElementById("remainingIls");

const expenseList = document.getElementById("expenseList");
const addExpenseBtn = document.getElementById("addExpenseBtn");
const sortExpensesBtn = document.getElementById("sortExpensesBtn"); // New button for sorting expenses

const exportCsvBtn = document.getElementById("exportCsvBtn");
const exportPdfBtn = document.getElementById("exportPdfBtn");
const exportGpxBtn = document.getElementById("exportGpxBtn"); // New GPX export button
const shareTripBtn = document.getElementById("shareTripBtn");
const unshareTripBtn = document.getElementById("unshareTripBtn");

const dailyLogInput = document.getElementById("dailyLogInput");
const imageInput = document.getElementById("imageInput");
const addLogBtn = document.getElementById("addLogBtn");
const gallery = document.getElementById("gallery");
const logsArea = document.getElementById("logsArea");
const sortLogsBtn = document.getElementById("sortLogsBtn");
const setDailyLogLocationBtn = document.getElementById("setDailyLogLocationBtn");
const dailyLogLocationDisplay = document.getElementById("dailyLogLocationDisplay");

// New map filter buttons
const filterAllBtn = document.getElementById('filterAllBtn');
const filterExpensesBtn = document.getElementById('filterExpensesBtn');
const filterLogsBtn = document.getElementById('filterLogsBtn');


const logSpinner = document.getElementById('log-spinner');
const addLogIcon = document.getElementById('add-log-icon');


// Custom Alert Modal elements
const alertModal = document.getElementById('alertModal');
const alertMessage = document.getElementById('alertMessage');
const alertCloseBtn = document.getElementById('alertCloseBtn');

// Custom Confirm Modal elements
const confirmModal = document.getElementById('confirmModal');
const confirmMessage = document.getElementById('confirmMessage');
const confirmYesBtn = document.getElementById('confirmYesBtn');
const confirmNoBtn = document.getElementById('confirmNoBtn');

// New Set Location Modal elements
const setLocationModal = document.getElementById('setLocationModal');
const locationNameInput = document.getElementById('locationNameInput');
const getLocationBtn = document.getElementById('getLocationBtn');
const saveLocationBtn = document.getElementById('saveLocationBtn');
const cancelLocationBtn = document.getElementById('cancelLocationBtn');


let selectedTripId = null;
let trips = [];
let currentTrip = null;
let isAuthReady = false; // New flag to track authentication state
let unsubscribeTrip = null; // Listener for the currently opened trip
let isLogsSortedAscending = false; // New flag to track sorting order
let isExpensesSortedAscending = false; // New flag for expenses sorting
let dailyLogCoordinates = null; // To store coordinates for daily log

// Added new variables to save last used expense category and currency
let lastUsedCategory = 'מזון';
let lastUsedCurrency = 'ILS';

// Exchange rates and a map of countries to currencies
let exchangeRates = { USD: 1, EUR: 0.91, ILS: 3.65, THB: 35.0, RON: 4.5, BGN: 1.79, INR: 83.13 };
const countryCurrencies = {
    'תאילנד': 'THB',
    'רומניה': 'RON',
    'בולגריה': 'BGN',
    'הודו': 'INR',
};

// פונקציית עזר לעיצוב תאריך ושעה בעברית
function formatDateTime(isoString) {
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) {
            throw new Error('Invalid date');
        }
        
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        
        return {
            date: `${day}.${month}.${year}`,
            time: `${hours}:${minutes}`,
            dateForInput: `${year}-${month}-${day}`,
            timeForInput: `${hours}:${minutes}`
        };
    } catch (error) {
        console.error('Error formatting date:', error);
        const now = new Date();
        return formatDateTime(now.toISOString());
    }
}
// פונקציית עזר ליצירת תאריך ISO מתאריך ושעה מקומיים
function createLocalISOString(dateString, timeString) {
    try {
        const localDate = new Date(`${dateString}T${timeString}:00`);
        if (isNaN(localDate.getTime())) {
            throw new Error('Invalid date/time');
        }
        return localDate.toISOString();
    } catch (error) {
        console.error('Error creating local ISO string:', error);
        return new Date().toISOString();
    }
}


// Utility Functions
function formatNumberWithCommas(number) {
    if (number === null || number === undefined || isNaN(number)) return "";
    return number.toString(); // Removed the commas
}

function showAlert(message) {
  alertMessage.textContent = message;
  alertModal.classList.remove('hidden');
}
alertCloseBtn.addEventListener('click', () => {
  alertModal.classList.add('hidden');
});

function showConfirmModal(message) {
  return new Promise((resolve) => {
    confirmMessage.textContent = message;
    confirmModal.classList.remove('hidden');
    confirmYesBtn.onclick = () => {
      confirmModal.classList.add('hidden');
      resolve(true);
    };
    confirmNoBtn.onclick = () => {
      confirmModal.classList.add('hidden');
      resolve(false);
    };
  });
}

// Function to calculate total spent in all currencies based on exchange rates
function calculateTotalSpentInAllCurrencies(expenses) {
    let totalUsd = 0;
    let totalEur = 0;
    let totalIls = 0;

    expenses.forEach(e => {
        const amount = parseFloat(e.amount) || 0;
        switch (e.currency) {
            case 'USD':
                totalUsd += amount;
                totalEur += amount * exchangeRates.EUR;
                totalIls += amount * exchangeRates.ILS;
                break;
            case 'EUR':
                totalEur += amount;
                totalUsd += amount / exchangeRates.EUR;
                totalIls += (amount / exchangeRates.EUR) * exchangeRates.ILS;
                break;
            case 'ILS':
                totalIls += amount;
                totalUsd += amount / exchangeRates.ILS;
                totalEur += (amount / exchangeRates.ILS) * exchangeRates.EUR;
                break;
            case 'THB': // Added Thai Baht conversion
                totalUsd += amount / exchangeRates.THB;
                totalEur += (amount / exchangeRates.THB) * exchangeRates.EUR;
                totalIls += (amount / exchangeRates.THB) * exchangeRates.ILS;
                break;
            case 'RON': // Added Romanian Leu conversion
                totalUsd += amount / exchangeRates.RON;
                totalEur += (amount / exchangeRates.RON) * exchangeRates.EUR;
                totalIls += (amount / exchangeRates.RON) * exchangeRates.ILS;
                break;
            case 'BGN': // Added Bulgarian Lev conversion
                totalUsd += amount / exchangeRates.BGN;
                totalEur += (amount / exchangeRates.BGN) * exchangeRates.EUR;
                totalIls += (amount / exchangeRates.BGN) * exchangeRates.ILS;
                break;
            case 'INR': // Added Indian Rupee conversion
                totalUsd += amount / exchangeRates.INR;
                totalEur += (amount / exchangeRates.INR) * exchangeRates.EUR;
                totalIls += (amount / exchangeRates.INR) * exchangeRates.ILS;
                break;
        }
    });

    return { totalUsd, totalEur, totalIls };
}


// New function to update the 'actual expenses' display
function updateActualExpensesDisplay(expenses) {
    // Calculate total spent for each currency separately
    const { totalUsd, totalEur, totalIls } = calculateTotalSpentInAllCurrencies(expenses || []);

    // Update 'Total Spent' fields
    totalUsdSpentEl.value = `${formatNumberWithCommas(Math.round(totalUsd))}`;
    totalEurSpentEl.value = `${formatNumberWithCommas(Math.round(totalEur))}`;
    totalIlsSpentEl.value = `${formatNumberWithCommas(Math.round(totalIls))}`;

    // Calculate remaining budget for each currency
    const budgetUsd = parseFloat(usdInput.value.replace(/,/g, '')) || 0;
    const budgetEur = parseFloat(eurInput.value.replace(/,/g, '')) || 0;
    const budgetIls = parseFloat(ilsInput.value.replace(/,/g, '')) || 0;

    const remainingUsd = budgetUsd - totalUsd;
    const remainingEur = budgetEur - totalEur;
    const remainingIls = budgetIls - totalIls;

    // Update 'Remaining' fields and apply red color if negative
    remainingUsdEl.value = `${formatNumberWithCommas(Math.round(remainingUsd))}`;
    remainingEurEl.value = `${formatNumberWithCommas(Math.round(remainingEur))}`;
    remainingIlsEl.value = `${formatNumberWithCommas(Math.round(remainingIls))}`;

    [remainingUsdEl, remainingEurEl, remainingIlsEl].forEach(el=> el.classList.remove('text-red-500'));
    if (remainingUsd < 0) remainingUsdEl.classList.add('text-red-500');
    if (remainingEur < 0) remainingEurEl.classList.add('text-red-500');
    if (remainingIls < 0) remainingIlsEl.classList.add('text-red-500');
}

// Custom icons for map markers

const expenseIcon = L.divIcon({
    className: 'expense-icon',
    html: `
      <div class="marker-outline">
        <i data-lucide="tag"></i>
      </div>
    `,
    iconSize: [30, 40],
    iconAnchor: [15, 40]
});

const logIcon = L.divIcon({
    className: 'log-icon',
    html: `
      <div class="marker-outline">
        <i data-lucide="book-open"></i>
      </div>
    `,
    iconSize: [30, 40],
    iconAnchor: [15, 40]
});
// Rendering Functions
function renderExpenseList(expensesArr) {
    expenseList.innerHTML = "";
    
    const sortedExpenses = expensesArr.slice().sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return isExpensesSortedAscending ? dateA - dateB : dateB - dateA;
    });

    sortedExpenses.forEach(e => {
        const li = document.createElement('li');
        li.className = 'bg-white p-3 rounded-xl shadow-sm flex items-center justify-between';
        li.dataset.expenseId = e.id;
        const dateTime = formatDateTime(e.date);
        const locationDisplay = e.locationName || (e.lat && e.lng ? `(${e.lat.toFixed(4)}, ${e.lng.toFixed(4)})` : '');
        li.innerHTML = `
            <div class="flex-1">
                <p class="text-sm text-gray-500">${e.category} - ${e.description}</p>
                <p class="text-lg font-bold">${e.amount} ${e.currency}</p>
                <div class="flex items-center gap-2 text-xs text-gray-400">
                    <span>${dateTime.time}, ${dateTime.date}</span>
                    <!-- New button to set expense location -->
                    <button class="set-location-btn icon-btn p-1" data-id="${e.id}" data-type="expense" aria-label="קבע מיקום להוצאה">
                         <i data-lucide="map-pin" class="w-4 h-4"></i>
                    </button>
                    <span class="location-display">${locationDisplay}</span>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button class="edit-expense icon-btn bg-yellow-500 text-white w-full" data-id="${e.id}" aria-label="ערוך הוצאה">
                    <i data-lucide="edit-2" class="w-4 h-4"></i>
                </button>
                <button class="delete-expense icon-btn bg-red-500 text-white w-full" data-id="${e.id}" aria-label="מחק הוצאה">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        `;
        expenseList.appendChild(li);
    });
    lucide.createIcons();
}

let map, markers = [];
let markerClusterGroup;
// Function to update the map with points filtered by type
function updateMap(filter = 'all') {
    if (!currentTrip) return;
    const allPoints = (currentTrip.expenses || []).concat(currentTrip.logs || []);
    let filteredPoints;

    switch(filter) {
        case 'expenses':
            filteredPoints = allPoints.filter(p => p.category);
            break;
        case 'logs':
            filteredPoints = allPoints.filter(p => !p.category);
            break;
        case 'all':
        default:
            filteredPoints = allPoints;
            break;
    }

    initMap(filteredPoints);

    // Update active state of filter buttons
    document.querySelectorAll('.map-filter-btn').forEach(btn => {
        btn.classList.remove('active-filter');
    });
    // Check if the element exists before adding a class
    const filterBtn = document.getElementById(`filter${filter.charAt(0).toUpperCase() + filter.slice(1)}Btn`);
    if (filterBtn) {
        filterBtn.classList.add('active-filter');
    }
}

function initMap(points) {
    const mapElement = document.getElementById('map');
    if (!map) {
        map = L.map('map').setView([31.7767,35.2345], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);
        markerClusterGroup = L.markerClusterGroup();
        map.addLayer(markerClusterGroup);
        // Ensure map resizes to fit its container
        window.addEventListener('resize', () => map.invalidateSize());
        new ResizeObserver(() => map.invalidateSize()).observe(mapElement);
    }
    
    // Clear old markers
    markerClusterGroup.clearLayers();
    markers = [];

    const validPoints = (points || []).filter(p => p.lat && p.lng);
    validPoints.forEach(p => {
        const isExpense = p.category;
        const description = p.locationName || p.description || p.text || 'נקודה';
        const popupContent = `
            <div class="popup-card">
              <div class="popup-title">${(p.locationName || (isExpense ? (p.category || 'הוצאה') : 'תיעוד יומי'))}</div>
              <div class="popup-meta">${p.date ? (formatDateTime(p.date).date + ' · ' + formatDateTime(p.date).time) : ''}</div>
              <div class="popup-content">${isExpense 
                    ? ((p.description || '') + (p.amount ? ` — ${p.amount} ${p.currency||''}` : '')) 
                    : (p.text || '')}
              </div>
              ${p.mediaUrl ? `<img class="popup-media" src="${p.mediaUrl}" alt="תמונה" />` : ''}
              <div class="popup-actions">
                <button class="btn-mini popup-edit" data-type="${isExpense?'expense':'log'}" data-id="${p.id||''}">ערוך</button>
                <button class="btn-mini popup-show" data-type="${isExpense?'expense':'log'}" data-id="${p.id||''}">הצג</button>
              </div>
            </div>
        `;
        const marker = L.marker([p.lat, p.lng], { icon: isExpense ? expenseIcon : logIcon }).bindPopup(popupContent, { className: 'custom-popup' });
        markers.push(marker);
        
        // attach actions when popup opens
        marker.on('popupopen', (e) => {
            const el = e.popup.getElement();
            if (!el) return;
            lucide.createIcons();
            const id = (p.id || '');
            const type = (p.category ? 'expense' : 'log');

            function selectTabById(sectionId) {
                const tabBtn = document.querySelector(`.tab-btn[data-target="${sectionId}"]`);
                if (tabBtn) tabBtn.click();
            }
            function highlightElement(el) {
                if (!el) return;
                el.classList.add('flash-highlight');
                setTimeout(() => el.classList.remove('flash-highlight'), 1600);
                el.scrollIntoView({behavior:'smooth', block:'center'});
            }

            const editBtn = el.querySelector('.popup-edit');
            const showBtn = el.querySelector('.popup-show');

            if (editBtn) editBtn.addEventListener('click', () => {
                if (type === 'expense') {
                    selectTabById('#expenses-section');
                    const item = document.querySelector(`[data-expense-id="${id}"] .edit-expense`);
                    if (item) item.click();
                    const li = document.querySelector(`[data-expense-id="${id}"]`);
                    highlightElement(li);
                } else {
                    selectTabById('#logs-section');
                    const btn = document.querySelector(`[data-log-id="${id}"] .edit-log-btn`);
                    if (btn) btn.click();
                    const row = document.querySelector(`[data-log-id="${id}"]`);
                    highlightElement(row);
                }
            });

            if (showBtn) showBtn.addEventListener('click', () => {
                if (type === 'expense') {
                    selectTabById('#expenses-section');
                    const li = document.querySelector(`[data-expense-id="${id}"]`);
                    highlightElement(li);
                } else {
                    selectTabById('#logs-section');
                    const row = document.querySelector(`[data-log-id="${id}"]`);
                    highlightElement(row);
                }
            });
        });
    });

    if (markers.length > 0) {
        markerClusterGroup.addLayers(markers);
        const bounds = new L.featureGroup(markers).getBounds();
        map.fitBounds(bounds, { padding: [50, 50] }); // Add padding to ensure all markers are visible
    } else {
        // If there are no markers, check the destination.
        // If the destination exists, try to geocode it and set the view.
        if (currentTrip && currentTrip.destination) {
            geocodeLocation(currentTrip.destination).then(coords => {
                if (coords) {
                    map.setView([coords.lat, coords.lng], 10); // Set a reasonable zoom level for a city/country
                } else {
                    map.setView([31.7767, 35.2345], 8); // Fallback to Israel
                }
            }).catch(error => {
                console.error('Geocoding failed for trip destination:', error);
                map.setView([31.7767, 35.2345], 8); // Fallback to Israel
            });
        } else {
            // Fallback view for when there are no markers and no destination
            map.setView([31.7767, 35.2345], 8); // Set a reasonable default view of Israel
        }
    }
    lucide.createIcons();
}

// Function to get current location
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            return reject('Geolocation is not supported by your browser');
        }
        navigator.geolocation.getCurrentPosition(
            position => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
            error => reject(`Geolocation error: ${error.message}`)
        );
    });
}

// Function to geocode a location name using Nominatim API

// helper: fetch place suggestions from Nominatim
let lastPlaceSuggestions = new Map(); // name -> {lat,lng,display_name}
let suggestTimer = null;
async function fetchPlaceSuggestions(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=8&q=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const data = await res.json();
    lastPlaceSuggestions.clear();
    const options = data.map(it => {
        const name = it.display_name;
        lastPlaceSuggestions.set(name, {lat: parseFloat(it.lat), lng: parseFloat(it.lon), display_name: name});
        return name;
    });
    return options;
}
async function geocodeLocation(query) {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
    const data = await response.json();
    if (data && data.length > 0) {
        const result = data[0];
        return { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
    }
    return null;
}

// Function to show the set location modal
function showSetLocationModal(initialName = '', callback) {
    locationNameInput.value = initialName;
    setLocationModal.classList.remove('hidden');

    getLocationBtn.onclick = async () => {
        try {
            showAlert('מבקש מיקום נוכחי...');
            const coords = await getCurrentLocation();
            // The location name will be the coordinates by default
            const locationName = `(${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`;
            callback(locationName, coords.lat, coords.lng);
            setLocationModal.classList.add('hidden');
        } catch (error) {
            showAlert('שגיאה בקבלת מיקום: ' + error);
        }
    };

    saveLocationBtn.onclick = async () => {
        const name = locationNameInput.value.trim();
        if (name) {
            showAlert('מחפש מיקום...');
            try {
                const coords = await geocodeLocation(name);
                if (coords) {
                    callback(name, coords.lat, coords.lng);
                    showAlert('המיקום נשמר בהצלחה!');
                } else {
                    showAlert('לא נמצאו קואורדינטות עבור המיקום. האם לשמור את השם בלבד?');
                    if (await showConfirmModal(`לא נמצאו קואורדינטות עבור ${name}. האם לשמור את השם בלבד?`)) {
                        callback(name, null, null);
                        showAlert('השם נשמר ללא קואורדינטות.');
                    }
                }
                setLocationModal.classList.add('hidden');
            } catch (error) {
                console.error('Geocoding failed:', error);
                showAlert('שגיאה בחיפוש מיקום. נסה שוב מאוחר יותר.');
            }
        } else {
            showAlert('נא להזין שם למקום או לבחור מיקום נוכחי.');
        }
    };

    cancelLocationBtn.onclick = () => {
        setLocationModal.classList.add('hidden');
    };
}


// Rendering Functions
function createNewExpenseRow(expense = {}) {
    const li = document.createElement('li');
    li.className = 'bg-white p-3 rounded-xl shadow-inner flex flex-col md:flex-row items-center justify-between';
    const id = expense.id || Date.now().toString();
    
    // Check if we are editing an existing expense or creating a new one
    let isEditing = !!expense.id;
    let dateForInput = '';
    let timeForInput = '';

    if (isEditing) {
        const dateTime = formatDateTime(expense.date);
        dateForInput = dateTime.dateForInput;
        timeForInput = dateTime.timeForInput;
    } else {
        const now = new Date();
        const formattedNow = formatDateTime(now.toISOString());
        dateForInput = formattedNow.dateForInput;
        timeForInput = formattedNow.timeForInput;
    }
    
    li.dataset.expenseId = id;

    // Get currency options based on the destination input
    const destination = destinationInput.value.toLowerCase();
    let currencyOptions = ['USD', 'EUR', 'ILS'];
    const destinationWords = destination.split(' ');
    for (const word of destinationWords) {
        for (const [country, currency] of Object.entries(countryCurrencies)) {
            if (word.includes(country)) {
                currencyOptions.push(currency);
            }
        }
    }
    
    // Remove duplicates
    currencyOptions = [...new Set(currencyOptions)];

    const currencySelectOptions = currencyOptions.map(c => 
        `<option value="${c}" ${expense.currency === c || lastUsedCurrency === c ? 'selected' : ''}>${c}</option>`
    ).join('');
    
    // Check if it's a new expense to hide date/time fields initially
    if (!isEditing) {
      li.innerHTML = `
        <div class="flex-1 md:flex md:items-center md:gap-3 w-full">
            <select class="expense-category p-2 border border-gray-200 rounded-lg flex-1 mt-2 md:mt-0">
                <option ${expense.category === 'טיסות' || lastUsedCategory === 'טיסות' ? 'selected' : ''}>טיסות</option>
                <option ${expense.category === 'לינה' || lastUsedCategory === 'לינה' ? 'selected' : ''}>לינה</option>
                <option ${expense.category === 'רכב' || lastUsedCategory === 'רכב' ? 'selected' : ''}>רכב</option>
                <option ${expense.category === 'תקשורת' || lastUsedCategory === 'תקשורת' ? 'selected' : ''}>תקשורת</option>
                <option ${expense.category === 'ביטוח רפואי' || lastUsedCategory === 'ביטוח רפואי' ? 'selected' : ''}>ביטוח רפואי</option>
                <option ${expense.category === 'מזון' || lastUsedCategory === 'מזון' ? 'selected' : ''}>מזון</option>
                <option ${expense.category === 'קניות' || lastUsedCategory === 'קניות' ? 'selected' : ''}>קניות</option>
                <option ${expense.category === 'אטרקציות' || lastUsedCategory === 'אטרקציות' ? 'selected' : ''}>אטרקציות</option>
                <option ${expense.category === 'אחר' || lastUsedCategory === 'אחר' ? 'selected' : ''}>אחר</option>
            </select>
            <input class="expense-desc p-2 border border-gray-200 rounded-lg flex-1 mt-2 md:mt-0" placeholder="תיאור" value="${expense.description || ''}"/>
        </div>
        <div class="flex items-center gap-2 mt-4 md:mt-0 w-full md:w-auto">
            <input class="expense-amount p-2 border border-gray-200 rounded-lg w-24 text-center no-spinners" type="number" value="${expense.amount || ''}" placeholder="0"/>
            <select class="expense-currency p-2 border border-gray-200 rounded-lg w-20 text-center">
                ${currencySelectOptions}
            </select>
            <button class="save-expense bg-blue-600 text-white px-4 py-2 rounded-full transition-colors duration-200 hover:bg-blue-700">שמור</button>
        </div>
      `;
    } else {
        li.innerHTML = `
          <div class="flex-1 md:flex md:items-center md:gap-3 w-full">
            <input class="expense-date p-2 border border-gray-200 rounded-lg flex-1" type="date" value="${dateForInput}"/>
            <input class="expense-time p-2 border border-gray-200 rounded-lg flex-1 mt-2 md:mt-0" type="time" value="${timeForInput}"/>
            <select class="expense-category p-2 border border-gray-200 rounded-lg flex-1 mt-2 md:mt-0">
              <option ${expense.category === 'טיסות' || lastUsedCategory === 'טיסות' ? 'selected' : ''}>טיסות</option>
              <option ${expense.category === 'לינה' || lastUsedCategory === 'לינה' ? 'selected' : ''}>לינה</option>
              <option ${expense.category === 'רכב' || lastUsedCategory === 'רכב' ? 'selected' : ''}>רכב</option>
              <option ${expense.category === 'תקשורת' || lastUsedCategory === 'תקשורת' ? 'selected' : ''}>תקשורת</option>
              <option ${expense.category === 'ביטוח רפואי' || lastUsedCategory === 'ביטוח רפואי' ? 'selected' : ''}>ביטוח רפואי</option>
              <option ${expense.category === 'מזון' || lastUsedCategory === 'מזון' ? 'selected' : ''}>מזון</option>
              <option ${expense.category === 'קניות' || lastUsedCategory === 'קניות' ? 'selected' : ''}>קניות</option>
              <option ${expense.category === 'אטרקציות' || lastUsedCategory === 'אטרקציות' ? 'selected' : ''}>אטרקציות</option>
              <option ${expense.category === 'אחר' || lastUsedCategory === 'אחר' ? 'selected' : ''}>אחר</option>
            </select>
            <input class="expense-desc p-2 border border-gray-200 rounded-lg flex-1 mt-2 md:mt-0" placeholder="תיאור" value="${expense.description || ''}"/>
          </div>
          <div class="flex items-center gap-2 mt-4 md:mt-0 w-full md:w-auto">
            <input class="expense-amount p-2 border border-gray-200 rounded-lg w-24 text-center no-spinners" type="number" value="${expense.amount || ''}" placeholder="0"/>
            <select class="expense-currency p-2 border border-gray-200 rounded-lg w-20 text-center">
                ${currencySelectOptions}
            </select>
            <button class="save-expense bg-blue-600 text-white px-4 py-2 rounded-full transition-colors duration-200 hover:bg-blue-700">שמור</button>
          </div>
        `;
    }
    
    return li;
}

function renderGallery(items) {
    gallery.innerHTML = '';
    items.forEach(it => {
        const wrapper = document.createElement('div');
        wrapper.className = 'relative group border border-gray-200 rounded-xl overflow-hidden shadow-sm';
        if (it.type && it.type.startsWith('image')) {
            wrapper.innerHTML = `<img src="${it.url}" alt="תמונה מיומן המסע" class="w-full h-36 object-cover">`;
        } else {
            wrapper.innerHTML = `<video controls class="w-full h-36"><source src="${it.url}"></video>`;
        }
        wrapper.innerHTML += `<button class="delete-media-btn absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" data-url="${it.url}" aria-label="מחק תמונה/וידאו">
                                  <i data-lucide="x" class="w-4 h-4"></i>
                              </button>`;
        gallery.appendChild(wrapper);
    });
    lucide.createIcons();
}

function renderLogs(logs) {
    logsArea.innerHTML = '';
    
    const sortedLogs = logs.slice().sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return isLogsSortedAscending ? dateA - dateB : dateB - dateA;
    });
    sortedLogs.forEach(l => {
        const el = document.createElement('div');
        el.className = 'p-3 border border-gray-200 rounded-xl bg-white text-sm shadow-md flex items-start justify-between gap-4';
        el.dataset.logId = l.id;
        
        const dateTime = formatDateTime(l.date);
        const locationDisplay = l.locationName || (l.lat && l.lng ? `(${l.lat.toFixed(4)}, ${l.lng.toFixed(4)})` : '');
        
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const logContentHtml = l.text.replace(urlRegex, (url) => {
            const iconHtml = `<i data-lucide="link" class="w-4 h-4 text-blue-500 inline-block align-middle"></i>`;
            return `<a href="${url}" target="_blank" class="text-blue-500 hover:underline inline-flex items-center gap-1">${iconHtml} קישור</a>`;
        });
        
        el.innerHTML = `
            <div class="flex-1">
                <div class="flex items-center gap-2 text-gray-500 font-semibold mb-2">
                    <span>${dateTime.date}</span>
                    <span>${dateTime.time}</span>
                    <button class="set-location-btn icon-btn p-1" data-id="${l.id}" data-type="log" aria-label="קבע מיקום לתיעוד">
                         <i data-lucide="map-pin" class="w-4 h-4"></i>
                    </button>
                    <span class="location-display">${locationDisplay}</span>
                </div>
                <div class="text-gray-800" style="white-space: pre-wrap;">${logContentHtml}</div>
            </div>
            <div class="flex items-center gap-2 mt-1">
                <button class="edit-log-btn icon-btn bg-yellow-500 text-white p-1" data-id="${l.id}" aria-label="ערוך תיעוד">
                    <i data-lucide="edit-2" class="w-4 h-4"></i>
                </button>
                <button class="delete-log-btn icon-btn bg-red-500 text-white p-1" data-id="${l.id}" aria-label="מחק תיעוד">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        `;
        logsArea.appendChild(el);
    });
    lucide.createIcons();
}


// Other Functions
const getUserId = () => {
    return auth.currentUser?.uid || crypto.randomUUID();
};

async function saveTrip(trip) {
    if (!isAuthReady) return; 
    const userId = getUserId();
    if (!userId) return;
    const docRef = doc(db, `artifacts/${appId}/users/${userId}/trips`, trip.id);
    await setDoc(docRef, trip);
}

function loadTrips() {
    if (!isAuthReady) return; 
    const userId = getUserId();
    if (!userId) {
        console.error("userId is not available. Cannot load trips.");
        return;
    }
    const tripsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/trips`);
    onSnapshot(tripsCollectionRef, (querySnapshot) => {
        trips = [];
        querySnapshot.forEach((d) => trips.push({ ...d.data(), id: d.id }));
        renderTripList(trips);
    });
}

function renderTripList(tripsArr) {
    tripList.innerHTML = "";
    if (!tripsArr.length) {
        tripList.innerHTML = '<li class="p-4 text-center text-gray-500 text-lg">אין טיולים שמורים עדיין. התחל טיול חדש!</li>';
        return;
    }
    tripsArr.forEach(t => {
        const li = document.createElement('li');
        li.className = 'flex flex-col sm:flex-row items-center justify-between bg-white rounded-xl shadow-md p-4 transition-all duration-300 hover:shadow-lg';
        li.innerHTML = `
            <div class="flex-1 text-center sm:text-right">
                <h4 class="text-xl font-semibold text-gray-700">${t.destination || '—'}</h4>
                <p class="text-sm text-gray-500">סוג: ${t.holidayType || 'ללא סוג'} | תאריכים: ${t.startDate || '—'} - ${t.endDate || '—'}</p>
            </div>
            <div class="flex flex-col items-stretch gap-2 mt-4 sm:mt-0 w-24">
                <button class="bg-yellow-400 text-white px-4 py-2 rounded-full font-bold text-sm transition-colors duration-200 hover:bg-yellow-500 w-full" data-edit="${t.id}">ערוך</button>
                <button class="bg-red-400 text-white px-4 py-2 rounded-full font-bold text-sm transition-colors duration-200 hover:bg-red-500 w-full" data-delete="${t.id}">מחק</button>
            </div>`;
        tripList.appendChild(li);
    });
}


async function openTrip(tripId) {
    if (!isAuthReady) return; 
    const userId = getUserId();
    if (!userId) return;

    if (unsubscribeTrip) {
        unsubscribeTrip();
        unsubscribeTrip = null;
    }

    selectedTripId = tripId;
    const docRef = doc(db, `artifacts/${appId}/users/${userId}/trips`, tripId);
    
    unsubscribeTrip = onSnapshot(docRef, (docSnap) => {
        if (!docSnap.exists()) {
            tripEditor.classList.add('hidden');
            mainScreen.classList.remove('hidden');
            return;
        }
        const t = docSnap.data();
        currentTrip = t;
        
        tripDestinationHeader.textContent = `יעד: ${t.destination}`;
        destinationInput.value = t.destination || '';
        holidayTypeInput.value = t.holidayType || '';
        participantsInput.value = t.participants || '';
        startDateInput.value = t.startDate || '';
        endDateInput.value = t.endDate || '';
        if (t.budget) {
            usdInput.value = formatNumberWithCommas(Math.round(t.budget.usd || 0));
            eurInput.value = formatNumberWithCommas(Math.round(t.budget.eur || 0));
            ilsInput.value = formatNumberWithCommas(Math.round(t.budget.ils || 0));

            // Budget fields are disabled by default
            usdInput.disabled = true;
            eurInput.disabled = true;
            ilsInput.disabled = true;
            updateBudgetBtn.classList.add('hidden');
            editBudgetBtn.classList.remove('hidden');

        } else {
            // New trip, enable budget fields
            usdInput.disabled = false;
            eurInput.disabled = false;
            ilsInput.disabled = false;
            updateBudgetBtn.classList.remove('hidden');
            editBudgetBtn.classList.add('hidden');
        }
        renderExpenseList(t.expenses || []);
        renderGallery(t.gallery || []);
        renderLogs(t.logs || []);
        updateActualExpensesDisplay(t.expenses || []); // Call the new function
        if (t.shared && t.shared === true) {
            shareTripBtn.classList.add('hidden');
            unshareTripBtn.classList.remove('hidden');
        } else {
            shareTripBtn.classList.remove('hidden');
            unshareTripBtn.classList.add('hidden');
        }

        // Initialize map with all points and set the active filter button
        updateMap('all');
        document.querySelectorAll('.map-filter-btn').forEach(btn => btn.classList.remove('active-filter'));
        const allBtn = document.getElementById('filterAllBtn');
        if (allBtn) {
            allBtn.classList.add('active-filter');
        }

        mainScreen.classList.add('hidden');
        tripEditor.classList.remove('hidden');
    });
}

async function deleteTrip(tripId) {
    if (!isAuthReady) return; 
    const userId = getUserId();
    if (!userId) return;
    await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/trips`, tripId));
}

async function openSharedTrip(id) {
    if (!isAuthReady) return; 
    const userId = getUserId();
    if (!userId) return;
    const docRef = doc(db, `artifacts/${appId}/users/${userId}/trips`, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return; 
    const t = snap.data();
    
    tripDestinationHeader.textContent = `יעד: ${t.destination}`;
    destinationInput.value = t.destination || ''; destinationInput.disabled = true;
    holidayTypeInput.value = t.holidayType || ''; holidayTypeInput.disabled = true;
    participantsInput.value = t.participants || ''; participantsInput.disabled = true;
    startDateInput.value = t.startDate || ''; startDateInput.disabled = true;
    endDateInput.value = t.endDate || ''; endDateInput.disabled = true;
    renderExpenseList(t.expenses || []);
    renderGallery(t.gallery || []);
    renderLogs(t.logs || []);
    initMap(t.expenses.concat(t.logs) || []);
    mainScreen.classList.add('hidden');
    tripEditor.classList.remove('hidden');
    
    saveTripDetailsBtn.style.display = 'none';
    shareTripBtn.style.display = 'none';
    unshareTripBtn.style.display = 'none';
}


// Event Listeners
let budgetInputChanging = false;
function updateBudgetInputs(source, value) {
    if (budgetInputChanging) return;
    budgetInputChanging = true;
    
    let usd = 0, eur = 0, ils = 0;
    
    // Only update other fields if the source field has a valid, non-empty value
    if (value && !isNaN(parseFloat(value.replace(/,/g, '')))) {
        let numericValue = parseFloat(value.replace(/,/g, ''));

        if (source === 'USD') {
            usd = numericValue;
            eur = usd * exchangeRates.EUR;
            ils = usd * exchangeRates.ILS;
        } else if (source === 'EUR') {
            eur = numericValue;
            usd = eur / exchangeRates.EUR;
            ils = eur / exchangeRates.EUR * exchangeRates.ILS;
        } else if (source === 'ILS') {
            ils = numericValue;
            usd = ils / exchangeRates.ILS;
            eur = ils / exchangeRates.ILS * exchangeRates.EUR;
        }
    } else {
        // If the value is empty, clear the other fields as well
        usdInput.value = '';
        eurInput.value = '';
        ilsInput.value = '';
        budgetInputChanging = false;
        return;
    }

    if (source !== 'USD') {
        usdInput.value = formatNumberWithCommas(Math.round(usd));
    }
    if (source !== 'EUR') {
        eurInput.value = formatNumberWithCommas(Math.round(eur));
    }
    if (source !== 'ILS') {
        ilsInput.value = formatNumberWithCommas(Math.round(ils));
    }

    budgetInputChanging = false;
}

usdInput.addEventListener('input', (e) => updateBudgetInputs('USD', e.target.value));
eurInput.addEventListener('input', (e) => updateBudgetInputs('EUR', e.target.value));
ilsInput.addEventListener('input', (e) => updateBudgetInputs('ILS', e.target.value));

updateBudgetBtn.addEventListener('click', () => {
    // This function will handle the budget update based on the input values
    const usd = parseFloat(usdInput.value.replace(/,/g, '')) || 0;
    const eur = parseFloat(eurInput.value.replace(/,/g, '')) || 0;
    const ils = parseFloat(ilsInput.value.replace(/,/g, '')) || 0;

    if (currentTrip) {
        currentTrip.budget = { usd, eur, ils };
        saveTrip(currentTrip);
    }
    // Disable inputs and show edit button
    usdInput.disabled = true;
    eurInput.disabled = true;
    ilsInput.disabled = true;
    updateBudgetBtn.classList.add('hidden');
    editBudgetBtn.classList.remove('hidden');
});

editBudgetBtn.addEventListener('click', () => {
    // Enable inputs and show update button
    usdInput.disabled = false;
    eurInput.disabled = false;
    ilsInput.disabled = false;
    updateBudgetBtn.classList.remove('hidden');
    editBudgetBtn.classList.add('hidden');
});


addTripBtn.addEventListener('click', () => {
    selectedTripId = Date.now().toString();
    tripDestinationHeader.textContent = 'יעד: יעד חדש';
    destinationInput.value = '';
    holidayTypeInput.value = '';
    participantsInput.value = '';
    startDateInput.value = '';
    endDateInput.value = '';
    usdInput.value = '';
    eurInput.value = '';
    ilsInput.value = '';
    expenseList.innerHTML = '';
    gallery.innerHTML = '';
    dailyLogInput.value = '';
    logsArea.innerHTML = '';
    dailyLogLocationDisplay.textContent = '';
    dailyLogCoordinates = null;
    mainScreen.classList.add('hidden');
    tripEditor.classList.remove('hidden');
    currentTrip = { id: selectedTripId, expenses: [], gallery: [], logs: [] };

    // Reset budget fields and buttons for new trip
    usdInput.disabled = false;
    eurInput.disabled = false;
    ilsInput.disabled = false;
    updateBudgetBtn.classList.remove('hidden');
    editBudgetBtn.classList.add('hidden');

    // Initialize the map for the new trip
    updateMap('all');
});

// Using event delegation on tripList
tripList.addEventListener('click', async (e) => {
    if (!isAuthReady) return; 
    const target = e.target.closest('button');
    if (!target) return;
    const eid = target.dataset.edit;
    const did = target.dataset.delete;
    if (eid) await openTrip(eid);
    if (did) {
        if (await showConfirmModal('למחוק את הטיול?')) {
            await deleteTrip(did);
        }
    }
});


backBtn.addEventListener('click', () => {
    tripEditor.classList.add('hidden');
    mainScreen.classList.remove('hidden');
    if (unsubscribeTrip) {
        unsubscribeTrip();
        unsubscribeTrip = null;
    }
    if (isAuthReady) loadTrips(); 
});


addExpenseBtn.addEventListener('click', () => {
    // Prepend a new empty expense row to the list for editing
    expenseList.prepend(createNewExpenseRow());
});

expenseList.addEventListener('click', async (e) => {
    if (!isAuthReady) return; 
    const userId = getUserId();
    if (!userId) return;
    const target = e.target.closest('button');
    if (!target) return;

    if (target.classList.contains('set-location-btn')) {
        const id = target.closest('li').dataset.expenseId;
        const expense = currentTrip.expenses.find(exp => exp.id === id);
        showSetLocationModal(expense.locationName || '', async (name, lat, lng) => {
            const docRef = doc(db, `artifacts/${appId}/users/${userId}/trips`, selectedTripId);
            const snap = await getDoc(docRef);
            let data = snap.exists() ? snap.data() : {};
            const expenses = data.expenses || [];
            const idx = expenses.findIndex(x => x.id === id);
            if (idx !== -1) {
                expenses[idx].locationName = name;
                expenses[idx].lat = lat;
                expenses[idx].lng = lng;
                await updateDoc(docRef, { expenses });
                showAlert('המיקום נשמר בהצלחה!');
            }
        });
    } else if (target.classList.contains('save-expense')) {
        const li = target.closest('li');
        const id = li.dataset.expenseId;
        
        let expenseDate, expenseTime;
        const dateInput = li.querySelector('.expense-date');
        const timeInput = li.querySelector('.expense-time');
        
        if (dateInput && timeInput) {
            expenseDate = dateInput.value;
            expenseTime = timeInput.value;
        } else {
            const now = new Date();
            const formattedNow = formatDateTime(now.toISOString());
            expenseDate = formattedNow.dateForInput;
            expenseTime = formattedNow.timeForInput;
        }

        const category = li.querySelector('.expense-category').value;
        const desc = li.querySelector('.expense-desc').value;
        const amount = parseFloat(li.querySelector('.expense-amount').value) || 0;
        const currency = li.querySelector('.expense-currency').value || 'USD';
        
        lastUsedCategory = category;
        lastUsedCurrency = currency;

        if (!category || !desc || !amount) {
            return showAlert('נא למלא את כל השדות');
        }
        
        // Combine date and time into a single Date object, then save as ISO string
        const dateISO = createLocalISOString(expenseDate, expenseTime);


        if (!currentTrip) currentTrip = { id: selectedTripId, expenses: [] };
        const expense = { id, date: dateISO, category, description: desc, amount, currency };
        const docRef = doc(db, `artifacts/${appId}/users/${userId}/trips`, selectedTripId);
        const snap = await getDoc(docRef);
        let data = snap.exists() ? snap.data() : {};
        const expenses = data.expenses || [];
        const idx = expenses.findIndex(x=>x.id===id);
        if (idx !== -1) expenses[idx]=expense; else expenses.push(expense);
        await updateDoc(docRef, { expenses });
        updateActualExpensesDisplay(expenses); // Call the new function here
        renderExpenseList(expenses);
    } else if (target.classList.contains('delete-expense')) {
        const id = target.closest('li').dataset.expenseId;
        if (await showConfirmModal('למחוק את ההוצאה?')) {
            const docRef = doc(db, `artifacts/${appId}/users/${userId}/trips`, selectedTripId);
            const snap = await getDoc(docRef);
            if (!snap.exists()) return;
            const data = snap.data();
            const expenses = (data.expenses || []).filter(x=>x.id!==id);
            await updateDoc(docRef, { expenses });
            updateActualExpensesDisplay(expenses); // Call the new function here
            renderExpenseList(expenses);
        }
    } else if (target.classList.contains('edit-expense')) {
        const id = target.closest('li').dataset.expenseId;
        const docRef = doc(db, `artifacts/${appId}/users/${userId}/trips`, selectedTripId);
        const snap = await getDoc(docRef);
        const data = snap.exists() ? snap.data() : {};
        const exp = (data.expenses || []).find(x=>x.id===id);
        if (exp) {
            const existing = document.querySelector(`[data-expense-id='${id}']`);
            if (existing) existing.remove();
            expenseList.prepend(createNewExpenseRow(exp));
        }
    }
});


logsArea.addEventListener('click', async (e) => {
    if (!isAuthReady) return; 
    const userId = getUserId();
    if (!userId) return;
    const target = e.target.closest('button');
    if (!target) return;

    const logEl = e.target.closest('[data-log-id]');
    const logId = logEl.dataset.logId;
    
    if (target.classList.contains('delete-log-btn')) {
        if (await showConfirmModal('למחוק את התיעוד?')) {
            const docRef = doc(db, `artifacts/${appId}/users/${userId}/trips`, selectedTripId);
            const snap = await getDoc(docRef);
            if (!snap.exists()) return;
            const data = snap.data();
            const logs = (data.logs || []).filter(log => log.id !== logId);
            await updateDoc(docRef, { logs });
        }
    } else if (target.classList.contains('set-location-btn')) {
        const id = target.closest('div[data-log-id]').dataset.logId;
        const log = currentTrip.logs.find(l => l.id === id);
        showSetLocationModal(log.locationName || '', (name, lat, lng) => {
            dailyLogCoordinates = { name, lat, lng };
            dailyLogLocationDisplay.textContent = name;
            showAlert('המיקום נשמר');
        });
    } else if (target.classList.contains('edit-log-btn')) {
        const id = e.target.closest('.edit-log-btn').dataset.id;
        const docRef = doc(db, `artifacts/${appId}/users/${userId}/trips`, selectedTripId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return;
        const data = snap.data();
        const logToEdit = (data.logs || []).find(log => log.id === logId);

        if (logToEdit) {
            const dateTime = formatDateTime(logToEdit.date);
            const datePart = dateTime.dateForInput;
            const timePartFormatted = dateTime.timeForInput;
            
            logEl.innerHTML = `
                <div class="flex-1 w-full flex flex-col items-start p-3 border border-blue-500 rounded-xl bg-blue-50 shadow-inner">
                    <textarea id="editDailyLogInput" rows="4" class="w-full input-field" placeholder="מה עשינו היום?">${logToEdit.text}</textarea>
                    <div class="flex gap-2 mt-2 w-full">
                        <input id="editDateInput" type="date" value="${datePart}" class="input-field flex-1" />
                        <input id="editTimeInput" type="time" value="${timePartFormatted}" class="input-field flex-1" />
                    </div>
                    <div class="flex gap-2 mt-4 w-full">
                        <button id="saveEditedLogBtn" class="btn-primary bg-blue-500 hover:bg-blue-600 flex-1">שמור תיעוד</button>
                        <button id="cancelEditBtn" class="btn-secondary bg-gray-500 hover:bg-gray-600 flex-1">בטל</button>
                    </div>
                </div>
            `;

            const saveBtn = logEl.querySelector('#saveEditedLogBtn');
            const cancelBtn = logEl.querySelector('#cancelEditBtn');
            
            saveBtn.onclick = async () => {
                const newText = logEl.querySelector('#editDailyLogInput').value;
                const newDate = logEl.querySelector('#editDateInput').value;
                const newTime = logEl.querySelector('#editTimeInput').value;

                if (!newText || !newDate || !newTime) {
                    return showAlert('נא למלא את כל השדות');
                }

                // Create a local date object from the user's input
                const newDatetime = createLocalISOString(newDate, newTime);
                
                const updatedLogs = (data.logs || []).map(log => {
                    if (log.id === logId) {
                        return { ...log, text: newText, date: newDatetime };
                    }
                    return log;
                });

                await updateDoc(docRef, { logs: updatedLogs });
                dailyLogInput.value = '';
            };
            
            cancelBtn.onclick = () => {
                dailyLogInput.value = '';
                renderLogs(data.logs || []);
            };
        }
    }
});


gallery.addEventListener('click', async (e) => {
    if (!isAuthReady) return; 
    const userId = getUserId();
    if (!userId) return;
    const deleteBtn = e.target.closest('.delete-media-btn');
    if (deleteBtn) {
        const fileUrl = deleteBtn.dataset.url;
        if (await showConfirmModal('למחוק את המדיה?')) {
            try {
                const docRef = doc(db, `artifacts/${appId}/users/${userId}/trips`, selectedTripId);
                const snap = await getDoc(docRef);
                const data = snap.exists() ? snap.data() : {};
                const galleryArr = (data.gallery || []).filter(item => item.url !== fileUrl);
                
                // Delete file from Firebase Storage
                const fileRef = storageRef(storage, fileUrl);
                await deleteObject(fileRef);

                // Update Firestore document
                await updateDoc(docRef, { gallery: galleryArr });
            } catch (error) {
                console.error('Error deleting media:', error);
                showAlert('אירעה שגיאה במחיקת המדיה.');
            }
        }
    }
});

setDailyLogLocationBtn.addEventListener('click', async () => {
    const log = currentTrip.logs.slice(-1)[0] || {};
    showSetLocationModal(log.locationName || '', (name, lat, lng) => {
        dailyLogCoordinates = { name, lat, lng };
        dailyLogLocationDisplay.textContent = name;
        showAlert('המיקום נשמר');
    });
});


addLogBtn.addEventListener('click', async () => {
    if (!isAuthReady) return; 
    const userId = getUserId();
    if (!userId) return;
    const files = imageInput.files;
    const logText = dailyLogInput.value;
    if (!files.length && !logText) {
        return showAlert('נא להוסיף תמונה/סרטון או טקסט');
    }
    
    if (!selectedTripId) {
        return showAlert('נא לשמור את פרטי הטיול לפני הזנת תיעוד.');
    }

    // Show loading spinner
    logSpinner.classList.remove('hidden');
    addLogIcon.classList.add('hidden');

    const docRef = doc(db, `artifacts/${appId}/users/${userId}/trips`, selectedTripId);
    const snap = await getDoc(docRef);
    const data = snap.exists() ? snap.data() : {};
    const galleryArr = data.gallery || [];
    const logsArr = data.logs || [];

    try {
        for (let f of files) {
            const storagePath = `users/${userId}/trips/${selectedTripId}/${Date.now()}_${f.name}`;
            const sRef = storageRef(storage, storagePath);
            await uploadBytes(sRef, f);
            const url = await getDownloadURL(sRef);
            galleryArr.push({ url, name: f.name, type: f.type });
        }

        if (logText) {
            const now = new Date();
            const logId = Date.now().toString(); 
            const newLog = { id: logId, text: logText, date: now.toISOString() };
            if (dailyLogCoordinates) {
                newLog.locationName = dailyLogCoordinates.name;
                newLog.lat = dailyLogCoordinates.lat;
                newLog.lng = dailyLogCoordinates.lng;
            }
            logsArr.push(newLog);
            dailyLogCoordinates = null;
            dailyLogLocationDisplay.textContent = '';
        }

        await updateDoc(docRef, { gallery: galleryArr, logs: logsArr });
        dailyLogInput.value = '';
        imageInput.value = '';
    } catch (error) {
                console.error('Error adding log:', error);
                showAlert('אירעה שגיאה בשמירת התיעוד.');
            } finally {
                logSpinner.classList.add('hidden');
                addLogIcon.classList.remove('hidden');
            }
        });


saveTripDetailsBtn.addEventListener('click', async () => {
    if (!isAuthReady) return; 
    const userId = getUserId();
    if (!userId) return;
    if (!selectedTripId) return;
    const docRef = doc(db, `artifacts/${appId}/users/${userId}/trips`, selectedTripId);
    const snap = await getDoc(docRef);
    const existing = snap.exists() ? snap.data() : {};
    const trip = {
        id: selectedTripId,
        destination: destinationInput.value,
        holidayType: holidayTypeInput.value,
        participants: participantsInput.value,
        startDate: startDateInput.value,
        endDate: endDateInput.value,
        budget: {
            usd: parseFloat(usdInput.value.replace(/,/g,'')) || 0,
            eur: parseFloat(eurInput.value.replace(/,/g,'')) || 0,
            ils: parseFloat(ilsInput.value.replace(/,/g,'')) || 0
        },
        expenses: existing.expenses || [],
        gallery: existing.gallery || [],
        logs: existing.logs || []
    };
    await saveTrip({...existing, ...trip});
    mainScreen.classList.remove('hidden');
    tripEditor.classList.add('hidden');
});

exportCsvBtn.addEventListener('click', async ()=>{
    if (!isAuthReady) return; 
    const userId = getUserId();
    if (!userId) return;
    if (!selectedTripId) return showAlert('בחר/שמור טיול קודם');
    const docRef = doc(db, `artifacts/${appId}/users/${userId}/trips`, selectedTripId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return showAlert('לא נמצא טיול');
    const data = snap.data();
    const points = (data.expenses || []).map(e => {
        return { lat: e.lat || '', lng: e.lng || '', what: e.locationName || `${e.category} - ${e.description}`, datetime: e.date || '' };
    });
    // Add logs to the CSV export
    const logs = (data.logs || []).map(l => {
        return { lat: l.lat || '', lng: l.lng || '', what: l.locationName || `תיעוד יומי - ${l.text}`, datetime: l.date || '' };
    });
    const allPoints = [...points, ...logs];
    let csv = 'lat,lng,what,datetime\n';
    allPoints.forEach(p=> csv += `${p.lat},${p.lng},"${p.what}",${p.datetime}\n`);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `trip_${selectedTripId}_points.csv`; a.click();
    URL.revokeObjectURL(url);
});

exportGpxBtn.addEventListener('click', async () => {
    if (!isAuthReady) return; 
    const userId = getUserId();
    if (!userId) return;
    if (!selectedTripId) return showAlert('בחר/שמור טיול קודם');
    const docRef = doc(db, `artifacts/${appId}/users/${userId}/trips`, selectedTripId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return showAlert('לא נמצא טיול');
    const data = snap.data();

    let gpx = '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n';
    gpx += '<gpx version="1.1" creator="Travel Log App">\n';

    const allPoints = [...(data.expenses || []), ...(data.logs || [])];
    allPoints.forEach(p => {
        if (p.lat && p.lng) {
            const time = p.date ? new Date(p.date).toISOString() : '';
            const desc = p.locationName || p.description || p.text || 'נקודה';
            gpx += `  <wpt lat="${p.lat}" lon="${p.lng}">\n`;
            gpx += `    <name>${desc}</name>\n`;
            if (time) gpx += `    <time>${time}</time>\n`;
            gpx += '  </wpt>\n';
        }
    });

    gpx += '</gpx>\n';

    const blob = new Blob([gpx], { type: 'application/gpx+xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trip_${selectedTripId}.gpx`;
    a.click();
    URL.revokeObjectURL(url);
});


exportPdfBtn.addEventListener('click', async ()=>{
    if (!isAuthReady) return; 
    const userId = getUserId();
    if (!userId) return;
    if (!selectedTripId) return showAlert('בחר טיול');
    const docRef = doc(db, `artifacts/${appId}/users/${userId}/trips`, selectedTripId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return showAlert('לא נמצא טיול');
    const data = snap.data();
    // Ask whether to include expenses in the PDF
    const includeExpenses = await showConfirmModal('לכלול הוצאות ב־PDF? (אישור = עם הוצאות, ביטול = בלי הוצאות)');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    pdf.setFontSize(16);
    pdf.text(`תיעוד טיול — ${data.destination || ''}`, 40, 40);
    pdf.setFontSize(12);
    pdf.text(`סוג: ${data.holidayType || ''}`, 40, 70);
    pdf.text(`משתתפים: ${data.participants || ''}`, 40, 90);
    pdf.text(`תאריכים: ${data.startDate || ''} - ${data.endDate || ''}`, 40, 110);
    const logs = data.logs || [];
    let y = 150;
    logs.forEach(l => {
        const locationText = l.locationName ? ` (${l.locationName})` : '';
        const split = pdf.splitTextToSize(`${l.text}${locationText} — ${l.date.split(' ')[1]}, ${l.date.split(' ')[0]}`, 500);
        pdf.text(split, 40, y);
        y += split.length * 12 + 10;
    // If chosen, append expenses section
    if (includeExpenses) {
        const expenses = (data.expenses || []).slice().sort((a,b)=> new Date(a.date)-new Date(b.date));
        if (expenses.length) {
            pdf.addPage();
            let y2 = 60;
            pdf.setFontSize(16);
            pdf.text('הוצאות', 40, y2);
            y2 += 20;
            pdf.setFontSize(12);
            expenses.forEach(e => {
                const dt = e.date || '';
                const line = `${e.category || ''} - ${e.description || ''} — ${e.amount || 0} ${e.currency || ''} — ${dt}`;
                const split2 = pdf.splitTextToSize(line, 500);
                pdf.text(split2, 40, y2);
                y2 += split2.length * 12 + 10;
                if (y2 > 760) { pdf.addPage(); y2 = 40; }
            });
        }
    }
        if (y > 720) { pdf.addPage(); y = 40; }
    });
    pdf.save(`trip_${selectedTripId}.pdf`);
});

shareTripBtn.addEventListener('click', async ()=>{
    if (!isAuthReady) return; 
    const userId = getUserId();
    if (!userId) return;
    if (!selectedTripId) return showAlert('בחר טיול');
    const docRef = doc(db, `artifacts/${appId}/users/${userId}/trips`, selectedTripId);
    await updateDoc(docRef, { shared: true });
    const shareUrl = `${location.origin}${location.pathname}?sharedTrip=${selectedTripId}`;
    prompt('קישור לשיתוף (העתק):', shareUrl);
    shareTripBtn.classList.add('hidden');
    unshareTripBtn.classList.remove('hidden');
});

unshareTripBtn.addEventListener('click', async ()=>{
    if (!isAuthReady) return; 
    const userId = getUserId();
    if (!userId) return;
    if (!selectedTripId) return;
    await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/trips`, selectedTripId), { shared: false });
    shareTripBtn.classList.remove('hidden');
    unshareTripBtn.classList.add('hidden');
    showAlert('השיתוף בוטל');
});

sortLogsBtn.addEventListener('click', () => {
    isLogsSortedAscending = !isLogsSortedAscending;
    if (currentTrip && currentTrip.logs) {
        renderLogs(currentTrip.logs); // Re-render with the new sort order
    }
});

sortExpensesBtn.addEventListener('click', () => {
    isExpensesSortedAscending = !isExpensesSortedAscending;
    if (currentTrip && currentTrip.expenses) {
        renderExpenseList(currentTrip.expenses); // Re-render with the new sort order
    }
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        isAuthReady = true; 
        loadTrips();
        const urlParams = new URLSearchParams(location.search);
        const sharedId = urlParams.get('sharedTrip');
        if (sharedId) {
            openSharedTrip(sharedId);
        }
    } else {
        try {
            if (typeof __initial_auth_token !== 'undefined') {
                await signInWithCustomToken(auth, __initial_auth_token);
            } else {
                await signInAnonymously(auth);
            }
        } catch (error) {
            console.error("Failed to sign in:", error);
        }
    }
});

// Event listeners for the new filter buttons
if (filterAllBtn) {
  filterAllBtn.addEventListener('click', () => {
      updateMap('all');
  });
}

if (filterExpensesBtn) {
  filterExpensesBtn.addEventListener('click', () => {
      updateMap('expenses');
  });
}

if (filterLogsBtn) {
  filterLogsBtn.addEventListener('click', () => {
      updateMap('logs');
  });
}

/* === Theme Toggle (light/dark) === */
(() => {
  const toggle = document.getElementById('themeToggle');
  const body = document.body;
  const saved = localStorage.getItem('theme-pref');
  if (saved === 'light') body.classList.add('light');
  function renderIcon(){
    if (!toggle) return;
    const isLight = body.classList.contains('light');
    toggle.innerHTML = `<i data-lucide="${isLight ? 'sun' : 'moon'}" class="w-5 h-5"></i>`;
    try { lucide.createIcons(); } catch(e){}
  }
  renderIcon();
  if (toggle) {
    toggle.addEventListener('click', ()=>{
      body.classList.toggle('light');
      localStorage.setItem('theme-pref', body.classList.contains('light') ? 'light' : 'dark');
      renderIcon();
      // Invalidate map when switching theme and logs/map is visible
      const logsVisible = !document.querySelector('#logs-section')?.classList.contains('hidden');
      if (logsVisible && typeof map !== 'undefined' && map) {
        setTimeout(()=>{ try { map.invalidateSize(); } catch(e){} }, 60);
      }
    });
  }
})();

// === Tabs handling ===
(function(){ try{
  const tabs = document.querySelectorAll('.tab-btn');
  const sections = ['#details-section', '#expenses-section', '#logs-section'];
  if(!tabs.length) return;
  function show(target){
    if (target === '#all') {
      sections.forEach(sel=>{ const el=document.querySelector(sel); if(el) el.classList.remove('hidden'); });
    } else {
      sections.forEach(sel=>{
        const el=document.querySelector(sel); if(!el) return;
        el.classList.toggle('hidden', sel!==target);
      });
    }
    tabs.forEach(btn=>btn.classList.toggle('active', btn.dataset.target===target));
    try{ lucide.createIcons(); }catch(e){}
    if ((target === '#logs-section' || target === '#all') && typeof map !== 'undefined' && map) setTimeout(()=>{ try{ map.invalidateSize(); }catch(e){} }, 60);
  }
  tabs.forEach(btn=>btn.addEventListener('click', ()=>show(btn.dataset.target)));
  show('#details-section');
} catch(e){} })();


// ==== SURFACE AWARE TEXT CONTRAST v2 ====
// Find the nearest ancestor (including self) that paints a non-transparent background
function getSurfaceElement(el){
  let node = el;
  while (node && node !== document.documentElement){
    const cs = getComputedStyle(node);
    const bg = cs.backgroundColor;
    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') return node;
    node = node.parentElement;
  }
  return null;
}
function isRgbDark(rgb){
  const m = rgb && rgb.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return false;
  const [r,g,b] = [m[1],m[2],m[3]].map(n=>parseInt(n,10));
  const s = [r,g,b].map(v=>{
    v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4);
  });
  const L = 0.2126*s[0] + 0.7152*s[1] + 0.0722*s[2];
  return L < 0.6; // a bit stricter; anything darker than mid-light -> dark
}
function tagSurface(node){
  if (!node) return;
  const cs = getComputedStyle(node);
  const bg = cs.backgroundColor;
  if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return;
  const dark = isRgbDark(bg);
  node.classList.toggle('on-dark', dark);
  node.classList.toggle('surface-dark', dark);
  node.classList.toggle('on-light', !dark);
  node.classList.toggle('surface-light', !dark);
}
function applySurfaceContrast(root=document){
  // Tag common container elements (cards, sections, list items)
  const q = 'div,section,article,li,ul,ol,aside,header,footer,main';
  root.querySelectorAll(q).forEach(el=>{
    const surf = getSurfaceElement(el);
    if (surf) tagSurface(surf);
  });
}
// Run initially and observe dynamic changes
document.addEventListener('DOMContentLoaded', () => {
  try { applySurfaceContrast(); } catch(e){}
  const mo = new MutationObserver(muts=>{
    muts.forEach(m=>{
      if (m.type==='childList'){
        m.addedNodes.forEach(n=>{
          if (n.nodeType===1){
            const surf = getSurfaceElement(n);
            if (surf) tagSurface(surf);
            n.querySelectorAll && n.querySelectorAll('div,section,article,li').forEach(k=>{
              const s2 = getSurfaceElement(k);
              if (s2) tagSurface(s2);
            });
          }
        });
      }
      if (m.type==='attributes'){ tagSurface(getSurfaceElement(m.target)); }
    });
  });
  mo.observe(document.body, {subtree:true, childList:true, attributes:true, attributeFilter:['class','style']});
});


// === Global handler: open Set Location modal for expenses/logs ===
document.addEventListener('click', (ev) => {
    const trg = ev.target.closest('.set-location-btn');
    if (!trg) return;
    const id = trg.getAttribute('data-id');
    const type = trg.getAttribute('data-type'); // 'expense' or 'log'
    const initial = (type === 'expense' ? (currentTrip.expenses||[]).find(x=>x.id===id) : (currentTrip.logs||[]).find(x=>x.id===id)) || {};
    showSetLocationModal(initial.locationName || '', async (name, lat, lng) => {
        if (!currentTrip) return;
        if (type === 'expense') {
            const arr = currentTrip.expenses || [];
            const idx = arr.findIndex(x => x.id === id);
            if (idx !== -1) {
                arr[idx].locationName = name;
                arr[idx].lat = lat;
                arr[idx].lng = lng;
            }
            currentTrip.expenses = arr;
        } else {
            const arr = currentTrip.logs || [];
            const idx = arr.findIndex(x => x.id === id);
            if (idx !== -1) {
                arr[idx].locationName = name;
                arr[idx].lat = lat;
                arr[idx].lng = lng;
            }
            currentTrip.logs = arr;
        }
        await saveTrip(currentTrip);
        // Re-render relevant lists and map
        renderExpenseList(currentTrip.expenses || []);
        renderLogs(currentTrip.logs || []);
        updateMap('all');
    });
});
