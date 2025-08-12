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
const shareTripBtn = document.getElementById("shareTripBtn");
const unshareTripBtn = document.getElementById("unshareTripBtn");

const dailyLogInput = document.getElementById("dailyLogInput");
const imageInput = document.getElementById("imageInput");
const addLogBtn = document.getElementById("addLogBtn");
const gallery = document.getElementById("gallery");
const logsArea = document.getElementById("logsArea");
const sortLogsBtn = document.getElementById("sortLogsBtn");

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


let selectedTripId = null;
let trips = [];
let currentTrip = null;
let isAuthReady = false; // New flag to track authentication state
let unsubscribeTrip = null; // Listener for the currently opened trip
let isLogsSortedAscending = false; // New flag to track sorting order
let isExpensesSortedAscending = false; // New flag for expenses sorting

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
        li.innerHTML = `
            <div class="flex-1">
                <p class="text-sm text-gray-500">${e.category} - ${e.description}</p>
                <p class="text-lg font-bold">${e.amount} ${e.currency}</p>
                <p class="text-xs text-gray-400">${dateTime.time}, ${dateTime.date}</p>
            </div>
            <div class="flex items-center gap-2">
                <button class="edit-expense icon-btn bg-yellow-500 text-white" data-id="${e.id}" aria-label="ערוך הוצאה">
                    <i data-lucide="edit-2" class="w-4 h-4"></i>
                </button>
                <button class="delete-expense icon-btn bg-red-500 text-white" data-id="${e.id}" aria-label="מחק הוצאה">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        `;
        expenseList.appendChild(li);
    });
    lucide.createIcons();
}

let map, markers = [];
function initMap(expenses) {
    if (!map) {
        map = L.map('map').setView([31.7767,35.2345], 2);
        L.tile-layer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
        }).addTo(map);
    }
    // clear markers
    markers.forEach(m=> map.removeLayer(m));
    markers = [];
    (expenses || []).forEach(e => {
        if (e.lat && e.lng) {
            const m = L.marker([e.lat, e.lng]).addTo(map).bindPopup(`${e.category} — ${e.description}`);
            markers.push(m);
        }
    });
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
            <div class="flex items-center gap-2 mt-4 sm:mt-0">
                <button class="bg-yellow-400 text-white px-4 py-2 rounded-full font-bold text-sm transition-colors duration-200 hover:bg-yellow-500" data-edit="${t.id}">ערוך</button>
                <button class="bg-red-400 text-white px-4 py-2 rounded-full font-bold text-sm transition-colors duration-200 hover:bg-red-500" data-delete="${t.id}">מחק</button>
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
        initMap(t.expenses || []);

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
    initMap(t.expenses || []);
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
    mainScreen.classList.add('hidden');
    tripEditor.classList.remove('hidden');
    currentTrip = { id: selectedTripId, expenses: [], gallery: [], logs: [] };

    // Reset budget fields and buttons for new trip
    usdInput.disabled = false;
    eurInput.disabled = false;
    ilsInput.disabled = false;
    updateBudgetBtn.classList.remove('hidden');
    editBudgetBtn.classList.add('hidden');
});

tripList.addEventListener('click', async (e) => {
    if (!isAuthReady) return; 
    const eid = e.target.dataset.edit;
    const did = e.target.dataset.delete;
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

    if (target.classList.contains('save-expense')) {
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


addLogBtn.addEventListener('click', async () => {
    if (!isAuthReady) return; 
    const userId = getUserId();
    if (!userId) return;
    const files = imageInput.files;
    if (!files.length && !dailyLogInput.value) {
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

        if (dailyLogInput.value) {
            const now = new Date();
            const logId = Date.now().toString(); 
            logsArr.push({ id: logId, text: dailyLogInput.value, date: now.toISOString() });
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
        return { lat: e.lat || '', lng: e.lng || '', what: `${e.category} - ${e.description}`, datetime: e.date || '' };
    });
    let csv = 'lat,lng,what,datetime\n';
    points.forEach(p=> csv += `${p.lat},${p.lng},"${p.what}",${p.datetime}\n`);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `trip_${selectedTripId}_points.csv`; a.click();
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
        const split = pdf.splitTextToSize(`${l.text} — ${l.date.split(' ')[1]}, ${l.date.split(' ')[0]}`, 500);
        pdf.text(split, 40, y);
        y += split.length * 12 + 10;
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
