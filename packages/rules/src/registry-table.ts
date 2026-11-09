/**
 * Import-time registries — one implementation for every keyed table the engine fills while its
 * modules load (card scripts, custom conditions/effects, effect ops, prompt/task handlers,
 * per-card additional costs) and for the ordered extension-point lists (hooks, play permissions,
 * combat filters, cost providers).
 *
 * A second registration under the same key throws (`DuplicateRegistrationError`): adding a card
 * or a set can never silently replace an existing script or handler, whatever the import order.
 * Tests that need to replace an entry go through the explicit test-only API in `src/testing.ts`
 * (`override*` returns a restore function).
 *
 * Contract §1 exemption: these are module-level tables of pure data / pure functions filled at
 * import time. They hold no game state; the room is always an argument.
 */

export class DuplicateRegistrationError extends Error {
  readonly registry: string;
  readonly key: string;

  constructor(registry: string, key: string) {
    super(
      `${registry}: "${key}" is already registered. Registrations are unique; a reprint keeps its ` +
        "original script, and tests replace entries through src/testing.ts (override*).",
    );
    this.name = "DuplicateRegistrationError";
    this.registry = registry;
    this.key = key;
  }
}

export interface KeyedRegistry<V> {
  readonly label: string;
  /** Add `value` under `key`; throws `DuplicateRegistrationError` when the key exists. */
  register(key: string, value: V): void;
  get(key: string | undefined | null): V | undefined;
  has(key: string | undefined | null): boolean;
  /** Registered keys, sorted. */
  keys(): string[];
  /** Test-only (reach it through `src/testing.ts`): replace or add, returns a restore function. */
  override(key: string, value: V): () => void;
  /** Test-only: remove one entry. */
  unregister(key: string): boolean;
  /** Test-only: remove every entry. */
  clear(): void;
}

/**
 * A keyed registry. `store` lets a module keep exposing its historical record object (e.g.
 * `EFFECT_OPS`) while every write goes through the guarded API.
 */
export function keyedRegistry<V>(label: string, store: Record<string, V> = Object.create(null) as Record<string, V>): KeyedRegistry<V> {
  const has = (key: string | undefined | null): boolean => !!key && Object.prototype.hasOwnProperty.call(store, key);
  return {
    label,
    register(key, value) {
      if (has(key)) throw new DuplicateRegistrationError(label, key);
      store[key] = value;
    },
    get(key) {
      return has(key) ? store[key as string] : undefined;
    },
    has,
    keys() {
      return Object.keys(store).sort((a, b) => a.localeCompare(b));
    },
    override(key, value) {
      const existed = has(key);
      const previous = store[key];
      store[key] = value;
      return () => {
        if (store[key] !== value) return;
        if (existed) store[key] = previous as V;
        else delete store[key];
      };
    },
    unregister(key) {
      if (!has(key)) return false;
      delete store[key];
      return true;
    },
    clear() {
      for (const key of Object.keys(store)) delete store[key];
    },
  };
}

/**
 * An ordered list of extension functions (hooks, providers, filters). Registering the same
 * function twice throws; `register` returns an unsubscribe function (test isolation).
 */
export function orderedRegistry<F>(label: string, list: F[] = []): {
  readonly label: string;
  readonly list: F[];
  register(entry: F): () => void;
} {
  return {
    label,
    list,
    register(entry) {
      if (list.includes(entry)) throw new DuplicateRegistrationError(label, String((entry as { name?: string }).name || "<anonymous>"));
      list.push(entry);
      return () => {
        const index = list.indexOf(entry);
        if (index >= 0) list.splice(index, 1);
      };
    },
  };
}
