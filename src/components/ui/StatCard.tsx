/**
 * StatCard
 *
 * Clickable stat card with icon, value, and label.
 * Used for filterable stat displays in admin views.
 */

import type { ComponentType } from "preact";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IconComponent = ComponentType<any>;

interface StatCardProps {
  /** Lucide icon component */
  icon: IconComponent;
  /** Label text below the value */
  label: string;
  /** Main value to display */
  value: number | string;
  /** Whether this card is actively selected */
  active?: boolean;
  /** Highlight value (e.g., for errors) */
  highlight?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Additional CSS classes */
  class?: string;
  /** Optional secondary line below label */
  subtext?: string;
  /** Optional link destination */
  href?: string;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  active,
  highlight,
  onClick,
  class: className,
  subtext,
  href,
}: StatCardProps) {
  const isClickable = !!onClick || !!href;

  const content = (
    <>
      <div
        class={`p-1.5 sm:p-2 rounded-lg ${active ? "bg-[var(--color-accent)]/20" : "bg-[var(--color-bg-tertiary)]"}`}
      >
        <Icon
          class={`w-4 h-4 sm:w-5 sm:h-5 ${active ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"}`}
        />
      </div>
      <div class="min-w-0">
        <div
          class={`text-lg sm:text-2xl font-bold ${highlight ? "text-[var(--color-error)]" : ""}`}
        >
          {value}
        </div>
        <div class="text-[10px] sm:text-sm text-[var(--color-text-muted)] truncate">{label}</div>
        {subtext && <div class="text-xs text-[var(--color-text-muted)] truncate">{subtext}</div>}
      </div>
    </>
  );

  const baseClass = `
    flex items-center gap-1.5 sm:gap-3 p-2 sm:p-4 rounded-xl text-left transition-all
    ${
      active
        ? "bg-[var(--color-accent)]/10 border-2 border-[var(--color-accent)]"
        : "bg-[var(--color-bg-secondary)] border-2 border-transparent"
    }
    ${isClickable ? "hover:bg-[var(--color-bg-tertiary)] cursor-pointer" : ""}
    ${className || ""}
  `;

  if (isClickable) {
    if (href && !onClick) {
      return (
        <a href={href} class={baseClass}>
          {content}
        </a>
      );
    }

    return (
      <button type="button" onClick={onClick} class={baseClass}>
        {content}
      </button>
    );
  }

  return <div class={baseClass}>{content}</div>;
}
