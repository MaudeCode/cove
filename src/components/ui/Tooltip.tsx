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

  // Global escape key handler - only active when tooltip is visible
  useEffect(() => {
    if (!shouldRender) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [shouldRender, hide]);

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
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [finalPlacement, setFinalPlacement] = useState<TooltipPlacement>("top");
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Calculate position after render (need tooltip dimensions)
  useEffect(() => {
    if (!state?.triggerRect || !tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const tooltipRect = tooltip.getBoundingClientRect();
    const { adjustedPlacement, pos } = calculateSmartPosition(
      state.triggerRect,
      tooltipRect,
      state.placement,
    );

    setFinalPlacement(adjustedPlacement);
    setPosition(pos);
  }, [state?.triggerRect, state?.placement, state?.content]);

  if (!state?.triggerRect) return null;

  const { content, isVisible } = state;

  return (
    <div
      ref={tooltipRef}
      role="tooltip"
      class={`
        fixed z-[9999] pointer-events-none
        transition-opacity duration-150
        ${isVisible ? "opacity-100" : "opacity-0"}
      `}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
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
          ${getArrowStyles(finalPlacement)}
        `}
      />
    </div>
  );
}

/**
 * Calculate smart tooltip position with viewport boundary detection
 */
function calculateSmartPosition(
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
  preferredPlacement: TooltipPlacement,
): {
  adjustedPlacement: TooltipPlacement;
  pos: { top: number; left: number };
} {
  const gap = 8;
  const padding = 8; // Min distance from viewport edge
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  // Check available space in each direction
  const space = {
    top: triggerRect.top,
    bottom: viewport.height - triggerRect.bottom,
    left: triggerRect.left,
    right: viewport.width - triggerRect.right,
  };

  // Determine if preferred placement fits
  const fits = {
    top: space.top >= tooltipRect.height + gap + padding,
    bottom: space.bottom >= tooltipRect.height + gap + padding,
    left: space.left >= tooltipRect.width + gap + padding,
    right: space.right >= tooltipRect.width + gap + padding,
  };

  // Choose placement (prefer requested, fallback to opposite, then sides)
  let finalPlacement = preferredPlacement;

  if (preferredPlacement === "top" && !fits.top) {
    finalPlacement = fits.bottom ? "bottom" : fits.left ? "left" : fits.right ? "right" : "bottom";
  } else if (preferredPlacement === "bottom" && !fits.bottom) {
    finalPlacement = fits.top ? "top" : fits.left ? "left" : fits.right ? "right" : "top";
  } else if (preferredPlacement === "left" && !fits.left) {
    finalPlacement = fits.right ? "right" : fits.top ? "top" : fits.bottom ? "bottom" : "right";
  } else if (preferredPlacement === "right" && !fits.right) {
    finalPlacement = fits.left ? "left" : fits.top ? "top" : fits.bottom ? "bottom" : "left";
  }

  // Calculate position based on final placement
  let top: number;
  let left: number;

  switch (finalPlacement) {
    case "top":
      top = triggerRect.top - tooltipRect.height - gap;
      left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
      break;
    case "bottom":
      top = triggerRect.bottom + gap;
      left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
      break;
    case "left":
      top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
      left = triggerRect.left - tooltipRect.width - gap;
      break;
    case "right":
      top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
      left = triggerRect.right + gap;
      break;
  }

  // Clamp horizontal position to viewport
  left = Math.max(padding, Math.min(left, viewport.width - tooltipRect.width - padding));

  // Clamp vertical position to viewport
  top = Math.max(padding, Math.min(top, viewport.height - tooltipRect.height - padding));

  return {
    adjustedPlacement: finalPlacement,
    pos: { top, left },
  };
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

  // Handle escape key - only when tooltip context exists
  // (Provider handles global escape since only one tooltip shows at a time)

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
