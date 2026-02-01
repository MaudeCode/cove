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
import { Button, LinkButton } from "@/components/ui";
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

export function SpotlightTour({ steps, onComplete, spotlightPadding = 8 }: SpotlightTourProps) {
  const currentIndex = useSignal(0);
  const targetRect = useSignal<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipPosition = useSignal<TooltipPosition | null>(null);
  const transitioning = useSignal(false);

  const currentStep = steps[currentIndex.value];
  const isFirst = currentIndex.value === 0;
  const isLast = currentIndex.value === steps.length - 1;

  // Find and highlight target element
  const updateTarget = useCallback(async () => {
    if (!currentStep) return;

    // Run beforeShow if defined
    if (currentStep.beforeShow) {
      await currentStep.beforeShow();
    }

    // Small delay to let DOM update
    await new Promise((r) => setTimeout(r, 50));

    const element = document.querySelector(currentStep.target);
    if (element) {
      // Scroll element into view
      element.scrollIntoView({ behavior: "smooth", block: "center" });

      // Wait for scroll
      await new Promise((r) => setTimeout(r, 300));

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
    const _ = currentIndex.value; // Subscribe to changes
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
    const padding = 16;
    const arrowSize = 8;

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
        top: rect.bottom + spotlightPadding + arrowSize + padding,
        left: rect.left + rect.width / 2 - tooltipRect.width / 2,
        fits: rect.bottom + spotlightPadding + tooltipRect.height + padding < viewport.height,
      },
      top: {
        top: rect.top - spotlightPadding - tooltipRect.height - arrowSize - padding,
        left: rect.left + rect.width / 2 - tooltipRect.width / 2,
        fits: rect.top - spotlightPadding - tooltipRect.height - padding > 0,
      },
      right: {
        top: rect.top + rect.height / 2 - tooltipRect.height / 2,
        left: rect.right + spotlightPadding + arrowSize + padding,
        fits: rect.right + spotlightPadding + tooltipRect.width + padding < viewport.width,
      },
      left: {
        top: rect.top + rect.height / 2 - tooltipRect.height / 2,
        left: rect.left - spotlightPadding - tooltipRect.width - arrowSize - padding,
        fits: rect.left - spotlightPadding - tooltipRect.width - padding > 0,
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
    left = Math.max(padding, Math.min(left, viewport.width - tooltipRect.width - padding));
    top = Math.max(padding, Math.min(top, viewport.height - tooltipRect.height - padding));

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
    <div class="fixed inset-0 z-[9999]">
      {/* Overlay with spotlight cutout */}
      <svg class="absolute inset-0 w-full h-full">
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
          {currentIndex.value + 1} / {steps.length}
        </div>

        {/* Content */}
        <h3 class="font-semibold text-[var(--color-text-primary)] mb-1">{currentStep?.title}</h3>
        <p class="text-sm text-[var(--color-text-secondary)] mb-4">{currentStep?.content}</p>

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
