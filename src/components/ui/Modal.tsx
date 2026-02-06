/**
 * Modal Component
 *
 * Accessible modal dialog with focus trap and keyboard handling.
 * Uses createPortal to render at document body level (avoids stacking context issues).
 * On mobile: renders as bottom sheet with drag-to-dismiss.
 */

import type { ComponentChildren } from "preact";
import { createPortal } from "preact/compat";
import { useEffect, useRef, useCallback, useState } from "preact/hooks";
import { t } from "@/lib/i18n";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { IconButton } from "./IconButton";
import { XIcon } from "./icons";

const ANIMATION_DURATION = 250;
const DRAG_THRESHOLD = 80;

type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

export interface ModalProps {
  /** Whether modal is open */
  open: boolean;
  /** Called when modal should close */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Modal size */
  size?: ModalSize;
  /** Hide close button */
  hideCloseButton?: boolean;
  /** Close on backdrop click */
  closeOnBackdrop?: boolean;
  /** Close on Escape key */
  closeOnEscape?: boolean;
  /** Modal contents */
  children: ComponentChildren;
  /** Footer content */
  footer?: ComponentChildren;
}

const sizeStyles: Record<ModalSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  full: "sm:max-w-4xl",
};

export function Modal({
  open,
  onClose,
  title,
  size = "md",
  hideCloseButton = false,
  closeOnBackdrop = true,
  closeOnEscape = true,
  children,
  footer,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(open);
  const isClosingRef = useRef(false);
  const dragStartY = useRef<number | null>(null);

  // Animate close
  const animateClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    const modal = modalRef.current;
    const backdrop = backdropRef.current;
    if (modal) {
      modal.style.transition = `transform ${ANIMATION_DURATION}ms ease-out`;
      modal.style.transform = "translateY(100%)";
    }
    if (backdrop) {
      backdrop.style.transition = `opacity ${ANIMATION_DURATION}ms ease-out`;
      backdrop.style.opacity = "0";
    }

    setTimeout(() => {
      setShouldRender(false);
      isClosingRef.current = false;
      onClose();
    }, ANIMATION_DURATION);
  }, [onClose]);

  // Handle open state changes
  useEffect(() => {
    if (open) {
      setShouldRender(true);
      isClosingRef.current = false;
    } else if (shouldRender && !isClosingRef.current) {
      animateClose();
    }
  }, [open, shouldRender, animateClose]);

  // Reset modal position when opening
  useEffect(() => {
    if (open && modalRef.current) {
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        if (modalRef.current) {
          modalRef.current.style.transform = "";
          modalRef.current.style.transition = "";
        }
        if (backdropRef.current) {
          backdropRef.current.style.opacity = "";
          backdropRef.current.style.transition = "";
        }
      });
    }
  }, [open]);

  // Use focus trap hook - disable autoFocus to prevent close button highlight
  useFocusTrap(modalRef, {
    enabled: open && !isClosingRef.current,
    autoFocus: false,
  });

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEscape && !isClosingRef.current) {
        animateClose();
      }
    },
    [closeOnEscape, animateClose],
  );

  // Touch handlers - direct DOM manipulation for performance
  const onTouchStart = useCallback((e: TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    if (modalRef.current) {
      modalRef.current.style.transition = "none";
    }
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (dragStartY.current === null) return;
    const currentY = e.touches[0].clientY;
    const delta = currentY - dragStartY.current;

    if (delta > 0) {
      if (modalRef.current) {
        modalRef.current.style.transform = `translateY(${delta}px)`;
      }
      // Fade backdrop proportionally
      if (backdropRef.current) {
        const opacity = Math.max(0, 1 - delta / 300);
        backdropRef.current.style.opacity = String(opacity);
      }
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (dragStartY.current === null) return;

    const modal = modalRef.current;
    if (modal) {
      const transform = modal.style.transform;
      const match = transform.match(/translateY\((\d+)px\)/);
      const currentOffset = match ? parseInt(match[1], 10) : 0;

      if (currentOffset > DRAG_THRESHOLD) {
        // Dismiss
        animateClose();
      } else {
        // Snap back
        modal.style.transition = "transform 150ms ease-out";
        modal.style.transform = "translateY(0)";
        if (backdropRef.current) {
          backdropRef.current.style.transition = "opacity 150ms ease-out";
          backdropRef.current.style.opacity = "1";
        }
      }
    }

    dragStartY.current = null;
  }, [animateClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (!shouldRender) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [shouldRender]);

  // Escape key listener
  useEffect(() => {
    if (!shouldRender) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [shouldRender, handleKeyDown]);

  if (!shouldRender) return null;

  const handleBackdropClick = () => {
    if (closeOnBackdrop && !isClosingRef.current) {
      animateClose();
    }
  };

  return createPortal(
    <div
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      {/* Backdrop */}
      <div
        ref={backdropRef}
        class="absolute inset-0 bg-black/40 backdrop-blur-md animate-fade-in"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div
        ref={modalRef}
        tabIndex={-1}
        class={`
          relative w-full ${sizeStyles[size]}
          bg-[var(--color-bg-surface)]
          border border-[var(--color-border)]
          max-h-[85vh] sm:max-h-[90vh] flex flex-col
          focus:outline-none shadow-soft-xl
          rounded-t-xl border-b-0 sm:rounded-xl sm:border-b
          animate-slide-up-full sm:animate-scale-in
        `}
      >
        {/* Drag handle - mobile only (visual affordance, dismiss via backdrop/Escape) */}
        <div
          class="sm:hidden flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          aria-hidden="true"
        >
          <div class="w-10 h-1 rounded-full bg-[var(--color-text-muted)]/40" />
        </div>

        {/* Header */}
        {title && (
          <div class="flex items-center justify-between px-4 sm:px-6 py-2 sm:py-4 border-b border-[var(--color-border)]">
            <h2
              id="modal-title"
              class="text-base sm:text-lg font-semibold text-[var(--color-text-primary)] truncate pr-2"
            >
              {title}
            </h2>
            {/* Close button - desktop only */}
            {!hideCloseButton && (
              <IconButton
                icon={<XIcon />}
                label={t("actions.close")}
                variant="ghost"
                size="sm"
                onClick={animateClose}
                class="hidden sm:flex flex-shrink-0"
              />
            )}
          </div>
        )}

        {/* Body */}
        <div class="flex-1 overflow-y-auto px-4 sm:px-6 py-3 sm:py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div class="px-4 sm:px-6 py-3 sm:py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] sm:rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
