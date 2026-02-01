/**
 * Input Component
 *
 * Accessible text input with error state.
 */

import type { JSX } from "preact";
import { forwardRef } from "preact/compat";

export type InputSize = "sm" | "md" | "lg";

interface InputProps extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Input size */
  size?: InputSize;
  /** Error message */
  error?: string;
  /** Left icon/element */
  leftElement?: JSX.Element;
  /** Right icon/element */
  rightElement?: JSX.Element;
  /** Full width */
  fullWidth?: boolean;
}

const sizeStyles: Record<InputSize, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3 py-2 text-sm",
  lg: "px-4 py-3 text-base",
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size = "md",
      error,
      leftElement,
      rightElement,
      fullWidth = false,
      disabled,
      class: className,
      ...props
    },
    ref,
  ) => {
    const hasError = Boolean(error);

    return (
      <div class={`${fullWidth ? "w-full" : ""}`}>
        <div class="relative">
          {leftElement && (
            <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--color-text-muted)]">
              {leftElement}
            </div>
          )}
          <input
            ref={ref}
            disabled={disabled}
            class={`
              block rounded-xl
              bg-[var(--color-bg-primary)]
              border transition-all duration-200 ease-out
              shadow-soft-sm focus:shadow-soft
              placeholder:text-[var(--color-text-muted)]
              focus:outline-none focus:ring-2 focus:ring-offset-0
              disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
              ${
                hasError
                  ? "border-[var(--color-error)] focus:ring-[var(--color-error)]"
                  : "border-[var(--color-border)] focus:ring-[var(--color-accent)] focus:border-transparent"
              }
              ${sizeStyles[size]}
              ${leftElement ? "pl-10" : ""}
              ${rightElement ? "pr-10" : ""}
              ${fullWidth ? "w-full" : ""}
              ${className || ""}
            `}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${props.id}-error` : undefined}
            {...props}
          />
          {rightElement && (
            <div class="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--color-text-muted)]">
              {rightElement}
            </div>
          )}
        </div>
        {error && (
          <p id={`${props.id}-error`} class="mt-1 text-xs text-[var(--color-error)]" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
