export function createMemoryStorage(initial: Record<string, string> = {}): Storage {
  const entries = new Map(Object.entries(initial));

  return {
    get length() {
      return entries.size;
    },
    clear() {
      entries.clear();
    },
    getItem(key: string) {
      return entries.get(key) ?? null;
    },
    key(index: number) {
      return [...entries.keys()][index] ?? null;
    },
    removeItem(key: string) {
      entries.delete(key);
    },
    setItem(key: string, value: string) {
      entries.set(key, String(value));
    },
  };
}

export function installStorageMocks(initial?: {
  localStorage?: Record<string, string>;
  sessionStorage?: Record<string, string>;
}): () => void {
  const originalLocalStorage = globalThis.localStorage;
  const originalSessionStorage = globalThis.sessionStorage;

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: createMemoryStorage(initial?.localStorage),
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: createMemoryStorage(initial?.sessionStorage),
  });

  return () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: originalSessionStorage,
    });
  };
}
