/**
 * useFocusTrap Hook
 *
 * Traps focus within a container for accessibility (modals, dialogs, etc.)
 */

import { useEffect, useRef } from "preact/hooks";
import type { RefObject } from "preact";

const FOCUSABLE_ELEMENTS = [
  'a[href]:not([disabled]):not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"]):not([disabled])',
].join(", ");

interface UseFocusTrapOptions {
  /** Whether the trap is currently active */
  enabled?: boolean;
  /** Auto-focus the first focusable element when enabled */
  autoFocus?: boolean;
  /** Element to focus when the trap is disabled (typically the trigger) */
  returnFocusTo?: RefObject<HTMLElement>;
}

/**
 * Trap focus within a container element for accessibility.
 * Used for modals, dialogs, and other overlays.
 *
 * @param containerRef - Ref to the container element
 * @param options - Configuration options
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement>,
  options: UseFocusTrapOptions = {},
): void {
  const { enabled = true, autoFocus = true, returnFocusTo } = options;
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    // Store the previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Auto-focus the first focusable element
    if (autoFocus) {
      const focusableElements =
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS);
      const firstFocusable = focusableElements[0];
      if (firstFocusable) {
        // Small delay to ensure the element is rendered
        requestAnimationFrame(() => {
          firstFocusable.focus();
        });
      }
    }

    // Handle tab key for focus cycling
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !containerRef.current) return;

      const focusableElements =
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS);
      if (focusableElements.length === 0) return;

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];

      // Shift+Tab from first element -> go to last
      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
        return;
      }

      // Tab from last element -> go to first
      if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
        return;
      }

      // If focus is outside the container, bring it back
      if (!containerRef.current.contains(document.activeElement)) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }

    // Handle focus events to catch focus leaving the container
    function handleFocusIn(event: FocusEvent) {
      if (!containerRef.current) return;

      const target = event.target as HTMLElement;
      if (!containerRef.current.contains(target)) {
        // Focus escaped the trap - bring it back
        const focusableElements =
          containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS);
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);

      // Return focus to the specified element or the previously focused element
      const focusTarget = returnFocusTo?.current ?? previousActiveElement.current;
      if (focusTarget && typeof focusTarget.focus === "function") {
        focusTarget.focus();
      }
    };
  }, [enabled, autoFocus, containerRef, returnFocusTo]);
}
