/**
 * StatCard
 *
 * Clickable stat card with icon, value, and label.
 * Used for filterable stat displays in admin views.
 */

import type { ComponentType } from "preact";

interface StatCardProps {
  /** Lucide icon component */
  icon: ComponentType<{ class?: string }>;
  /** Label text below the value */
  label: string;
  /** Main value to display */
  value: number | string;
  /** Whether this card is actively selected */
  active?: boolean;
  /** Click handler */
  onClick?: () => void;
}

export function StatCard({ icon: Icon, label, value, active, onClick }: StatCardProps) {
  const isClickable = !!onClick;

  const content = (
    <>
      <div
        class={`p-2 rounded-lg ${active ? "bg-[var(--color-accent)]/20" : "bg-[var(--color-bg-tertiary)]"}`}
      >
        <Icon
          class={`w-5 h-5 ${active ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"}`}
        />
      </div>
      <div>
        <div class="text-2xl font-bold">{value}</div>
        <div class="text-sm text-[var(--color-text-muted)]">{label}</div>
      </div>
    </>
  );

  const baseClass = `
    flex items-center gap-3 p-4 rounded-xl text-left transition-all
    ${
      active
        ? "bg-[var(--color-accent)]/10 border-2 border-[var(--color-accent)]"
        : "bg-[var(--color-bg-secondary)] border-2 border-transparent"
    }
    ${isClickable ? "hover:bg-[var(--color-bg-tertiary)] cursor-pointer" : ""}
  `;

  if (isClickable) {
    return (
      <button type="button" onClick={onClick} class={baseClass}>
        {content}
      </button>
    );
  }

  return <div class={baseClass}>{content}</div>;
}
