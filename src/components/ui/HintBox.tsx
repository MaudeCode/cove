/**
 * HintBox
 *
 * Info panel for tips, hints, troubleshooting, or warnings.
 * Supports title + paragraph or title + bullet list.
 */

import type { ComponentChildren } from "preact";

type HintBoxVariant = "info" | "warning" | "error" | "success";

interface HintBoxProps {
  /** Optional title */
  title?: string;
  /** Content - either children or items for bullet list */
  children?: ComponentChildren;
  /** Bullet list items (alternative to children) */
  items?: string[];
  /** Visual variant */
  variant?: HintBoxVariant;
  /** Additional class */
  class?: string;
}

const variantStyles: Record<HintBoxVariant, string> = {
  info: "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]",
  warning: "bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
  error: "bg-[var(--color-error)]/10 text-[var(--color-error)]",
  success: "bg-[var(--color-success)]/10 text-[var(--color-success)]",
};

export function HintBox({
  title,
  children,
  items,
  variant = "info",
  class: className,
}: HintBoxProps) {
  return (
    <div
      class={`
        p-3 rounded-lg text-xs
        ${variantStyles[variant]}
        ${className || ""}
      `}
    >
      {title && <p class="font-medium mb-1">{title}</p>}
      {items ? (
        <ul class="list-disc list-inside space-y-0.5">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : (
        children
      )}
    </div>
  );
}
