function fallbackSwitchToTab(tab) {
  document.querySelectorAll('#tabs [data-tab]').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`#tabs [data-tab="${tab}"]`);
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.tabview').forEach(v => {
    v.hidden = true;
    v.removeAttribute('data-active');
  });
  const view = document.getElementById(`view-${tab}`);
  if (view) {
    view.hidden = false;
    view.setAttribute('data-active', '1');
  }
}

export function switchToTab(tab) {
  if (typeof globalThis.switchToTab === 'function' && globalThis.switchToTab !== switchToTab) {
    return globalThis.switchToTab(tab);
  }
  return fallbackSwitchToTab(tab);
}

export function focusItemInTab(type, id) {
  if (typeof globalThis.focusItemInTab === 'function') {
    return globalThis.focusItemInTab(type, id);
  }
  switchToTab('overview');
  setTimeout(() => {
    const selector = `.exp-item[data-id="${id}"]`;
    const el = document.querySelector(selector);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 120);
}
