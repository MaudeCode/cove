/**
 * Tooltip Component
 *
 * Themed tooltip that appears on hover/focus.
 * Replaces native browser title tooltips for consistent styling.
 */

import { useState, useRef, useEffect, useCallback } from "preact/hooks";
import type { ComponentChildren } from "preact";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  /** Tooltip content */
  content: ComponentChildren;
  /** Placement relative to trigger */
  placement?: TooltipPlacement;
  /** Delay before showing (ms) */
  delay?: number;
  /** The trigger element */
  children: ComponentChildren;
  /** Additional class for the wrapper */
  class?: string;
  /** Disable the tooltip */
  disabled?: boolean;
}

const placementStyles: Record<TooltipPlacement, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const arrowStyles: Record<TooltipPlacement, string> = {
  top: "top-full left-1/2 -translate-x-1/2 border-t-[var(--color-bg-elevated)] border-x-transparent border-b-transparent",
  bottom:
    "bottom-full left-1/2 -translate-x-1/2 border-b-[var(--color-bg-elevated)] border-x-transparent border-t-transparent",
  left: "left-full top-1/2 -translate-y-1/2 border-l-[var(--color-bg-elevated)] border-y-transparent border-r-transparent",
  right:
    "right-full top-1/2 -translate-y-1/2 border-r-[var(--color-bg-elevated)] border-y-transparent border-l-transparent",
};

export function Tooltip({
  content,
  placement = "top",
  delay = 300,
  children,
  class: className,
  disabled = false,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    if (disabled) return;
    timeoutRef.current = window.setTimeout(() => {
      setShouldRender(true);
      // Small delay for animation
      requestAnimationFrame(() => setIsVisible(true));
    }, delay);
  }, [delay, disabled]);

  const hide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
    // Wait for fade out animation
    setTimeout(() => setShouldRender(false), 150);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Handle escape key
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, hide]);

  return (
    <div
      ref={triggerRef}
      class={`relative inline-flex ${className || ""}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}

      {shouldRender && (
        <div
          role="tooltip"
          class={`
            absolute z-50 pointer-events-none
            ${placementStyles[placement]}
            transition-opacity duration-150
            ${isVisible ? "opacity-100" : "opacity-0"}
          `}
        >
          {/* Tooltip content */}
          <div
            class="
              px-2.5 py-1.5 text-xs font-medium
              bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]
              rounded-lg shadow-lg
              border border-[var(--color-border)]
              whitespace-nowrap
            "
          >
            {content}
          </div>

          {/* Arrow */}
          <div
            class={`
              absolute w-0 h-0
              border-[6px]
              ${arrowStyles[placement]}
            `}
          />
        </div>
      )}
    </div>
  );
}
