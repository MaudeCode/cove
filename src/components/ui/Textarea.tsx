/**
 * Textarea
 *
 * Multi-line text input with consistent styling.
 */

import type { JSX } from "preact";

interface TextareaProps extends Omit<JSX.HTMLAttributes<HTMLTextAreaElement>, "class"> {
  /** Additional classes */
  class?: string;
  /** Full width mode */
  fullWidth?: boolean;
  /** Minimum rows */
  rows?: number;
  /** Error state */
  error?: boolean;
  /** Controlled value */
  value?: string;
  /** Placeholder text */
  placeholder?: string;
}

export function Textarea({
  class: className = "",
  fullWidth = false,
  rows = 3,
  error = false,
  ...props
}: TextareaProps) {
  return (
    <textarea
      rows={rows}
      class={`
        px-3 py-2 text-sm rounded-lg resize-y
        bg-[var(--color-bg-primary)]
        text-[var(--color-text-primary)]
        placeholder:text-[var(--color-text-muted)]
        border transition-colors
        focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)]
        disabled:opacity-50 disabled:cursor-not-allowed
        ${
          error
            ? "border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[var(--color-error)]/30"
            : "border-[var(--color-border)] hover:border-[var(--color-border-hover)]"
        }
        ${fullWidth ? "w-full" : ""}
        ${className}
      `}
      {...props}
    />
  );
}
