/**
 * FormField Component
 *
 * Wrapper for form controls with label and error message.
 */

import type { ComponentChildren } from "preact";

export interface FormFieldProps {
  /** Field label */
  label?: string;
  /** HTML for attribute (should match input id) */
  htmlFor?: string;
  /** Error message */
  error?: string;
  /** Hint/help text */
  hint?: string;
  /** Whether field is required */
  required?: boolean;
  /** Field content (Input, Select, etc.) */
  children: ComponentChildren;
  /** Additional class names */
  class?: string;
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  class: className,
}: FormFieldProps) {
  return (
    <div class={className}>
      {label && (
        <label
          htmlFor={htmlFor}
          class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"
        >
          {label}
          {required && <span class="text-[var(--color-error)] ml-0.5">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p class="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>}
      {error && <p class="mt-1 text-xs text-[var(--color-error)]">{error}</p>}
    </div>
  );
}
