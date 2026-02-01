/**
 * Chip Component
 *
 * Interactive chip/pill for filters, tags, and selections.
 * Unlike Badge (display-only), Chip is clickable.
 */

import type { ComponentChildren } from "preact";

type ChipSize = "xs" | "sm" | "md";

export interface ChipProps {
  /** Whether the chip is selected/active */
  selected?: boolean;
  /** Chip size */
  size?: ChipSize;
  /** Click handler */
  onClick?: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Chip contents */
  children?: ComponentChildren;
  /** Additional class names */
  class?: string;
}

const sizeStyles: Record<ChipSize, string> = {
  xs: "px-2 py-0.5 text-[10px]",
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
};

export function Chip({
  selected = false,
  size = "sm",
  onClick,
  disabled = false,
  children,
  class: className,
}: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      class={`
        inline-flex items-center justify-center
        font-medium rounded-md transition-colors
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeStyles[size]}
        ${
          selected
            ? "bg-[var(--color-accent)] text-white"
            : "bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
        }
        ${className || ""}
      `}
    >
      {children}
    </button>
  );
}
