import type { Signal } from "@preact/signals";

export type SignalReset<T> = readonly [signal: Signal<T>, value: T];

export function resetSignals<const T extends readonly SignalReset<unknown>[]>(resets: T): void {
  for (const [target, value] of resets) {
    target.value = value;
  }
}
