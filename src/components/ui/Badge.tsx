/**
 * Badge Component
 *
 * Status indicator badge.
 */

import type { ComponentChildren } from "preact";

export type BadgeVariant = "default" | "success" | "warning" | "error" | "info";
export type BadgeSize = "sm" | "md";

export interface BadgeProps {
  /** Badge variant */
  variant?: BadgeVariant;
  /** Badge size */
  size?: BadgeSize;
  /** Show dot indicator */
  dot?: boolean;
  /** Badge contents */
  children?: ComponentChildren;
  /** Additional class names */
  class?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]",
  success: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
  warning: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
  error: "bg-[var(--color-error)]/15 text-[var(--color-error)]",
  info: "bg-[var(--color-accent)]/15 text-[var(--color-accent)]",
};

const dotStyles: Record<BadgeVariant, string> = {
  default: "bg-[var(--color-text-muted)]",
  success: "bg-[var(--color-success)]",
  warning: "bg-[var(--color-warning)]",
  error: "bg-[var(--color-error)]",
  info: "bg-[var(--color-accent)]",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "px-1.5 py-0.5 text-xs",
  md: "px-2 py-1 text-xs",
};

export function Badge({
  variant = "default",
  size = "md",
  dot = false,
  children,
  class: className,
}: BadgeProps) {
  return (
    <span
      class={`
        inline-flex items-center gap-1.5
        font-medium rounded-full
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className || ""}
      `}
    >
      {dot && <span class={`w-1.5 h-1.5 rounded-full ${dotStyles[variant]}`} aria-hidden="true" />}
      {children}
    </span>
  );
}
