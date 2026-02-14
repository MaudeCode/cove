/**
 * useQueryParam - URL query params as source of truth
 *
 * Like nuqs but for Preact signals. The URL is the state.
 *
 * Usage:
 *   const [filter, setFilter] = useQueryParam('filter', 'all');
 *   // URL: /cron?filter=enabled
 *   // filter.value === 'enabled'
 *   // setFilter('disabled') → URL updates to /cron?filter=disabled
 */

import { useEffect, useMemo } from "preact/hooks";
import { signal, type Signal } from "@preact/signals";

// Global registry of active query param signals with reference counts
const queryParamSignals = new Map<string, { signal: Signal<string | null>; refCount: number }>();

// Track if we've set up the global popstate listener
let popstateListenerActive = false;

function setupPopstateListener() {
  if (popstateListenerActive) return;
  popstateListenerActive = true;

  window.addEventListener("popstate", () => {
    // Sync all registered signals from current URL
    const params = new URLSearchParams(window.location.search);
    for (const [key, entry] of queryParamSignals) {
      entry.signal.value = params.get(key);
    }
  });
}

function updateUrl(key: string, value: string | null) {
  const url = new URL(window.location.href);

  if (value === null || value === "") {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }

  // Use replaceState to avoid polluting history for every keystroke
  // Use pushState for "meaningful" changes (handled by caller if needed)
  window.history.replaceState({}, "", url.toString());
}

interface UseQueryParamOptions {
  /** Default value when param is absent */
  defaultValue?: string | null;
  /**
   * If provided, the hook won't clear/sync the param until ready becomes true.
   * Useful when you need to wait for data to load before processing the initial param.
   */
  ready?: boolean;
}

/**
 * Hook that syncs a value with a URL query parameter.
 *
 * @param key - Query param name (e.g., 'filter', 'search', 'job')
 * @param options - Configuration options
 * @returns [signal, setter, initialized] - Signal tracks current value, setter updates URL + signal, initialized is true once ready
 */
export function useQueryParam(
  key: string,
  options: UseQueryParamOptions = {},
): [Signal<string | null>, (value: string | null) => void, Signal<boolean>] {
  const { defaultValue = null, ready = true } = options;

  setupPopstateListener();

  // Track if we've initialized (ready became true)
  const initialized = useMemo(() => signal(false), [key]);

  // Get or create signal for this key (with ref counting for cleanup)
  const sig = useMemo(() => {
    const existing = queryParamSignals.get(key);
    if (existing) {
      existing.refCount++;
      return existing.signal;
    }

    // Initialize from current URL (ignore defaultValue if URL has a value)
    const params = new URLSearchParams(window.location.search);
    const initial = params.get(key) ?? defaultValue;
    const newSig = signal<string | null>(initial);
    queryParamSignals.set(key, { signal: newSig, refCount: 1 });
    return newSig;
  }, [key]);

  // Cleanup: decrement ref count and remove if no longer used
  useEffect(() => {
    return () => {
      const entry = queryParamSignals.get(key);
      if (entry) {
        entry.refCount--;
        if (entry.refCount <= 0) {
          queryParamSignals.delete(key);
        }
      }
    };
  }, [key]);

  // Mark as initialized once ready
  useEffect(() => {
    if (ready && !initialized.value) {
      initialized.value = true;
    }
  }, [ready]);

  // Sync signal to URL when it changes (via effect to catch external changes)
  useEffect(() => {
    // Don't sync until ready (avoids clearing param before it's processed)
    if (!ready) return;

    // Read current URL value
    const params = new URLSearchParams(window.location.search);
    const urlValue = params.get(key);

    // If signal differs from URL, sync URL to signal (signal is source of truth)
    if (sig.value !== urlValue) {
      updateUrl(key, sig.value);
    }
  }, [key, sig.value, ready]);

  // Setter that updates both signal and URL
  const setter = useMemo(
    () => (value: string | null) => {
      sig.value = value;
      updateUrl(key, value);
    },
    [key, sig],
  );

  return [sig, setter, initialized];
}

/**
 * Push current URL state to history (for "meaningful" navigation)
 * Call this when user takes a deliberate action (click, not keystroke)
 */
export function pushQueryState() {
  window.history.pushState({}, "", window.location.href);
}

/**
 * Hook for Set-based query params (comma-separated in URL)
 * Great for expanded items, multi-select filters, etc.
 */
export function useQueryParamSet<T extends string | number>(
  key: string,
  options: UseQueryParamOptions & {
    /** Convert string to item type (default: identity for strings) */
    parse?: (s: string) => T;
    /** Convert item to string (default: String()) */
    serialize?: (v: T) => string;
  } = {},
): [Signal<Set<T>>, (set: Set<T>) => void, Signal<boolean>] {
  const { parse = (s) => s as T, serialize = String, ...rest } = options;
  const [param, setParam, initialized] = useQueryParam(key, rest);

  // Derived Set signal
  const setSignal = useMemo(() => {
    const items = param.value ? param.value.split(",").map(parse).filter(Boolean) : [];
    return signal(new Set(items));
  }, [key]);

  // Keep set in sync with param
  useEffect(() => {
    const items = param.value ? param.value.split(",").map(parse).filter(Boolean) : [];
    setSignal.value = new Set(items);
  }, [param.value]);

  // Setter that updates param
  const setter = useMemo(
    () => (set: Set<T>) => {
      setSignal.value = set;
      const arr = Array.from(set).map(serialize);
      setParam(arr.length > 0 ? arr.join(",") : null);
    },
    [setParam],
  );

  return [setSignal, setter, initialized];
}

/**
 * Sync a module-level signal to a query param (one-way: signal → URL)
 * Useful when state lives outside the component.
 */
export function useSyncToParam(signal: Signal<string>, setParam: (v: string | null) => void): void {
  useEffect(() => {
    setParam(signal.value || null);
  }, [signal.value]);
}

/**
 * Initialize a module-level signal from a query param on mount (one-way: URL → signal)
 */
export function useInitFromParam<T>(
  param: Signal<string | null>,
  signal: Signal<T>,
  parse: (s: string) => T,
): void {
  useEffect(() => {
    if (param.value) {
      signal.value = parse(param.value);
    }
  }, []);
}
