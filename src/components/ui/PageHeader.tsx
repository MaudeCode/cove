/**
 * PageHeader
 *
 * Consistent header for view pages with title, subtitle, and optional actions.
 */

import type { ComponentChildren } from "preact";

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Optional actions (buttons, badges, etc.) rendered on the right */
  actions?: ComponentChildren;
  /** Show bottom border (default: true for sticky, false for inline) */
  border?: boolean;
  /** Include padding (default: true for sticky headers, false for inline) */
  padded?: boolean;
  /** Additional CSS classes */
  class?: string;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  border = true,
  padded = true,
  class: className,
}: PageHeaderProps) {
  return (
    <div
      class={`flex items-start justify-between gap-4 ${padded ? "p-6" : ""} ${border ? "border-b border-[var(--color-border)]" : ""} ${className ?? ""}`}
    >
      <div class="flex-1 min-w-0">
        <h1 class="text-xl font-semibold text-[var(--color-text-primary)]">{title}</h1>
        {subtitle && <p class="text-sm text-[var(--color-text-muted)] mt-1">{subtitle}</p>}
      </div>
      {actions && <div class="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
