/**
 * ListCard
 *
 * Reusable card component for mobile list views.
 * Displays icon, title, subtitle, badges, metadata, and optional actions.
 * Used by Sessions, Instances, and other admin list views.
 */

import type { ComponentChildren, ComponentType } from "preact";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IconComponent = ComponentType<any>;

export interface ListCardMeta {
  /** Icon to show before the value */
  icon?: IconComponent;
  /** The value/text to display */
  value: string;
  /** Optional title/tooltip */
  title?: string;
}

export interface ListCardProps {
  /** Main icon component */
  icon: IconComponent;
  /** Icon background color variant */
  iconVariant?: "default" | "success" | "warning" | "error" | "info";
  /** Primary title text */
  title: string;
  /** Secondary subtitle (truncated, monospace) */
  subtitle?: string;
  /** Badges to show after title */
  badges?: ComponentChildren;
  /** Metadata row items (icon + value pairs) */
  meta?: ListCardMeta[];
  /** Action buttons (right side) */
  actions?: ComponentChildren;
  /** Click handler for the card */
  onClick?: () => void;
}

const iconVariantStyles = {
  default: "bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]",
  success: "bg-[var(--color-success)]/10 text-[var(--color-success)]",
  warning: "bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
  error: "bg-[var(--color-error)]/10 text-[var(--color-error)]",
  info: "bg-[var(--color-info)]/10 text-[var(--color-info)]",
};

export function ListCard({
  icon: Icon,
  iconVariant = "default",
  title,
  subtitle,
  badges,
  meta,
  actions,
  onClick,
}: ListCardProps) {
  const content = (
    <div class="flex items-start gap-3">
      {/* Icon */}
      <div class={`p-1.5 rounded-lg flex-shrink-0 ${iconVariantStyles[iconVariant]}`}>
        <Icon class="w-4 h-4" />
      </div>

      {/* Content */}
      <div class="flex-1 min-w-0">
        {/* Title + Badges */}
        <div class="flex items-center gap-2 mb-0.5">
          <span class="font-medium truncate">{title}</span>
          {badges}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div class="text-xs text-[var(--color-text-muted)] font-mono truncate mb-2">
            {subtitle}
          </div>
        )}

        {/* Metadata row */}
        {meta && meta.length > 0 && (
          <div class="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
            {meta.map((item, i) => (
              <span key={`${i}-${item.value}`} class="flex items-center gap-1" title={item.title}>
                {item.icon && <item.icon class="w-3 h-3" />}
                {item.value}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {actions && <div class="flex-shrink-0">{actions}</div>}
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        aria-label={title}
        class="w-full p-3 rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-hover)] cursor-pointer transition-colors text-left"
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return <div class="p-3 rounded-lg bg-[var(--color-bg-secondary)]">{content}</div>;
}
