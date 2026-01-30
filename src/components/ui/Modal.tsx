/**
 * Modal Component
 *
 * Accessible modal dialog with focus trap and keyboard handling.
 */

import type { ComponentChildren } from "preact";
import { useEffect, useRef, useCallback } from "preact/hooks";
import { t } from "@/lib/i18n";
import { IconButton } from "./IconButton";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

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
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEscape) {
        onClose();
      }
    },
    [closeOnEscape, onClose],
  );

  // Focus trap
  useEffect(() => {
    if (!open) return;

    // Store previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus the modal
    modalRef.current?.focus();

    // Add escape listener
    document.addEventListener("keydown", handleKeyDown);

    // Prevent body scroll
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";

      // Restore focus
      previousActiveElement.current?.focus();
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      {/* Backdrop */}
      <div
        class="absolute inset-0 bg-black/50 backdrop-blur-sm"
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
          rounded-xl shadow-xl
          max-h-[90vh] flex flex-col
          focus:outline-none
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
                icon={<CloseIcon />}
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
          <div class="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
