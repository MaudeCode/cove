/**
 * Checkbox Component
 *
 * Traditional checkbox with optional label and description.
 * Uses a native input wrapped in a label for accessibility.
 */

import { CheckIcon } from "./icons";

interface CheckboxProps {
  /** Whether the checkbox is checked */
  checked: boolean;
  /** Called when the checkbox state changes */
  onChange: (checked: boolean) => void;
  /** Label text */
  label?: string;
  /** Description text (shown below label) */
  description?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Additional class names */
  class?: string;
}

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  class: className = "",
}: CheckboxProps) {
  return (
    <label
      class={`flex items-start gap-3 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className}`}
    >
      {/* Native checkbox (visually hidden but accessible) */}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange((e.target as HTMLInputElement).checked)}
        disabled={disabled}
        class="sr-only peer"
      />

      {/* Custom visual checkbox */}
      <div
        class={`
          flex-shrink-0 w-5 h-5 rounded border-2 transition-colors
          flex items-center justify-center
          peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-accent)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--color-bg-primary)]
          ${
            checked
              ? "bg-[var(--color-accent)] border-[var(--color-accent)]"
              : "bg-[var(--color-bg-primary)] border-[var(--color-border)] hover:border-[var(--color-accent)]"
          }
        `}
        aria-hidden="true"
      >
        {checked && <CheckIcon class="w-3 h-3 text-white" />}
      </div>

      {/* Label and description */}
      {(label || description) && (
        <div class="flex-1 min-w-0">
          {label && (
            <span class="text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
          )}
          {description && (
            <p class="text-xs text-[var(--color-text-muted)] mt-0.5">{description}</p>
          )}
        </div>
      )}
    </label>
  );
}
