/**
 * LinkButton
 *
 * Text-styled button that looks like a link.
 * Use for secondary actions like "Skip", "Cancel", "Learn more".
 */

import type { ComponentChildren, JSX } from "preact";

type LinkButtonSize = "sm" | "md" | "lg";

interface LinkButtonProps extends Omit<JSX.HTMLAttributes<HTMLButtonElement>, "size"> {
  /** Button contents */
  children: ComponentChildren;
  /** Size variant */
  size?: LinkButtonSize;
  /** Muted color (default) or inherit parent color */
  muted?: boolean;
}

const sizeStyles: Record<LinkButtonSize, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

export function LinkButton({
  children,
  size = "sm",
  muted = true,
  class: className,
  ...props
}: LinkButtonProps) {
  return (
    <button
      type="button"
      class={`
        ${sizeStyles[size]}
        ${muted ? "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]" : "text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"}
        transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className || ""}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
