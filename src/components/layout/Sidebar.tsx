/**
 * Sidebar
 *
 * Sessions list with management actions and navigation sections.
 */

import { useState, useRef, useEffect } from "preact/hooks";
import { useSignal, signal } from "@preact/signals";
import { route } from "preact-router";
import { t } from "@/lib/i18n";
import { log } from "@/lib/logger";
import { send, isConnected } from "@/lib/gateway";
import { isMainSession } from "@/lib/session-utils";
import {
  activeSessionKey,
  effectiveSessionKey,
  sessionsByRecent,
  sessionKindFilter,
  setSessionKindFilter,
  updateSession,
  removeSession,
} from "@/signals/sessions";
import { Button, PlusIcon, ChevronDownIcon, ExternalLinkIcon, FilterIcon } from "@/components/ui";
import { SessionItem, SessionRenameModal, SessionDeleteModal } from "@/components/sessions";
import { navigation, type NavItem, type NavSection } from "@/lib/navigation";
import type { Session } from "@/types/sessions";

// Track current path for active state (updated by router)
export const currentPath = signal<string>(window.location.pathname);

export function Sidebar() {
  const [renameSession, setRenameSession] = useState<Session | null>(null);
  const [deleteSession, setDeleteSession] = useState<Session | null>(null);

  /**
   * Handle session rename
   */
  const handleRename = async (session: Session, newLabel: string) => {
    try {
      await send("sessions.patch", {
        key: session.key,
        label: newLabel,
      });
      updateSession(session.key, { label: newLabel });
    } catch (err) {
      log.ui.error("Failed to rename session:", err);
      throw err;
    }
  };

  /**
   * Handle session delete
   */
  const handleDelete = async (session: Session) => {
    try {
      await send("sessions.delete", {
        key: session.key,
      });
      removeSession(session.key);

      // If we deleted the active session, go back to main
      if (activeSessionKey.value === session.key) {
        route("/chat");
      }
    } catch (err) {
      log.ui.error("Failed to delete session:", err);
      throw err;
    }
  };

  return (
    <div class="h-full flex flex-col">
      {/* New Chat button */}
      <div class="p-3">
        <Button
          variant="primary"
          disabled={!isConnected.value}
          onClick={() => route("/chat")}
          fullWidth
          icon={<PlusIcon />}
        >
          {t("actions.newChat")}
        </Button>
      </div>

      {/* Sessions section - scrollable */}
      <div class="flex-1 overflow-y-auto px-3 pb-3">
        <div class="flex items-center justify-between px-2 py-1.5">
          <h3 class="text-xs font-semibold text-[var(--color-accent)] uppercase tracking-wider">
            {t("nav.sessions")}
          </h3>
          {/* Filter dropdown */}
          <SessionKindFilter />
        </div>
        {sessionsByRecent.value.length === 0 ? (
          <p class="text-sm text-[var(--color-text-muted)] px-2 py-4">{t("sessions.noSessions")}</p>
        ) : (
          <ul class="space-y-0.5">
            {sessionsByRecent.value.map((session) => {
              return (
                <li key={session.key}>
                  <SessionItem
                    session={session}
                    isActive={
                      effectiveSessionKey.value === session.key &&
                      currentPath.value.startsWith("/chat")
                    }
                    isMain={isMainSession(session.key)}
                    onClick={() => route(`/chat/${encodeURIComponent(session.key)}`)}
                    onRename={setRenameSession}
                    onDelete={setDeleteSession}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Navigation sections - pinned to bottom, collapsible */}
      <div class="border-t border-[var(--color-border)] max-h-[50%] overflow-y-auto">
        {navigation.map((section) => (
          <CollapsibleNavSection key={section.titleKey} section={section} />
        ))}
      </div>

      {/* Modals */}
      <SessionRenameModal
        session={renameSession}
        onClose={() => setRenameSession(null)}
        onRename={handleRename}
      />
      <SessionDeleteModal
        session={deleteSession}
        onClose={() => setDeleteSession(null)}
        onDelete={handleDelete}
      />
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

/**
 * Session kind filter dropdown
 */
function SessionKindFilter() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const kinds = [
    { value: null, label: "All" },
    { value: "main", label: "Main" },
    { value: "isolated", label: "Isolated" },
    { value: "channel", label: "Channel" },
  ];

  const currentKind = kinds.find((k) => k.value === sessionKindFilter.value) ?? kinds[0];

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={menuRef} class="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        class={`p-1 rounded transition-colors ${
          sessionKindFilter.value
            ? "text-[var(--color-accent)] bg-[var(--color-accent)]/10"
            : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        }`}
        aria-label="Filter sessions"
        title={`Filter: ${currentKind.label}`}
      >
        <FilterIcon class="w-3.5 h-3.5" />
      </button>

      {open && (
        <div class="absolute right-0 top-full mt-1 w-28 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg shadow-lg z-50 py-1">
          {kinds.map((kind) => (
            <button
              key={kind.value ?? "all"}
              type="button"
              onClick={() => {
                setSessionKindFilter(kind.value);
                setOpen(false);
              }}
              class={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                sessionKindFilter.value === kind.value
                  ? "text-[var(--color-accent)] bg-[var(--color-accent)]/10"
                  : "text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
              }`}
            >
              {kind.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface CollapsibleNavSectionProps {
  section: NavSection;
}

function CollapsibleNavSection({ section }: CollapsibleNavSectionProps) {
  const isOpen = useSignal(false);
  const visibleItems = section.items;

  if (visibleItems.length === 0) return null;

  return (
    <div class="border-b border-[var(--color-border)] last:border-b-0">
      {/* Section header - clickable to toggle */}
      <button
        type="button"
        onClick={() => (isOpen.value = !isOpen.value)}
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
