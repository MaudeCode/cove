/**
 * IconButton Component
 *
 * Accessible icon-only button with tooltip.
 */

import type { ComponentChildren, JSX } from "preact";
import { forwardRef } from "preact/compat";
import { Spinner } from "./Spinner";

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
      class: className,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;
    const styles = sizeStyles[size];

    return (
      <button
        ref={ref}
        type="button"
        disabled={isDisabled}
        aria-label={label}
        title={label}
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
  },
);

IconButton.displayName = "IconButton";
