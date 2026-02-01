/* eslint-disable no-unused-vars */
/**
 * Toast Component
 *
 * Notification toast with auto-dismiss.
 */

import { useEffect } from "preact/hooks";
import { signal } from "@preact/signals";
import { Check, X, AlertTriangle, Info } from "lucide-preact";
import { t } from "@/lib/i18n";
import { IconButton } from "./IconButton";
import { XIcon } from "./icons";

// ============================================
// Types
// ============================================

type ToastType = "success" | "error" | "warning" | "info";

interface ToastData {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastProps extends ToastData {
  onDismiss: (id: string) => void;
}

// ============================================
// Toast Store
// ============================================

/** Global toast queue */
const toasts = signal<ToastData[]>([]);

let toastId = 0;

/**
 * Show a toast notification
 */
function showToast(message: string, type: ToastType = "info", duration = 5000): string {
  const id = `toast-${++toastId}`;

  toasts.value = [...toasts.value, { id, type, message, duration }].slice(-5); // Max 5 toasts

  return id;
}

/**
 * Dismiss a toast by ID
 */
function dismissToast(id: string): void {
  toasts.value = toasts.value.filter((t) => t.id !== id);
}

/**
 * Clear all toasts
 */
function clearToasts(): void {
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

function Toast({ id, type, message, duration = 5000, onDismiss }: ToastProps) {
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
        rounded-xl border shadow-soft-lg
        backdrop-blur-sm
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
        icon={<XIcon class="w-4 h-4" />}
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

type ToastPosition =
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
      return <Check class={iconClass} aria-hidden="true" />;
    case "error":
      return <X class={iconClass} aria-hidden="true" />;
    case "warning":
      return <AlertTriangle class={iconClass} aria-hidden="true" />;
    case "info":
    default:
      return <Info class={iconClass} aria-hidden="true" />;
  }
}
