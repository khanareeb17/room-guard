/** Tiny external stores usable with useSyncExternalStore (no setState-in-effect needed). */

export interface Store<T> {
  get(): T;
  set(next: T | ((prev: T) => T)): void;
  subscribe(fn: () => void): () => void;
}

export function createStore<T>(init: () => T, persist?: (v: T) => void): Store<T> {
  let value: { v: T } | null = null;
  const listeners = new Set<() => void>();
  return {
    get() {
      if (!value) value = { v: init() };
      return value.v;
    },
    set(next) {
      const prev = this.get();
      const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      if (Object.is(v, prev)) return;
      value = { v };
      persist?.(v);
      listeners.forEach((l) => l());
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
