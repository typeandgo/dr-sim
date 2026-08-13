// Observable store — mevcut `dr-sim.state.js`'teki listeners/notify deseninin tiplenmiş hâli.

export interface Store<T> {
  getState: () => T;
  setState: (next: T | ((current: T) => T)) => void;
  subscribe: (listener: (state: T) => void) => () => void;
}

export const createStore = <T>(initial: T): Store<T> => {
  let state = initial;
  const listeners = new Set<(state: T) => void>();

  const notify = (): void => {
    listeners.forEach((listener) => {
      try {
        listener(state);
      } catch {
        // bir dinleyicinin hatası paneli bozmasın
      }
    });
  };

  return {
    getState: () => state,
    setState: (next) => {
      state = typeof next === 'function' ? (next as (current: T) => T)(state) : next;
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
