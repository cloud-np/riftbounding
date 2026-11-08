/**
 * Tiny external store (no state library) — the clone's `useSyncExternalStore` substrate.
 *
 * Mirrors the original store helper `.recon/pretty/playapp/0ltxa4_95njgw.js` module 946505:
 *   `V(e)` → `{ getSnapshot, setSnapshot, subscribe }` (notification only when `Object.is` differs)
 * and the subscription helper `q(store, selector, isEqual?)` used by React components.
 */

export interface ExternalStore<T> {
  getSnapshot: () => T;
  setSnapshot: (next: T) => void;
  subscribe: (listener: () => void) => () => void;
}

/** `946505.V` — create an external store around a value. */
export function createStore<T>(initial: T): ExternalStore<T> {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    setSnapshot: (next: T) => {
      if (Object.is(snapshot, next)) return;
      snapshot = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Reducer-style store: `dispatch(action)` → new snapshot via `reduce`. */
export interface ReducerStore<T, A> extends ExternalStore<T> {
  dispatch: (action: A) => void;
}

export function createReducerStore<T, A>(
  initial: T,
  reduce: (state: T, action: A) => T,
): ReducerStore<T, A> {
  const store = createStore(initial);
  return {
    ...store,
    dispatch: (action: A) => store.setSnapshot(reduce(store.getSnapshot(), action)),
  };
}

/** `946505.q` — subscribe to a slice; `isEqual` defaults to `Object.is`. */
export function subscribeWithSelector<T, S>(
  store: ExternalStore<T>,
  selector: (snapshot: T) => S,
  onStoreChange: () => void,
  isEqual: (a: S, b: S) => boolean = Object.is,
): () => void {
  let current = selector(store.getSnapshot());
  return store.subscribe(() => {
    const next = selector(store.getSnapshot());
    if (isEqual(current, next)) return;
    current = next;
    onStoreChange();
  });
}

/** shallow equality (one level) used by the original's React helpers. */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.hasOwn(b, key)) return false;
    if (!Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
      return false;
  }
  return true;
}
