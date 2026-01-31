/**
 * useClickOutside Hook
 *
 * Closes a dropdown/popover when clicking outside of it.
 */

import { useEffect } from "preact/hooks";
import type { RefObject } from "preact";

type RefOrRefs = RefObject<HTMLElement> | RefObject<HTMLElement>[];

/**
 * Run a callback when clicking outside the referenced element(s).
 * Accepts a single ref or array of refs (useful for button + menu combos).
 * Only active when `active` is true.
 */
export function useClickOutside(
  refs: RefOrRefs,
  onClickOutside: () => void,
  active: boolean = true,
): void {
  useEffect(() => {
    if (!active) return;

    const handleClickOutside = (e: MouseEvent) => {
      const refArray = Array.isArray(refs) ? refs : [refs];
      const target = e.target as Node;

      // Check if click is inside any of the refs
      const isInside = refArray.some((ref) => ref.current?.contains(target));

      if (!isInside) {
        onClickOutside();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [refs, onClickOutside, active]);
}
