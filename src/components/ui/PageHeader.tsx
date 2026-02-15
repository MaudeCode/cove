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
  /** Additional CSS classes */
  class?: string;
}

export function PageHeader({ title, subtitle, actions, class: className }: PageHeaderProps) {
  // Wrap string subtitles in standard styling, pass through custom content as-is
  const subtitleContent =
    typeof subtitle === "string" ? (
      <p class="text-sm text-[var(--color-text-muted)] mt-1">{subtitle}</p>
    ) : (
      subtitle
    );

  return (
    <div
      class={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 ${className ?? ""}`}
    >
      <div class="flex-1 min-w-0">
        <h1 class="text-xl font-semibold text-[var(--color-text-primary)]">{title}</h1>
        {subtitleContent}
      </div>
      {actions && <div class="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
