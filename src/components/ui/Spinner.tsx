/**
 * Spinner Component
 *
 * Accessible loading spinner.
 */

import { t } from "@/lib/i18n";

export type SpinnerSize = "sm" | "md" | "lg";

export interface SpinnerProps {
  /** Spinner size */
  size?: SpinnerSize;
  /** Custom aria-label */
  label?: string;
  /** Additional class names */
  class?: string;
}

const sizeStyles: Record<SpinnerSize, string> = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

export function Spinner({ size = "md", label, class: className }: SpinnerProps) {
  return (
    <svg
      class={`animate-spin ${sizeStyles[size]} ${className || ""}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-label={label || t("accessibility.loading")}
      role="status"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
