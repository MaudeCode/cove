/**
 * TabNav
 *
 * Underline-style tab navigation, consistent across the app.
 */

import type { ComponentChildren } from "preact";

export interface TabNavItem {
  id: string;
  label: string;
  icon?: ComponentChildren;
}

interface TabNavProps {
  items: TabNavItem[];
  activeId: string;
  onChange: (id: string) => void;
}

export function TabNav({ items, activeId, onChange }: TabNavProps) {
  return (
    <div
      class="flex border-b border-[var(--color-border)] overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0"
      role="tablist"
    >
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            class={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
              isActive
                ? "text-[var(--color-accent)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {item.icon}
            {item.label}
            {/* Active indicator */}
            {isActive && (
              <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-accent)] rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
