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

// ============================================
// Result Card
// ============================================

interface ResultCardProps {
  children: ComponentChildren;
  /** Header content (shown after checkmark) */
  header: ComponentChildren;
  /** Show success checkmark (default: true) */
  success?: boolean;
}

/**
 * Standard card for successful tool results.
 * Provides consistent layout with success indicator and header.
 */
export function ResultCard({ children, header, success = true }: ResultCardProps) {
  return (
    <div class="text-xs p-2 rounded-md bg-[var(--color-bg-tertiary)] space-y-2">
      <div class="flex items-center gap-2">
        {success && <span class="text-[var(--color-success)]">✓</span>}
        {header}
      </div>
      {children}
    </div>
  );
}

// ============================================
// Result Grid
// ============================================

interface ResultGridProps {
  children: ComponentChildren;
}

/**
 * Two-column grid for key-value pairs in results.
 */
export function ResultGrid({ children }: ResultGridProps) {
  return (
    <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[var(--color-text-muted)]">
      {children}
    </div>
  );
}

interface ResultGridRowProps {
  label: string;
  children: ComponentChildren;
  mono?: boolean;
  small?: boolean;
}

/**
 * Single row in a ResultGrid.
 */
export function ResultGridRow({
  label,
  children,
  mono = false,
  small = false,
}: ResultGridRowProps) {
  const valueClasses = [
    "text-[var(--color-text-primary)]",
    mono ? "font-mono" : "",
    small ? "text-[10px]" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <span>{label}:</span>
      <span class={valueClasses}>{children}</span>
    </>
  );
}
