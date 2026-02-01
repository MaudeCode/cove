/**
 * NavSection
 *
 * Collapsible navigation section with nav items.
 * Open/closed state persists to localStorage per mode.
 */

import { useSignal } from "@preact/signals";
import { route } from "preact-router";
import { t } from "@/lib/i18n";
import { ChevronDownIcon, ExternalLinkIcon } from "@/components/ui/icons";
import { navigation, type NavItem, type NavSection as NavSectionType } from "@/lib/navigation";
import { currentPath } from "./Sidebar";

// ============================================
// localStorage persistence for section states
// ============================================

const STORAGE_KEY_PREFIX = "cove:nav-sections";

type SectionStates = Record<string, boolean>;

function getSectionStates(mode: string): SectionStates {
  try {
    const key = `${STORAGE_KEY_PREFIX}-${mode}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function setSectionState(mode: string, sectionKey: string, isOpen: boolean): void {
  try {
    const key = `${STORAGE_KEY_PREFIX}-${mode}`;
    const states = getSectionStates(mode);
    states[sectionKey] = isOpen;
    localStorage.setItem(key, JSON.stringify(states));
  } catch {
    // Ignore storage errors
  }
}

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
  mode: string;
  defaultOpen?: boolean;
}

function CollapsibleNavSection({ section, mode, defaultOpen = false }: CollapsibleNavSectionProps) {
  // Read initial state from localStorage, fallback to defaultOpen
  const storedStates = getSectionStates(mode);
  const initialOpen = storedStates[section.titleKey] ?? defaultOpen;

  const isOpen = useSignal(initialOpen);
  const visibleItems = section.items;

  if (visibleItems.length === 0) return null;

  const handleToggle = () => {
    const newValue = !isOpen.value;
    isOpen.value = newValue;
    setSectionState(mode, section.titleKey, newValue);
  };

  return (
    <div class="border-b border-[var(--color-border)] last:border-b-0">
      {/* Section header - clickable to toggle */}
      <button
        type="button"
        onClick={handleToggle}
        class="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-wider hover:bg-[var(--color-bg-hover)] transition-colors text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)]"
      >
        <span>{t(section.titleKey)}</span>
        <ChevronDownIcon open={isOpen.value} />
      </button>

      {/* Collapsible content */}
      {isOpen.value && (
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
  /** Whether sections should default to open (single-chat mode) */
  expanded?: boolean;
}

/**
 * Navigation sections container
 */
export function NavSections({ expanded = false }: NavSectionsProps) {
  // Mode key for localStorage separation
  const mode = expanded ? "single" : "multi";

  return (
    <div
      class={
        expanded
          ? "border-t border-[var(--color-border)]"
          : "border-t border-[var(--color-border)] max-h-[50%] overflow-y-auto"
      }
    >
      {navigation.map((section) => (
        <CollapsibleNavSection
          key={`${mode}-${section.titleKey}`}
          section={section}
          mode={mode}
          defaultOpen={expanded}
        />
      ))}
    </div>
  );
}
