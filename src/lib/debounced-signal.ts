import { signal, type Signal } from "@preact/signals";

/**
 * Create a signal that follows a source signal after a debounce delay.
 */
export function createDebouncedSignal<T>(source: Signal<T>, delay: number): Signal<T> {
  const debounced = signal<T>(source.value);
  let timer: ReturnType<typeof setTimeout> | null = null;

  source.subscribe((value) => {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      debounced.value = value;
    }, delay);
  });

  return debounced;
}
