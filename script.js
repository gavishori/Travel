// SPA Navigation & UI behavior (no external deps).
// שים לב: קוד זה לא משתמש ב־Firebase בפועל; ראה firebase.js לנקודות שילוב.

const screens = {
  budget: document.getElementById('screen-budget'),
  addExpense: document.getElementById('screen-add-expense'),
  setLocation: document.getElementById('screen-set-location'),
  addJournal: document.getElementById('screen-add-journal'),
};

let locationContext = null; // 'expense' | 'journal' | null

function showScreen(key) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  switch (key) {
    case 'budget': screens.budget.classList.add('active'); break;
    case 'add-expense': screens.addExpense.classList.add('active'); break;
    case 'set-location': screens.setLocation.classList.add('active'); break;
    case 'add-journal': screens.addJournal.classList.add('active'); break;
  }
  // Scroll top without להציג פס גלילה
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// Nav buttons
document.querySelectorAll('[data-nav]').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-nav');
    showScreen(target);
  });
});

// Style-only enhanced Add Expense button (kept working, now pretty)
document.getElementById('btn-open-add-expense')
  .addEventListener('click', () => showScreen('add-expense'));

// Location open buttons
document.getElementById('btn-open-location-expense')
  .addEventListener('click', () => {
    locationContext = 'expense';
    showScreen('set-location');
  });

document.getElementById('btn-open-location-journal')
  .addEventListener('click', () => {
    locationContext = 'journal';
    showScreen('set-location');
  });

// Cancel location -> return to context
document.getElementById('btn-cancel-location').addEventListener('click', () => {
  if (locationContext === 'expense') showScreen('add-expense');
  else if (locationContext === 'journal') showScreen('add-journal');
  else showScreen('budget');
});

// Save location
document.getElementById('location-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(e.currentTarget);
  const place = (data.get('place') || '').trim();
  const lat = (data.get('lat') || '').trim();
  const lng = (data.get('lng') || '').trim();

  // stringify compact location
  let label = 'ללא מיקום';
  let value = '';
  if (place || (lat && lng)) {
    const parts = [];
    if (place) parts.push(place);
    if (lat && lng) parts.push(`(${lat}, ${lng})`);
    label = parts.join(' ');
    value = JSON.stringify({ place, lat, lng });
  }

  if (locationContext === 'expense') {
    document.getElementById('expense-location-pill').textContent = label;
    document.getElementById('expense-location-value').value = value;
    showScreen('add-expense');
  } else if (locationContext === 'journal') {
    document.getElementById('journal-location-pill').textContent = label;
    document.getElementById('journal-location-value').value = value;
    showScreen('add-journal');
  } else {
    showScreen('budget');
  }
});

// Forms submit handlers (placeholder: just demo + update summary numbers)
document.getElementById('expense-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.currentTarget).entries());
  const amount = Number(data.amount || 0);
  if (!isFinite(amount) || amount <= 0) return alert('אנא הזינו סכום תקין');

  // Update "actual" and "balance" demo values from DOM
  const actualEl = document.querySelector('#actual-value span');
  const balanceEl = document.querySelector('#balance-value span');
  const budgetEl = document.querySelector('#budget-value span');

  const budget = Number((budgetEl.textContent || '0').replace(/[^0-9.]/g, '')) || 0;
  const actual = Number((actualEl.textContent || '0').replace(/[^0-9.]/g, '')) || 0;
  const newActual = actual + amount;
  const newBalance = Math.max(0, budget - newActual);

  actualEl.textContent = newActual.toLocaleString('he-IL');
  balanceEl.textContent = newBalance.toLocaleString('he-IL');

  // Reset and return
  e.currentTarget.reset();
  document.getElementById('expense-location-pill').textContent = 'ללא מיקום';
  document.getElementById('expense-location-value').value = '';
  showScreen('budget');
});

document.getElementById('journal-form').addEventListener('submit', (e) => {
  e.preventDefault();
  // Here you can save entry; for demo just reset and go back
  e.currentTarget.reset();
  document.getElementById('journal-location-pill').textContent = 'ללא מיקום';
  document.getElementById('journal-location-value').value = '';
  showScreen('budget');
});

// Init default dates to today
for (const input of document.querySelectorAll('input[type="date"]')) {
  input.valueAsNumber = Date.now() - (new Date().getTimezoneOffset() * 60 * 1000);
}
