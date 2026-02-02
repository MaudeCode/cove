/**
 * ConfigNavItem
 *
 * Sidebar navigation item for the config editor.
 */

import type { Signal } from "@preact/signals";
import { t } from "@/lib/i18n";
import { ChevronDown, ChevronRight } from "lucide-preact";
import type { NavItem } from "@/lib/config/nav-tree";
import { SECTION_ICONS, DEFAULT_SECTION_ICON } from "@/lib/config/section-icons";

interface ConfigNavItemProps {
  item: NavItem;
  depth?: number;
  selectedPath: Signal<(string | number)[]>;
  expandedNav: Signal<Set<string>>;
}

export function ConfigNavItem({ item, depth = 0, selectedPath, expandedNav }: ConfigNavItemProps) {
  const pathKey = item.path.join(".");
  const isExpanded = expandedNav.value.has(pathKey);
  const isSelected =
    selectedPath.value.join(".") === pathKey ||
    selectedPath.value.join(".").startsWith(pathKey + ".");
  const hasChildren = item.children && item.children.length > 0;

  const Icon = depth === 0 ? (SECTION_ICONS[item.key] ?? DEFAULT_SECTION_ICON) : undefined;

  const handleClick = () => {
    selectedPath.value = item.path;
  };

  const handleToggle = (e: Event) => {
    e.stopPropagation();
    const next = new Set(expandedNav.value);
    if (isExpanded) {
      next.delete(pathKey);
    } else {
      next.add(pathKey);
    }
    expandedNav.value = next;
  };

  // Exact match for selection (not just prefix)
  const isExactSelected = selectedPath.value.join(".") === pathKey;

  return (
    <div>
      <button
        type="button"
        class={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md text-left transition-colors ${
          isExactSelected
            ? "bg-[var(--color-accent)] text-white"
            : isSelected
              ? "text-[var(--color-accent)]"
              : "hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]"
        } ${depth > 0 ? "text-[var(--color-text-secondary)]" : "font-medium"}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            type="button"
            class="p-0.5 -ml-1 hover:bg-[var(--color-bg-primary)]/20 rounded"
            onClick={handleToggle}
            aria-label={
              isExpanded ? t("accessibility.collapseSection") : t("accessibility.expandSection")
            }
          >
            {isExpanded ? (
              <ChevronDown class="w-3.5 h-3.5" />
            ) : (
              <ChevronRight class="w-3.5 h-3.5" />
            )}
          </button>
        ) : (
          <span class="w-4" />
        )}

        {/* Icon for top-level items */}
        {Icon && <Icon class="w-4 h-4 flex-shrink-0 opacity-70" />}

        {/* Label */}
        <span class="truncate">{item.label}</span>
      </button>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div class="relative ml-2">
          <div
            class="absolute top-0 bottom-1 w-px bg-[var(--color-border)] opacity-50"
            style={{ left: `${(depth + 1) * 16 + 4}px` }}
          />
          {item.children!.map((child) => (
            <ConfigNavItem
              key={child.key}
              item={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              expandedNav={expandedNav}
            />
          ))}
        </div>
      )}
    </div>
  );
}
