/**
 * PageHeader
 *
 * Consistent header for view pages with title, subtitle, and optional actions.
 */

import type { ComponentChildren } from "preact";

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Optional subtitle/description (string or custom content) */
  subtitle?: ComponentChildren;
  /** Optional actions (buttons, badges, etc.) rendered on the right */
  actions?: ComponentChildren;
  /** Include padding (default: false) */
  padded?: boolean;
  /** Additional CSS classes */
  class?: string;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  padded = false,
  class: className,
}: PageHeaderProps) {
  // Wrap string subtitles in standard styling, pass through custom content as-is
  const subtitleContent =
    typeof subtitle === "string" ? (
      <p class="text-sm text-[var(--color-text-muted)] mt-1">{subtitle}</p>
    ) : (
      subtitle
    );

  return (
    <div class={`flex items-start justify-between gap-4 ${padded ? "p-6" : ""} ${className ?? ""}`}>
      <div class="flex-1 min-w-0">
        <h1 class="text-xl font-semibold text-[var(--color-text-primary)]">{title}</h1>
        {subtitleContent}
      </div>
      {actions && <div class="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
