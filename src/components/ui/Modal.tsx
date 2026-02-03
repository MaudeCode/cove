/**
 * Modal Component
 *
 * Accessible modal dialog with focus trap and keyboard handling.
 * Uses createPortal to render at document body level (avoids stacking context issues).
 */

import type { ComponentChildren } from "preact";
import { createPortal } from "preact/compat";
import { useEffect, useRef, useCallback } from "preact/hooks";
import { t } from "@/lib/i18n";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { IconButton } from "./IconButton";
import { XIcon } from "./icons";

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
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  full: "max-w-4xl",
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

  // Use focus trap hook for proper focus cycling within modal
  useFocusTrap(modalRef, {
    enabled: open,
    autoFocus: true,
  });

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEscape) {
        onClose();
      }
    },
    [closeOnEscape, onClose],
  );

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (!open) return;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Escape key listener
  useEffect(() => {
    if (!open) return;

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  // Render modal at document body level using portal to avoid stacking context issues
  return createPortal(
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      {/* Backdrop */}
      <div
        class="absolute inset-0 bg-black/40 backdrop-blur-md animate-fade-in"
        onClick={closeOnBackdrop ? onClose : undefined}
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
          rounded-xl shadow-soft-xl
          max-h-[90vh] flex flex-col
          focus:outline-none
          animate-scale-in
        `}
      >
        {/* Header */}
        {(title || !hideCloseButton) && (
          <div class="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
            {title && (
              <h2 id="modal-title" class="text-lg font-semibold text-[var(--color-text-primary)]">
                {title}
              </h2>
            )}
            {!hideCloseButton && (
              <IconButton
                icon={<XIcon />}
                label={t("actions.close")}
                variant="ghost"
                size="sm"
                onClick={onClose}
                class={title ? "" : "ml-auto"}
              />
            )}
          </div>
        )}

        {/* Body */}
        <div class="flex-1 overflow-y-auto px-6 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div class="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
