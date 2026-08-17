/**
 * Minimal reactive store: one central state object plus subscriptions.
 * UI modules subscribe and never call each other, so adding a panel never
 * requires touching existing panels.
 */
export function createStore(initial) {
  let state = { ...initial };
  const listeners = new Set();

  return {
    get() {
      return state;
    },
    /** Merge-style update; returns the new state. */
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      listeners.forEach((fn) => fn(state));
      return state;
    },
    /** Subscribe (fires immediately by default); returns an unsubscribe function. */
    subscribe(fn, { immediate = true } = {}) {
      listeners.add(fn);
      if (immediate) fn(state);
      return () => listeners.delete(fn);
    },
  };
}
