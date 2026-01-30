/**
 * Sidebar
 *
 * Sessions list and navigation sections.
 * Navigation items are driven by src/lib/navigation.tsx config.
 */

import { useSignal } from "@preact/signals";
import { t } from "@/lib/i18n";
import { isConnected } from "@/lib/gateway";
import { activeView, type View } from "@/signals/ui";
import { activeSessionKey, setActiveSession, sessionsByRecent } from "@/signals/sessions";
import { Button, PlusIcon, ChevronDownIcon, ExternalLinkIcon } from "@/components/ui";
import { navigation, type NavItem, type NavSection } from "@/lib/navigation";

export function Sidebar() {
  return (
    <div class="h-full flex flex-col">
      {/* New Chat button */}
      <div class="p-3">
        <Button
          variant="primary"
          disabled={!isConnected.value}
          onClick={() => {
            setActiveSession("main");
            activeView.value = "chat";
          }}
          fullWidth
          icon={<PlusIcon />}
        >
          {t("actions.newChat")}
        </Button>
      </div>

      {/* Sessions section - scrollable */}
      <div class="flex-1 overflow-y-auto px-3 pb-3">
        <h3 class="px-2 py-1 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
          {t("nav.sessions")}
        </h3>
        {sessionsByRecent.value.length === 0 ? (
          <p class="text-sm text-[var(--color-text-muted)] px-2 py-4">{t("sessions.noSessions")}</p>
        ) : (
          <ul class="space-y-1">
            {sessionsByRecent.value.map((session) => (
              <li key={session.key}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSession(session.key);
                    activeView.value = "chat";
                  }}
                  class={`
                    w-full text-left px-3.5 py-2.5 rounded-xl text-sm
                    flex items-center gap-2.5 transition-all duration-200 ease-out
                    ${
                      activeSessionKey.value === session.key && activeView.value === "chat"
                        ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)] shadow-soft-sm"
                        : "hover:bg-[var(--color-bg-primary)] hover:shadow-soft-sm text-[var(--color-text-primary)]"
                    }
                  `}
                >
                  <span
                    class={`w-2 h-2 rounded-full flex-shrink-0 ${
                      activeSessionKey.value === session.key && activeView.value === "chat"
                        ? "bg-[var(--color-accent)]"
                        : "bg-[var(--color-text-muted)]"
                    }`}
                    aria-hidden="true"
                  />
                  <span class="truncate">{session.label || session.key}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Navigation sections - pinned to bottom, collapsible */}
      <div class="border-t border-[var(--color-border)] max-h-[50%] overflow-y-auto">
        {navigation.map((section) => (
          <CollapsibleNavSection key={section.titleKey} section={section} />
        ))}
      </div>
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

interface CollapsibleNavSectionProps {
  section: NavSection;
}

function CollapsibleNavSection({ section }: CollapsibleNavSectionProps) {
  const isOpen = useSignal(false);

  // Filter items based on connection requirement
  const visibleItems = section.items.filter(
    (item) => !item.requiresConnection || isConnected.value,
  );

  if (visibleItems.length === 0) return null;

  return (
    <div class="border-b border-[var(--color-border)] last:border-b-0">
      {/* Section header - clickable to toggle */}
      <button
        type="button"
        onClick={() => (isOpen.value = !isOpen.value)}
        class="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider hover:bg-[var(--color-bg-primary)] transition-colors"
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

interface NavItemComponentProps {
  item: NavItem;
}

function NavItemComponent({ item }: NavItemComponentProps) {
  const isActive = !item.external && activeView.value === item.id;
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
      onClick={() => (activeView.value = item.id as View)}
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
