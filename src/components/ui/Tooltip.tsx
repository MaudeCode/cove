/**
 * Tooltip Component
 *
 * Themed tooltip that appears on hover/focus.
 * Uses a portal to render above all other content.
 *
 * Requires TooltipProvider at app root.
 */

import { createContext } from "preact";
import { useState, useRef, useEffect, useCallback, useContext } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { createPortal } from "preact/compat";

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

interface TooltipState {
  content: ComponentChildren;
  placement: TooltipPlacement;
  triggerRect: DOMRect | null;
  isVisible: boolean;
}

interface TooltipContextValue {
  show: (state: Omit<TooltipState, "isVisible">) => void;
  hide: () => void;
  update: (triggerRect: DOMRect) => void;
}

const TooltipContext = createContext<TooltipContextValue | null>(null);

/**
 * TooltipProvider - renders tooltip portal at root level
 * Place this in your app root (e.g., App.tsx)
 */
export function TooltipProvider({ children }: { children: ComponentChildren }) {
  const [state, setState] = useState<TooltipState | null>(null);
  const [shouldRender, setShouldRender] = useState(false);

  const show = useCallback((newState: Omit<TooltipState, "isVisible">) => {
    setShouldRender(true);
    // Small delay for mount animation
    requestAnimationFrame(() => {
      setState({ ...newState, isVisible: true });
    });
  }, []);

  const hide = useCallback(() => {
    setState((prev) => (prev ? { ...prev, isVisible: false } : null));
    // Wait for fade out
    setTimeout(() => {
      setShouldRender(false);
      setState(null);
    }, 150);
  }, []);

  const update = useCallback((triggerRect: DOMRect) => {
    setState((prev) => (prev ? { ...prev, triggerRect } : null));
  }, []);

  return (
    <TooltipContext.Provider value={{ show, hide, update }}>
      {children}
      {shouldRender && createPortal(<TooltipPortal state={state} />, document.body)}
    </TooltipContext.Provider>
  );
}

/**
 * The actual tooltip rendered in portal
 */
function TooltipPortal({ state }: { state: TooltipState | null }) {
  if (!state?.triggerRect) return null;

  const { content, placement, triggerRect, isVisible } = state;
  const position = calculatePosition(triggerRect, placement);

  return (
    <div
      role="tooltip"
      class={`
        fixed z-[9999] pointer-events-none
        transition-opacity duration-150
        ${isVisible ? "opacity-100" : "opacity-0"}
      `}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: position.transform,
      }}
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
          absolute w-0 h-0 border-[6px]
          ${getArrowStyles(placement)}
        `}
      />
    </div>
  );
}

/**
 * Calculate tooltip position based on trigger rect and placement
 */
function calculatePosition(
  rect: DOMRect,
  placement: TooltipPlacement,
): { top: number; left: number; transform: string } {
  const gap = 8; // Distance from trigger

  switch (placement) {
    case "top":
      return {
        top: rect.top - gap,
        left: rect.left + rect.width / 2,
        transform: "translate(-50%, -100%)",
      };
    case "bottom":
      return {
        top: rect.bottom + gap,
        left: rect.left + rect.width / 2,
        transform: "translate(-50%, 0)",
      };
    case "left":
      return {
        top: rect.top + rect.height / 2,
        left: rect.left - gap,
        transform: "translate(-100%, -50%)",
      };
    case "right":
      return {
        top: rect.top + rect.height / 2,
        left: rect.right + gap,
        transform: "translate(0, -50%)",
      };
  }
}

/**
 * Get arrow styles for placement
 */
function getArrowStyles(placement: TooltipPlacement): string {
  switch (placement) {
    case "top":
      return "top-full left-1/2 -translate-x-1/2 border-t-[var(--color-bg-elevated)] border-x-transparent border-b-transparent";
    case "bottom":
      return "bottom-full left-1/2 -translate-x-1/2 border-b-[var(--color-bg-elevated)] border-x-transparent border-t-transparent";
    case "left":
      return "left-full top-1/2 -translate-y-1/2 border-l-[var(--color-bg-elevated)] border-y-transparent border-r-transparent";
    case "right":
      return "right-full top-1/2 -translate-y-1/2 border-r-[var(--color-bg-elevated)] border-y-transparent border-l-transparent";
  }
}

/**
 * Tooltip trigger wrapper
 */
export function Tooltip({
  content,
  placement = "top",
  delay = 300,
  children,
  class: className,
  disabled = false,
}: TooltipProps) {
  const context = useContext(TooltipContext);
  const timeoutRef = useRef<number | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const showTooltip = useCallback(() => {
    if (disabled || !context) return;

    timeoutRef.current = window.setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        context.show({ content, placement, triggerRect: rect });
      }
    }, delay);
  }, [context, content, placement, delay, disabled]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    context?.hide();
  }, [context]);

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") hideTooltip();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [hideTooltip]);

  // If no provider, render nothing (tooltip won't work but won't crash)
  if (!context) {
    return <div class={`inline-flex ${className || ""}`}>{children}</div>;
  }

  return (
    <div
      ref={triggerRef}
      class={`inline-flex ${className || ""}`}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
    </div>
  );
}
