/**
 * Select Component
 *
 * Accessible select dropdown with custom chevron.
 */

import type { JSX } from "preact";
import { forwardRef } from "preact/compat";
import { ChevronDown } from "lucide-preact";

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
  sm: "pl-2.5 pr-8 py-1.5 text-xs",
  md: "pl-3 pr-9 py-2 text-sm",
  lg: "pl-4 pr-10 py-3 text-base",
};

const iconSizes: Record<SelectSize, string> = {
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
  lg: "w-5 h-5",
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
        <div class="relative">
          <select
            ref={ref}
            disabled={disabled}
            class={`
              block w-full rounded-xl cursor-pointer appearance-none
              bg-[var(--color-bg-primary)]
              border transition-all duration-200 ease-out
              shadow-soft-sm focus:shadow-soft
              focus:outline-none focus:ring-2 focus:ring-offset-0
              disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
              ${
                hasError
                  ? "border-[var(--color-error)] focus:ring-[var(--color-error)]"
                  : "border-[var(--color-border)] focus:ring-[var(--color-accent)] focus:border-transparent"
              }
              ${sizeStyles[size]}
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
          <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--color-text-muted)]">
            <ChevronDown class={iconSizes[size]} />
          </div>
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

Select.displayName = "Select";
