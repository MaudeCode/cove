/**
 * Checkbox Component
 *
 * Traditional checkbox with optional label and description.
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
  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      class={`flex items-start gap-3 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
    >
      {/* Checkbox box */}
      <div
        class={`
          flex-shrink-0 w-5 h-5 rounded border-2 transition-colors
          flex items-center justify-center
          ${
            checked
              ? "bg-[var(--color-accent)] border-[var(--color-accent)]"
              : "bg-[var(--color-bg-primary)] border-[var(--color-border)] hover:border-[var(--color-accent)]"
          }
        `}
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
    </div>
  );
}
