/**
 * Button Component
 *
 * Accessible button with variants, sizes, and loading state.
 */

import type { ComponentChildren, JSX } from "preact";
import { forwardRef } from "preact/compat";
import { Spinner } from "./Spinner";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends Omit<JSX.HTMLAttributes<HTMLButtonElement>, "size" | "loading"> {
  /** HTML button type */
  type?: "button" | "submit" | "reset";
  /** Button variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Disabled state */
  disabled?: boolean;
  /** Show loading spinner */
  loading?: boolean;
  /** Icon to show before text */
  icon?: ComponentChildren;
  /** Icon to show after text */
  iconRight?: ComponentChildren;
  /** Full width button */
  fullWidth?: boolean;
  /** Button contents */
  children?: ComponentChildren;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-[var(--color-accent)] text-white
    hover:opacity-90
    focus-visible:ring-[var(--color-accent)]
  `,
  secondary: `
    bg-[var(--color-bg-surface)] text-[var(--color-text-primary)]
    border border-[var(--color-border)]
    hover:bg-[var(--color-bg-secondary)]
    focus-visible:ring-[var(--color-accent)]
  `,
  ghost: `
    bg-transparent text-[var(--color-text-secondary)]
    hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]
    focus-visible:ring-[var(--color-accent)]
  `,
  danger: `
    bg-[var(--color-error)] text-white
    hover:opacity-90
    focus-visible:ring-[var(--color-error)]
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-6 py-3 text-base gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      type = "button",
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      iconRight,
      fullWidth = false,
      disabled,
      children,
      class: className,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        class={`
          inline-flex items-center justify-center
          font-medium rounded-xl
          transition-all duration-200 ease-out
          shadow-soft-sm hover:shadow-soft
          active:scale-[0.97] active:shadow-none
          focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? "w-full" : ""}
          ${className || ""}
        `}
        {...props}
      >
        {loading ? (
          <Spinner size={size === "lg" ? "md" : "sm"} />
        ) : icon ? (
          <span class="flex-shrink-0" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        {children && <span>{children}</span>}
        {iconRight && !loading && (
          <span class="flex-shrink-0" aria-hidden="true">
            {iconRight}
          </span>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
