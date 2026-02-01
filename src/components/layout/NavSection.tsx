/**
 * NavSection
 *
 * Collapsible navigation section with nav items.
 */

import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { route } from "preact-router";
import { t } from "@/lib/i18n";
import { ChevronDownIcon, ExternalLinkIcon } from "@/components/ui/icons";
import { navigation, type NavItem, type NavSection as NavSectionType } from "@/lib/navigation";
import { currentPath } from "./Sidebar";

interface NavItemComponentProps {
  item: NavItem;
}

function NavItemComponent({ item }: NavItemComponentProps) {
  const itemPath = `/${item.id}`;
  const isActive =
    !item.external &&
    (currentPath.value === itemPath ||
      (item.id === "chat" && currentPath.value.startsWith("/chat")));
  const Icon = item.icon;

  // External link
  if (item.external) {
    return (
      <a
        href={item.external}
        target="_blank"
        rel="noopener noreferrer"
        class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-200 ease-out hover:bg-[var(--color-bg-primary)] hover:shadow-soft-sm text-[var(--color-text-secondary)]"
      >
        <span class="w-5 h-5 flex-shrink-0" aria-hidden="true">
          <Icon />
        </span>
        {t(item.labelKey)}
        <ExternalLinkIcon class="w-3 h-3 ml-auto text-[var(--color-text-muted)]" />
      </a>
    );
  }

  // Internal view link
  return (
    <button
      type="button"
      onClick={() => route(itemPath)}
      class={`
        w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm
        transition-all duration-200 ease-out
        ${
          isActive
            ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)] shadow-soft-sm"
            : "hover:bg-[var(--color-bg-primary)] hover:shadow-soft-sm text-[var(--color-text-secondary)]"
        }
      `}
    >
      <span class="w-5 h-5 flex-shrink-0" aria-hidden="true">
        <Icon />
      </span>
      {t(item.labelKey)}
    </button>
  );
}

interface CollapsibleNavSectionProps {
  section: NavSectionType;
  forceOpen?: boolean;
}

function CollapsibleNavSection({ section, forceOpen = false }: CollapsibleNavSectionProps) {
  const isOpen = useSignal(forceOpen);
  const visibleItems = section.items;

  // Sync with forceOpen when it changes
  useEffect(() => {
    if (forceOpen) {
      isOpen.value = true;
    }
  }, [forceOpen]);

  if (visibleItems.length === 0) return null;

  // When forceOpen is true, always show as open
  const showContent = forceOpen || isOpen.value;

  return (
    <div class="border-b border-[var(--color-border)] last:border-b-0">
      {/* Section header - clickable to toggle */}
      <button
        type="button"
        onClick={() => (isOpen.value = !isOpen.value)}
        class="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-wider hover:bg-[var(--color-bg-hover)] transition-colors text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)]"
      >
        <span>{t(section.titleKey)}</span>
        <ChevronDownIcon open={showContent} />
      </button>

      {/* Collapsible content */}
      {showContent && (
        <ul class="px-3 pb-2 space-y-0.5">
          {visibleItems.map((item) => (
            <li key={item.id}>
              <NavItemComponent item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface NavSectionsProps {
  /** Whether sections should be forced open (single-chat mode) */
  expanded?: boolean;
}

/**
 * Navigation sections container
 */
export function NavSections({ expanded = false }: NavSectionsProps) {
  return (
    <div
      class={
        expanded
          ? "border-t border-[var(--color-border)]"
          : "border-t border-[var(--color-border)] max-h-[50%] overflow-y-auto"
      }
    >
      {navigation.map((section) => (
        <CollapsibleNavSection key={section.titleKey} section={section} forceOpen={expanded} />
      ))}
    </div>
  );
}
