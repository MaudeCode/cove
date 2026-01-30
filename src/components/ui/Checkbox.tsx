/**
 * Checkbox Component
 *
 * Accessible checkbox control with label.
 */

import type { JSX } from "preact";
import { forwardRef } from "preact/compat";

export type CheckboxSize = "sm" | "md" | "lg";

export interface CheckboxProps extends Omit<
  JSX.HTMLAttributes<HTMLInputElement>,
  "size" | "onChange" | "type"
> {
  /** Whether checkbox is checked */
  checked: boolean;
  /** Called when checkbox state changes */
  onChange: (checked: boolean) => void;
  /** Checkbox size */
  size?: CheckboxSize;
  /** Disabled state */
  disabled?: boolean;
  /** Label text */
  label?: string;
  /** Description text */
  description?: string;
  /** Error message */
  error?: string;
}

const sizeStyles: Record<CheckboxSize, { box: string; label: string; description: string }> = {
  sm: {
    box: "w-3.5 h-3.5",
    label: "text-xs",
    description: "text-xs",
  },
  md: {
    box: "w-4 h-4",
    label: "text-sm",
    description: "text-xs",
  },
  lg: {
    box: "w-5 h-5",
    label: "text-base",
    description: "text-sm",
  },
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      checked,
      onChange,
      size = "md",
      disabled = false,
      label,
      description,
      error,
      class: className,
      id,
      ...props
    },
    ref,
  ) => {
    const styles = sizeStyles[size];
    const checkboxId = id || `checkbox-${Math.random().toString(36).slice(2, 9)}`;

    return (
      <div class={className}>
        <label
          class={`
            inline-flex items-start gap-2
            ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
          `}
        >
          <input
            ref={ref}
            id={checkboxId}
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange((e.target as HTMLInputElement).checked)}
            disabled={disabled}
            class={`
              ${styles.box}
              rounded
              border border-[var(--color-border)]
              bg-[var(--color-bg-primary)]
              text-[var(--color-accent)]
              focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-0
              disabled:cursor-not-allowed
              transition-colors
              ${error ? "border-[var(--color-error)]" : ""}
            `}
            {...props}
          />
          {(label || description) && (
            <div class="flex flex-col">
              {label && (
                <span
                  class={`
                    ${styles.label}
                    text-[var(--color-text-primary)]
                    ${disabled ? "" : ""}
                  `}
                >
                  {label}
                </span>
              )}
              {description && (
                <span
                  class={`
                    ${styles.description}
                    text-[var(--color-text-muted)]
                    mt-0.5
                  `}
                >
                  {description}
                </span>
              )}
            </div>
          )}
        </label>
        {error && <p class="mt-1 text-xs text-[var(--color-error)]">{error}</p>}
      </div>
    );
  },
);

Checkbox.displayName = "Checkbox";
