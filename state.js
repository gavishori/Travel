export const state = globalThis.state || (globalThis.state = {
  trips: [],
  current: null,
  currentTripId: null,
  user: null,
  maps: {},
  filters: {},
  shared: {},
  rates: {},
  categories: {}
});

export function resetState() {
  state.trips = [];
  state.current = null;
  state.currentTripId = null;
  state.user = null;
  state.maps = {};
  state.filters = {};
  state.shared = {};
  state.rates = {};
}
