/**
 * useClickOutside Hook
 *
 * Closes a dropdown/popover when clicking outside of it.
 */

import { useEffect, type RefObject } from "preact/hooks";

/**
 * Run a callback when clicking outside the referenced element.
 * Only active when `active` is true.
 */
export function useClickOutside(
  ref: RefObject<HTMLElement>,
  onClickOutside: () => void,
  active: boolean = true,
): void {
  useEffect(() => {
    if (!active) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClickOutside();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ref, onClickOutside, active]);
}
