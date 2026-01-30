/**
 * Toast Component
 *
 * Notification toast with auto-dismiss.
 */

import { useEffect } from "preact/hooks";
import { signal } from "@preact/signals";
import { t } from "@/lib/i18n";
import { IconButton } from "./IconButton";
import { CloseIcon } from "./icons";

// ============================================
// Types
// ============================================

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastData {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export interface ToastProps extends ToastData {
  onDismiss: (id: string) => void;
}

// ============================================
// Toast Store
// ============================================

/** Global toast queue */
export const toasts = signal<ToastData[]>([]);

let toastId = 0;

/**
 * Show a toast notification
 */
export function showToast(message: string, type: ToastType = "info", duration = 5000): string {
  const id = `toast-${++toastId}`;

  toasts.value = [...toasts.value, { id, type, message, duration }].slice(-5); // Max 5 toasts

  return id;
}

/**
 * Dismiss a toast by ID
 */
export function dismissToast(id: string): void {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

/**
 * Clear all toasts
 */
export function clearToasts(): void {
  toasts.value = [];
}

// Convenience functions
export const toast = {
  success: (message: string, duration?: number) => showToast(message, "success", duration),
  error: (message: string, duration?: number) => showToast(message, "error", duration),
  warning: (message: string, duration?: number) => showToast(message, "warning", duration),
  info: (message: string, duration?: number) => showToast(message, "info", duration),
};

// ============================================
// Toast Component
// ============================================

const typeStyles: Record<ToastType, { bg: string; icon: string; border: string }> = {
  success: {
    bg: "bg-[var(--color-success)]/10",
    icon: "text-[var(--color-success)]",
    border: "border-[var(--color-success)]/20",
  },
  error: {
    bg: "bg-[var(--color-error)]/10",
    icon: "text-[var(--color-error)]",
    border: "border-[var(--color-error)]/20",
  },
  warning: {
    bg: "bg-[var(--color-warning)]/10",
    icon: "text-[var(--color-warning)]",
    border: "border-[var(--color-warning)]/20",
  },
  info: {
    bg: "bg-[var(--color-accent)]/10",
    icon: "text-[var(--color-accent)]",
    border: "border-[var(--color-accent)]/20",
  },
};

export function Toast({ id, type, message, duration = 5000, onDismiss }: ToastProps) {
  const styles = typeStyles[type];

  // Auto-dismiss
  useEffect(() => {
    if (duration <= 0) return;

    const timer = setTimeout(() => {
      onDismiss(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  return (
    <div
      role="alert"
      aria-live="polite"
      class={`
        flex items-start gap-3 p-4
        rounded-lg border shadow-lg
        ${styles.bg} ${styles.border}
        animate-slide-in
      `}
    >
      {/* Icon */}
      <span class={`flex-shrink-0 ${styles.icon}`} aria-hidden="true">
        <ToastIcon type={type} />
      </span>

      {/* Message */}
      <p class="flex-1 text-sm text-[var(--color-text-primary)]">{message}</p>

      {/* Dismiss */}
      <IconButton
        icon={<CloseIcon class="w-4 h-4" />}
        label={t("actions.close")}
        variant="ghost"
        size="sm"
        onClick={() => onDismiss(id)}
      />
    </div>
  );
}

// ============================================
// Toast Container
// ============================================

export type ToastPosition =
  | "top-right"
  | "top-left"
  | "bottom-right"
  | "bottom-left"
  | "top-center"
  | "bottom-center";

export interface ToastContainerProps {
  position?: ToastPosition;
}

const positionStyles: Record<ToastPosition, string> = {
  "top-right": "top-4 right-4",
  "top-left": "top-4 left-4",
  "bottom-right": "bottom-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "top-center": "top-4 left-1/2 -translate-x-1/2",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
};

export function ToastContainer({ position = "top-right" }: ToastContainerProps) {
  if (toasts.value.length === 0) return null;

  return (
    <div
      class={`fixed z-50 flex flex-col gap-2 w-full max-w-sm ${positionStyles[position]}`}
      aria-label="Notifications"
    >
      {toasts.value.map((toast) => (
        <Toast key={toast.id} {...toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
}

// ============================================
// Icons
// ============================================

function ToastIcon({ type }: { type: ToastType }) {
  const iconClass = "w-5 h-5";

  switch (type) {
    case "success":
      return (
        <svg class={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case "error":
      return (
        <svg class={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      );
    case "warning":
      return (
        <svg class={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      );
    case "info":
    default:
      return (
        <svg class={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
  }
}
