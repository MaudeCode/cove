/**
 * Spinner Component
 *
 * Cove's custom loading spinner with gradient tail effect.
 * Matches the ai-glow aesthetic used for streaming sessions.
 */

import { t } from "@/lib/i18n";

export type SpinnerSize = "xs" | "sm" | "md" | "lg";

export interface SpinnerProps {
  /** Spinner size */
  size?: SpinnerSize;
  /** Custom aria-label */
  label?: string;
  /** Additional class names */
  class?: string;
}

const sizeStyles: Record<SpinnerSize, { container: string; thickness: string }> = {
  xs: { container: "w-3 h-3", thickness: "2px" },
  sm: { container: "w-4 h-4", thickness: "2px" },
  md: { container: "w-6 h-6", thickness: "3px" },
  lg: { container: "w-8 h-8", thickness: "3px" },
};

export function Spinner({ size = "md", label, class: className }: SpinnerProps) {
  const styles = sizeStyles[size];

  return (
    <span
      class={`cove-spinner ${styles.container} ${className || ""}`}
      style={{ "--spinner-thickness": styles.thickness }}
      role="status"
      aria-label={label || t("accessibility.loading")}
    >
      {/* Accessible text for screen readers */}
      <span class="sr-only">{label || t("accessibility.loading")}</span>
    </span>
  );
}
