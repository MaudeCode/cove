/**
 * Shared components for tool blocks
 */

import type { ComponentChildren } from "preact";

// ============================================
// Tool Input Container
// ============================================

interface ToolInputContainerProps {
  children: ComponentChildren;
  /** Use monospace font */
  mono?: boolean;
  /** Use flex row layout with gap */
  inline?: boolean;
  /** Additional classes */
  class?: string;
}

/**
 * Base container for tool input displays.
 * Provides consistent padding, background, and typography.
 */
export function ToolInputContainer({
  children,
  mono = true,
  inline = false,
  class: className = "",
}: ToolInputContainerProps) {
  const baseClasses =
    "text-xs p-2 rounded-md bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]";
  const monoClass = mono ? "font-mono" : "";
  const inlineClass = inline ? "flex items-center gap-2" : "";

  return (
    <div class={`${baseClasses} ${monoClass} ${inlineClass} ${className}`.trim()}>{children}</div>
  );
}

// ============================================
// Tool Badge
// ============================================

interface ToolBadgeProps {
  children: ComponentChildren;
  /** Tooltip text */
  title?: string;
}

/**
 * Small badge for metadata (line counts, profiles, etc.)
 */
export function ToolBadge({ children, title }: ToolBadgeProps) {
  return (
    <span
      class="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded"
      title={title}
    >
      {children}
    </span>
  );
}

// ============================================
// Tool Output Container
// ============================================

interface ToolOutputContainerProps {
  children: ComponentChildren;
  /** Additional classes */
  class?: string;
}

/**
 * Base container for tool output displays.
 * Used for empty states and simple outputs.
 */
export function ToolOutputContainer({ children, class: className = "" }: ToolOutputContainerProps) {
  return (
    <div class={`text-xs text-[var(--color-text-muted)] italic p-2 ${className}`.trim()}>
      {children}
    </div>
  );
}
