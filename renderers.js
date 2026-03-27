export const renderers = {
  trips(...args) {
    if (typeof globalThis.renderTrips === 'function') return globalThis.renderTrips(...args);
  },
  expenses(...args) {
    if (typeof globalThis.renderExpenses === 'function') return globalThis.renderExpenses(...args);
  },
  journal(...args) {
    if (typeof globalThis.renderJournal === 'function') return globalThis.renderJournal(...args);
  },
  overview(...args) {
    if (typeof globalThis.renderOverview === 'function') return globalThis.renderOverview(...args);
  },
  map(...args) {
    if (typeof globalThis.initBigMap === 'function') return globalThis.initBigMap(...args);
  }
};
