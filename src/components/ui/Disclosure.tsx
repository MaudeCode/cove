/**
 * Disclosure Component
 *
 * Reusable expand/collapse section with chevron and accessible toggle button.
 */

import type { ComponentChildren } from "preact";
import { ChevronDown, ChevronRight } from "lucide-preact";

export interface DisclosureProps {
  /** Whether content is expanded */
  isOpen: boolean;
  /** Called when expanded state should change */
  onToggle: (nextOpen: boolean) => void;
  /** Label when disclosure is collapsed */
  collapsedLabel: string;
  /** Label when disclosure is expanded (defaults to collapsedLabel) */
  expandedLabel?: string;
  /** Disclosure content */
  children: ComponentChildren;
  /** Wrapper class override */
  class?: string;
  /** Button class override */
  buttonClass?: string;
  /** Content wrapper class override */
  contentClass?: string;
}

export function Disclosure({
  isOpen,
  onToggle,
  collapsedLabel,
  expandedLabel,
  children,
  class: className,
  buttonClass,
  contentClass,
}: DisclosureProps) {
  return (
    <div class={className}>
      <button
        type="button"
        class={
          buttonClass ||
          "inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        }
        onClick={() => onToggle(!isOpen)}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <ChevronDown class="w-3.5 h-3.5" aria-hidden="true" />
        ) : (
          <ChevronRight class="w-3.5 h-3.5" aria-hidden="true" />
        )}
        {isOpen ? (expandedLabel ?? collapsedLabel) : collapsedLabel}
      </button>

      {isOpen && <div class={contentClass}>{children}</div>}
    </div>
  );
}
