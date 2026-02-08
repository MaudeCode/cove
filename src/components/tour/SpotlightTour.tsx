/**
 * SpotlightTour
 *
 * Interactive tour with spotlight overlay highlighting UI elements.
 * Tooltips point to actual elements on the page.
 */

import { useSignal, useSignalEffect } from "@preact/signals";
import { useEffect, useRef, useCallback } from "preact/hooks";
import { createPortal } from "preact/compat";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";
import { ArrowRight, ArrowLeft, X } from "lucide-preact";

export interface TourStep {
  /** CSS selector for target element */
  target: string;
  /** Title of the step */
  title: string;
  /** Description/content */
  content: string;
  /** Preferred tooltip placement */
  placement?: "top" | "bottom" | "left" | "right";
  /** Action to perform before showing this step */
  beforeShow?: () => void | Promise<void>;
  /** If provided, auto-advance to next step when this returns true (polled) */
  autoAdvanceWhen?: () => boolean;
}

interface SpotlightTourProps {
  /** Tour steps */
  steps: TourStep[];
  /** Called when tour completes or is skipped */
  onComplete: () => void;
  /** Padding around spotlight (px) */
  spotlightPadding?: number;
}

interface TooltipPosition {
  top: number;
  left: number;
  arrowPosition: "top" | "bottom" | "left" | "right";
}

// Timing constants
const FADE_DURATION_MS = 150;
const SCROLL_WAIT_MS = 300;
const DOM_UPDATE_WAIT_MS = 50;

// Layout constants
const TOOLTIP_PADDING = 16;
const ARROW_SIZE = 8;
const DEFAULT_SPOTLIGHT_PADDING = 8;

