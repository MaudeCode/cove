/**
 * Toggle Component
 *
 * Accessible toggle/switch control.
 */

import type { JSX } from "preact";
import { forwardRef } from "preact/compat";

type ToggleSize = "sm" | "md" | "lg";

interface ToggleProps extends Omit<JSX.HTMLAttributes<HTMLButtonElement>, "size" | "onChange"> {
  /** Whether toggle is checked */
  checked: boolean;
  /** Called when toggle state changes */
  onChange: (checked: boolean) => void;
  /** Toggle size */
  size?: ToggleSize;
  /** Disabled state */
  disabled?: boolean;
  /** Label text */
  label?: string;
  /** Description text */
  description?: string;
}

const sizeStyles: Record<ToggleSize, { track: string; thumb: string; translate: string }> = {
  sm: {
    // Mobile-first: slightly larger, then smaller on desktop
    track: "w-10 h-5 sm:w-8 sm:h-4",
    thumb: "w-4 h-4 sm:w-3 sm:h-3",
    translate: "translate-x-5 sm:translate-x-4",
  },
  md: {
    // Mobile-first: lg size on mobile, md on desktop
    track: "w-12 h-6 sm:w-10 sm:h-5",
    thumb: "w-5 h-5 sm:w-4 sm:h-4",
    translate: "translate-x-6 sm:translate-x-5",
  },
  lg: {
    track: "w-12 h-6",
    thumb: "w-5 h-5",
    translate: "translate-x-6",
  },
};

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  (
    {
      checked,
      onChange,
      size = "md",
      label,
      description,
      disabled,
      class: className,
      id,
      ...props
    },
    ref,
  ) => {
    const styles = sizeStyles[size];
    const labelId = id ? `${id}-label` : undefined;
    const descId = id ? `${id}-desc` : undefined;

    return (
      <div class={`flex items-start justify-between gap-3 ${className || ""}`}>
        {(label || description) && (
          <div class="flex flex-col">
            {label && (
              <span id={labelId} class="text-sm font-medium text-[var(--color-text-primary)]">
                {label}
              </span>
            )}
            {description && (
              <span id={descId} class="text-xs text-[var(--color-text-muted)]">
                {description}
              </span>
            )}
          </div>
        )}

        <button
          ref={ref}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={labelId}
          aria-describedby={descId}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          class={`
            relative inline-flex flex-shrink-0 items-center
            rounded-full transition-colors
            focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2
            disabled:opacity-50 disabled:cursor-not-allowed
            ${styles.track}
            ${checked ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"}
          `}
          {...props}
        >
          <span
            aria-hidden="true"
            class={`
              inline-block rounded-full bg-white shadow-sm
              transform transition-transform
              ${styles.thumb}
              ${checked ? styles.translate : "translate-x-0.5"}
            `}
          />
        </button>
      </div>
    );
  },
);

Toggle.displayName = "Toggle";
