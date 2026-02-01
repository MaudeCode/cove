/**
 * IconButton Component
 *
 * Accessible icon-only button with tooltip.
 */

import type { ComponentChildren, JSX } from "preact";
import { forwardRef } from "preact/compat";
import { Spinner } from "./Spinner";
import { Tooltip, type TooltipPlacement } from "./Tooltip";

export type IconButtonSize = "sm" | "md" | "lg";
export type IconButtonVariant = "default" | "ghost" | "danger";

export interface IconButtonProps extends Omit<JSX.HTMLAttributes<HTMLButtonElement>, "size"> {
  /** Icon to display */
  icon: ComponentChildren;
  /** Accessible label (required for a11y) */
  label: string;
  /** Button size */
  size?: IconButtonSize;
  /** Button variant */
  variant?: IconButtonVariant;
  /** Disabled state */
  disabled?: boolean;
  /** Show loading spinner */
  loading?: boolean;
  /** Show tooltip on hover (default: true) */
  showTooltip?: boolean;
  /** Tooltip placement */
  tooltipPlacement?: TooltipPlacement;
}

const sizeStyles: Record<IconButtonSize, { button: string; icon: string }> = {
  sm: { button: "p-1.5", icon: "w-4 h-4" },
  md: { button: "p-2", icon: "w-5 h-5" },
  lg: { button: "p-3", icon: "w-6 h-6" },
};

const variantStyles: Record<IconButtonVariant, string> = {
  default: `
    text-[var(--color-text-secondary)]
    hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]
    focus-visible:ring-[var(--color-accent)]
  `,
  ghost: `
    text-[var(--color-text-muted)]
    hover:bg-[var(--color-bg-primary)] hover:text-[var(--color-text-secondary)]
    focus-visible:ring-[var(--color-accent)]
  `,
  danger: `
    text-[var(--color-text-secondary)]
    hover:bg-[var(--color-error)]/10 hover:text-[var(--color-error)]
    focus-visible:ring-[var(--color-error)]
  `,
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      label,
      size = "md",
      variant = "default",
      loading = false,
      disabled,
      showTooltip = true,
      tooltipPlacement = "top",
      class: className,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;
    const styles = sizeStyles[size];

    const button = (
      <button
        ref={ref}
        type="button"
        disabled={isDisabled}
        aria-label={label}
        class={`
          inline-flex items-center justify-center
          rounded-md transition-all duration-200 ease-out
          hover:scale-105 active:scale-95
          focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100
          ${styles.button}
          ${variantStyles[variant]}
          ${className || ""}
        `}
        {...props}
      >
        {loading ? (
          <Spinner size="sm" />
        ) : (
          <span
            class={`${styles.icon} flex items-center justify-center [&>svg]:w-full [&>svg]:h-full`}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
      </button>
    );

    if (showTooltip && label) {
      return (
        <Tooltip content={label} placement={tooltipPlacement} delay={400}>
          {button}
        </Tooltip>
      );
    }

    return button;
  },
);

IconButton.displayName = "IconButton";