export function SpotlightTour({
  steps,
  onComplete,
  spotlightPadding = DEFAULT_SPOTLIGHT_PADDING,
}: SpotlightTourProps) {
  const currentIndex = useSignal(0);
  const displayedIndex = useSignal(0); // Lags behind currentIndex for content display
  const targetRect = useSignal<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipPosition = useSignal<TooltipPosition | null>(null);
  const transitioning = useSignal(false);

  // Use displayedIndex for content so it doesn't change until after fade
  const displayedStep = steps[displayedIndex.value];
  const currentStep = steps[currentIndex.value];
  const isFirst = currentIndex.value === 0;
  const isLast = currentIndex.value === steps.length - 1;

  // Track the currently highlighted element to restore its z-index
  const highlightedElement = useRef<HTMLElement | null>(null);
  const originalZIndex = useRef<string>("");
  const originalPosition = useRef<string>("");

  // Find and highlight target element
  const updateTarget = useCallback(async () => {
    if (!currentStep) return;

    // Restore previous element's z-index
    if (highlightedElement.current) {
      highlightedElement.current.style.zIndex = originalZIndex.current;
      highlightedElement.current.style.position = originalPosition.current;
      highlightedElement.current = null;
    }

    // Wait for fade out to complete before updating content
    await new Promise((r) => setTimeout(r, FADE_DURATION_MS));
    displayedIndex.value = currentIndex.peek();

    // Run beforeShow if defined
    if (currentStep.beforeShow) {
      await currentStep.beforeShow();
    }

    // Small delay to let DOM update
    await new Promise((r) => setTimeout(r, DOM_UPDATE_WAIT_MS));

    // Find the first VISIBLE matching element (handles responsive duplicates)
    const elements = document.querySelectorAll(currentStep.target);
    let element: HTMLElement | null = null;
    for (const el of elements) {
      if (el instanceof HTMLElement && el.offsetParent !== null) {
        element = el;
        break;
      }
    }
    if (element) {
      // Scroll element into view
      element.scrollIntoView({ behavior: "smooth", block: "center" });

      // Wait for scroll
      await new Promise((r) => setTimeout(r, SCROLL_WAIT_MS));

      // Boost element above overlay so it's clickable
      originalZIndex.current = element.style.zIndex;
      originalPosition.current = element.style.position;
      highlightedElement.current = element;
      if (!element.style.position || element.style.position === "static") {
        element.style.position = "relative";
      }
      element.style.zIndex = "10000";

      const rect = element.getBoundingClientRect();
      targetRect.value = rect;
    } else {
      // Target not found, skip to next step or complete
      targetRect.value = null;
    }

    // End transition after position updates
    transitioning.value = false;
  }, [currentStep]);

  // Update target when step changes
  useSignalEffect(() => {
    void currentIndex.value; // Subscribe to changes
    transitioning.value = true;
    // Don't clear position - keep old position during fade out
    updateTarget();
  });

  // Calculate tooltip position when target changes
  useSignalEffect(() => {
    const rect = targetRect.value;
    if (!rect || !tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const tooltipRect = tooltip.getBoundingClientRect();

    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    let placement = currentStep?.placement || "bottom";
    let top = 0;
    let left = 0;

    // Calculate position based on placement, with fallbacks
    const positions = {
      bottom: {
        top: rect.bottom + spotlightPadding + ARROW_SIZE + TOOLTIP_PADDING,
        left: rect.left + rect.width / 2 - tooltipRect.width / 2,
        fits:
          rect.bottom + spotlightPadding + tooltipRect.height + TOOLTIP_PADDING < viewport.height,
      },
      top: {
        top: rect.top - spotlightPadding - tooltipRect.height - ARROW_SIZE - TOOLTIP_PADDING,
        left: rect.left + rect.width / 2 - tooltipRect.width / 2,
        fits: rect.top - spotlightPadding - tooltipRect.height - TOOLTIP_PADDING > 0,
      },
      right: {
        top: rect.top + rect.height / 2 - tooltipRect.height / 2,
        left: rect.right + spotlightPadding + ARROW_SIZE + TOOLTIP_PADDING,
        fits: rect.right + spotlightPadding + tooltipRect.width + TOOLTIP_PADDING < viewport.width,
      },
      left: {
        top: rect.top + rect.height / 2 - tooltipRect.height / 2,
        left: rect.left - spotlightPadding - tooltipRect.width - ARROW_SIZE - TOOLTIP_PADDING,
        fits: rect.left - spotlightPadding - tooltipRect.width - TOOLTIP_PADDING > 0,
      },
    };

    // Try preferred placement, then fallback
    const order: Array<"bottom" | "top" | "right" | "left"> =
      placement === "top"
        ? ["top", "bottom", "right", "left"]
        : placement === "left"
          ? ["left", "right", "bottom", "top"]
          : placement === "right"
            ? ["right", "left", "bottom", "top"]
            : ["bottom", "top", "right", "left"];

    for (const p of order) {
      if (positions[p].fits) {
        placement = p;
        break;
      }
    }

    const pos = positions[placement];
    top = pos.top;
    left = pos.left;

    // Clamp to viewport
    left = Math.max(
      TOOLTIP_PADDING,
      Math.min(left, viewport.width - tooltipRect.width - TOOLTIP_PADDING),
    );
    top = Math.max(
      TOOLTIP_PADDING,
      Math.min(top, viewport.height - tooltipRect.height - TOOLTIP_PADDING),
    );

    // Arrow points opposite to placement
    const arrowPosition =
      placement === "bottom"
        ? "top"
        : placement === "top"
          ? "bottom"
          : placement === "left"
            ? "right"
            : "left";

    tooltipPosition.value = { top, left, arrowPosition };
  });

  // Handle resize
  useEffect(() => {
    const handleResize = () => updateTarget();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateTarget]);

  // Cleanup highlighted element z-index on unmount
  useEffect(() => {
    return () => {
      if (highlightedElement.current) {
        highlightedElement.current.style.zIndex = originalZIndex.current;
        highlightedElement.current.style.position = originalPosition.current;
      }
    };
  }, []);

  // Poll autoAdvanceWhen condition
  useEffect(() => {
    if (!currentStep?.autoAdvanceWhen) return;

    const interval = setInterval(() => {
      if (currentStep.autoAdvanceWhen?.()) {
        if (isLast) {
          onComplete();
        } else {
          currentIndex.value++;
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [currentStep, isLast, onComplete]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onComplete();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        if (isLast) {
          onComplete();
        } else {
          currentIndex.value++;
        }
      } else if (e.key === "ArrowLeft" && !isFirst) {
        currentIndex.value--;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFirst, isLast, onComplete]);

  const goNext = () => {
    if (isLast) {
      onComplete();
    } else {
      currentIndex.value++;
    }
  };

  const goBack = () => {
    if (!isFirst) {
      currentIndex.value--;
    }
  };

  const rect = targetRect.value;
  const pos = tooltipPosition.value;

  return createPortal(
    <div class="fixed inset-0 z-[9999] pointer-events-none">
      {/* Overlay with spotlight cutout - pointer-events-none so clicks pass through to spotlighted element */}
      <svg class="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - spotlightPadding}
                y={rect.top - spotlightPadding}
                width={rect.width + spotlightPadding * 2}
                height={rect.height + spotlightPadding * 2}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.75)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Spotlight border/highlight */}
      {rect && (
        <div
          class="absolute border-2 border-[var(--color-accent)] rounded-lg pointer-events-none"
          style={{
            top: rect.top - spotlightPadding,
            left: rect.left - spotlightPadding,
            width: rect.width + spotlightPadding * 2,
            height: rect.height + spotlightPadding * 2,
          }}
        />
      )}

      {/* Tooltip - z-10 to be above click blocker */}
      <div
        ref={tooltipRef}
        class="absolute z-10 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl shadow-lg p-4 max-w-sm transition-opacity duration-150"
        style={{
          top: pos?.top ?? -9999,
          left: pos?.left ?? -9999,
          opacity: pos && !transitioning.value ? 1 : 0,
          pointerEvents: pos && !transitioning.value ? "auto" : "none",
        }}
      >
        {/* Arrow */}
        {pos && (
          <div
            class={`absolute w-3 h-3 bg-[var(--color-bg-surface)] border-[var(--color-border)] transform rotate-45 ${
              pos.arrowPosition === "top"
                ? "-top-1.5 left-1/2 -translate-x-1/2 border-l border-t"
                : pos.arrowPosition === "bottom"
                  ? "-bottom-1.5 left-1/2 -translate-x-1/2 border-r border-b"
                  : pos.arrowPosition === "left"
                    ? "-left-1.5 top-1/2 -translate-y-1/2 border-l border-b"
                    : "-right-1.5 top-1/2 -translate-y-1/2 border-r border-t"
            }`}
          />
        )}

        {/* Step counter */}
        <div class="text-xs text-[var(--color-text-muted)] mb-2">
          {displayedIndex.value + 1} / {steps.length}
        </div>

        {/* Content */}
        <h3 class="font-semibold text-[var(--color-text-primary)] mb-1">{displayedStep?.title}</h3>
        <p class="text-sm text-[var(--color-text-secondary)] mb-4">{displayedStep?.content}</p>

        {/* Navigation */}
        <div class="flex items-center justify-between gap-2">
          <LinkButton onClick={onComplete} icon={<X class="w-3 h-3" />}>
            {t("tour.skipTour")}
          </LinkButton>

          <div class="flex gap-2">
            {!isFirst && (
              <Button
                variant="ghost"
                size="sm"
                onClick={goBack}
                icon={<ArrowLeft class="w-3 h-3" />}
              >
                {t("actions.back")}
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={goNext}
              iconRight={<ArrowRight class="w-3 h-3" />}
            >
              {isLast ? t("actions.done") : t("actions.next")}
            </Button>
          </div>
        </div>
      </div>

      {/* Click blocker for non-target areas */}
      <div
        class="absolute inset-0"
        role="presentation"
        onClick={(e) => {
          // Allow clicks on the spotlight target
          if (rect) {
            const x = e.clientX;
            const y = e.clientY;
            const inSpotlight =
              x >= rect.left - spotlightPadding &&
              x <= rect.right + spotlightPadding &&
              y >= rect.top - spotlightPadding &&
              y <= rect.bottom + spotlightPadding;
            if (!inSpotlight) {
              e.preventDefault();
              e.stopPropagation();
            }
          }
        }}
        onKeyDown={() => {
          // Keyboard events handled globally
        }}
        style={{ pointerEvents: "auto" }}
      />
    </div>,
    document.body,
  );
}
