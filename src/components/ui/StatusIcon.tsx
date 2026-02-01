/**
 * StatusIcon
 *
 * Large colored circle with icon for status states.
 * Use for success confirmations, error states, empty states, etc.
 */

import type { ComponentChildren } from "preact";
import { CheckCircle, XCircle, AlertTriangle, Info } from "lucide-preact";

type StatusIconVariant = "success" | "error" | "warning" | "info";
type StatusIconSize = "sm" | "md" | "lg";

interface StatusIconProps {
  /** Status variant determines color and default icon */
  variant: StatusIconVariant;
  /** Size of the circle */
  size?: StatusIconSize;
  /** Custom icon (overrides default) */
  icon?: ComponentChildren;
  /** Additional class */
  class?: string;
}

const variantStyles: Record<StatusIconVariant, string> = {
  success: "bg-[var(--color-success)]/10 text-[var(--color-success)]",
  error: "bg-[var(--color-error)]/10 text-[var(--color-error)]",
  warning: "bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
  info: "bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
};

const sizeStyles: Record<StatusIconSize, { container: string; icon: string }> = {
  sm: { container: "w-10 h-10", icon: "w-5 h-5" },
  md: { container: "w-12 h-12", icon: "w-6 h-6" },
  lg: { container: "w-16 h-16", icon: "w-8 h-8" },
};

const defaultIcons: Record<StatusIconVariant, ComponentChildren> = {
  success: <CheckCircle />,
  error: <XCircle />,
  warning: <AlertTriangle />,
  info: <Info />,
};

export function StatusIcon({ variant, size = "lg", icon, class: className }: StatusIconProps) {
  const { container, icon: iconSize } = sizeStyles[size];
  const defaultIcon = defaultIcons[variant];

  return (
    <div
      class={`
        ${container}
        rounded-full
        flex items-center justify-center
        ${variantStyles[variant]}
        ${className || ""}
      `}
    >
      <span class={iconSize}>{icon || defaultIcon}</span>
    </div>
  );
}
