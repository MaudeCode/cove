/**
 * MobileConfigNavList
 *
 * List of navigation items for mobile config drill-down.
 */

import type { Signal } from "@preact/signals";
import { ChevronRight } from "lucide-preact";
import type { NavItem } from "@/lib/config/nav-tree";
import { SECTION_ICONS, DEFAULT_SECTION_ICON } from "@/lib/config/section-icons";

interface MobileConfigNavListProps {
  items: NavItem[];
  selectedPath: Signal<(string | number)[]>;
  isTopLevel?: boolean;
}

export function MobileConfigNavList({
  items,
  selectedPath,
  isTopLevel = false,
}: MobileConfigNavListProps) {
  const handleItemClick = (item: NavItem) => {
    selectedPath.value = item.path;
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div class="divide-y divide-[var(--color-border)]">
      {items.map((item) => {
        const Icon = isTopLevel ? (SECTION_ICONS[item.key] ?? DEFAULT_SECTION_ICON) : undefined;

        return (
          <button
            key={item.key}
            type="button"
            class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--color-bg-hover)] active:bg-[var(--color-bg-tertiary)] transition-colors"
            onClick={() => handleItemClick(item)}
          >
            {/* Icon for top-level items */}
            {Icon && (
              <div class="w-8 h-8 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
                <Icon size={18} class="text-[var(--color-accent)]" />
              </div>
            )}

            {/* Label */}
            <span class="flex-1 text-[var(--color-text-primary)] truncate">{item.label}</span>

            {/* Chevron indicator */}
            <ChevronRight size={18} class="text-[var(--color-text-muted)] flex-shrink-0" />
          </button>
        );
      })}
    </div>
  );
}
