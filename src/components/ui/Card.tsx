/**
 * Card Component
 *
 * Surface container with consistent styling.
 */

import type { ComponentChildren, JSX } from "preact";

type CardVariant = "default" | "elevated" | "outlined";
type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Card variant */
  variant?: CardVariant;
  /** Card padding */
  padding?: CardPadding;
  /** Card title */
  title?: string;
  /** Card subtitle/description */
  subtitle?: string;
  /** Header actions (buttons, etc.) */
  headerActions?: ComponentChildren;
  /** Footer content */
  footer?: ComponentChildren;
  /** Card contents */
  children?: ComponentChildren;
}

const variantStyles: Record<CardVariant, string> = {
  default: `
    bg-[var(--color-bg-surface)]
    border border-[var(--color-border)]
    shadow-soft-sm
    transition-shadow duration-200 ease-out
    hover:shadow-soft
  `,
  elevated: `
    bg-[var(--color-bg-surface)]
    border border-[var(--color-border)]
    shadow-soft-lg
    transition-shadow duration-200 ease-out
    hover:shadow-soft-xl
  `,
  outlined: `
    bg-transparent
    border border-[var(--color-border)]
    transition-colors duration-200 ease-out
  `,
};

const paddingStyles: Record<CardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export function Card({
  variant = "default",
  padding = "md",
  title,
  subtitle,
  headerActions,
  footer,
  children,
  class: className,
  ...props
}: CardProps) {
  const hasHeader = title || subtitle || headerActions;

  return (
    <div class={`rounded-xl ${variantStyles[variant]} ${className || ""}`} {...props}>
      {hasHeader && (
        <div
          class={`
            flex items-start justify-between gap-4
            ${padding !== "none" ? paddingStyles[padding] : "p-4"}
            ${children || footer ? "border-b border-[var(--color-border)]" : ""}
          `}
        >
          <div>
            {title && <h3 class="font-medium text-[var(--color-text-primary)]">{title}</h3>}
            {subtitle && <p class="text-sm text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>}
          </div>
          {headerActions && <div class="flex items-center gap-2">{headerActions}</div>}
        </div>
      )}

      {children && <div class={paddingStyles[padding]}>{children}</div>}

      {footer && (
        <div
          class={`
            ${paddingStyles[padding]}
            border-t border-[var(--color-border)]
            bg-[var(--color-bg-secondary)]/50
            rounded-b-2xl
          `}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
