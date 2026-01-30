/**
 * Select Component
 *
 * Accessible select dropdown.
 */

import type { JSX } from "preact";
import { forwardRef } from "preact/compat";

export type SelectSize = "sm" | "md" | "lg";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<JSX.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  /** Options to display */
  options: SelectOption[];
  /** Select size */
  size?: SelectSize;
  /** Error message */
  error?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Full width */
  fullWidth?: boolean;
}

const sizeStyles: Record<SelectSize, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3 py-2 text-sm",
  lg: "px-4 py-3 text-base",
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      options,
      size = "md",
      error,
      placeholder,
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
        <select
          ref={ref}
          disabled={disabled}
          class={`
            block rounded-lg cursor-pointer
            bg-[var(--color-bg-primary)]
            border transition-colors
            focus:outline-none focus:ring-2 focus:ring-offset-0
            disabled:opacity-50 disabled:cursor-not-allowed
            ${
              hasError
                ? "border-[var(--color-error)] focus:ring-[var(--color-error)]"
                : "border-[var(--color-border)] focus:ring-[var(--color-accent)] focus:border-transparent"
            }
            ${sizeStyles[size]}
            ${fullWidth ? "w-full" : ""}
            ${className || ""}
          `}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${props.id}-error` : undefined}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p id={`${props.id}-error`} class="mt-1 text-xs text-[var(--color-error)]" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Select.displayName = "Select";
