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
  effectiveSessionKey,
  sessionsGrouped,
  sessionsByRecent,
  sessionKindFilter,
  setSessionKindFilter,
  sessionSearchQuery,
  setSessionSearchQuery,
  showCronSessions,
  toggleCronSessions,
  updateSession,
  removeSession,
} from "@/signals/sessions";
import type { TimeGroup } from "@/lib/session-utils";
import {
  Button,
  PlusIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  FilterIcon,
  SearchIcon,
} from "@/components/ui";
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
        {/* Header with title and filter */}
        <div class="flex items-center justify-between px-2 py-1.5">
          <h3 class="text-xs font-semibold text-[var(--color-accent)] uppercase tracking-wider">
            {t("nav.sessions")}
          </h3>
          <SessionFilterPanel />
        </div>

        {/* Session list with time groups */}
        <SessionList onRename={setRenameSession} onDelete={setDeleteSession} />
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
 * Session filter panel - search, kind filter, and options in one dropdown
 */
function SessionFilterPanel() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const kinds = [
    { value: null, label: t("sessions.filterAll") },
    { value: "main", label: t("sessions.filterMain") },
    { value: "isolated", label: t("sessions.filterIsolated") },
    { value: "channel", label: t("sessions.filterChannel") },
  ];

  // Check if any filters are active
  const hasActiveFilters =
    sessionKindFilter.value !== null ||
    sessionSearchQuery.value.trim() !== "" ||
    showCronSessions.value;

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

  // Focus search input when opening
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  return (
    <div ref={menuRef} class="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        class={`p-1 rounded transition-colors ${
          hasActiveFilters
            ? "text-[var(--color-accent)] bg-[var(--color-accent)]/10"
            : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        }`}
        aria-label={t("sessions.filterSessions")}
      >
        <FilterIcon class="w-3.5 h-3.5" />
      </button>

      {open && (
        <div class="absolute right-0 top-full mt-1 w-52 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg shadow-lg z-50 p-2 space-y-2">
          {/* Search input */}
          <div class="relative">
            <SearchIcon class="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <input
              ref={inputRef}
              type="text"
              value={sessionSearchQuery.value}
              onInput={(e) => setSessionSearchQuery((e.target as HTMLInputElement).value)}
              placeholder={t("sessions.searchPlaceholder")}
              class="w-full pl-7 pr-2 py-1.5 text-sm rounded-md
                bg-[var(--color-bg-primary)] border border-[var(--color-border)]
                text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]
                focus:outline-none focus:border-[var(--color-accent)]/50
                transition-colors"
            />
          </div>

          {/* Kind filter */}
          <div class="flex flex-wrap gap-1">
            {kinds.map((kind) => (
              <button
                key={kind.value ?? "all"}
                type="button"
                onClick={() => setSessionKindFilter(kind.value)}
                class={`px-2 py-1 text-xs rounded-md transition-colors ${
                  sessionKindFilter.value === kind.value
                    ? "text-[var(--color-accent)] bg-[var(--color-accent)]/10 font-medium"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
                }`}
              >
                {kind.label}
              </button>
            ))}
          </div>

          {/* Cron toggle */}
          <label class="flex items-center gap-2 px-1 py-1 cursor-pointer text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            <input
              type="checkbox"
              checked={showCronSessions.value}
              onChange={toggleCronSessions}
              class="w-3.5 h-3.5 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]/50"
            />
            {t("sessions.showCron")}
          </label>

          {/* Clear all button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSessionSearchQuery("");
                setSessionKindFilter(null);
                if (showCronSessions.value) toggleCronSessions();
              }}
              class="w-full px-2 py-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {t("actions.clear")} {t("actions.filter").toLowerCase()}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Session list with time-based grouping
 */
interface SessionListProps {
  onRename: (session: Session) => void;
  onDelete: (session: Session) => void;
}

const timeGroupLabels: Record<TimeGroup, string> = {
  pinned: "sessions.pinned",
  today: "sessions.today",
  yesterday: "sessions.yesterday",
  thisWeek: "sessions.thisWeek",
  older: "sessions.older",
};

const timeGroupOrder: TimeGroup[] = ["pinned", "today", "yesterday", "thisWeek", "older"];

function SessionList({ onRename, onDelete }: SessionListProps) {
  const groups = sessionsGrouped.value;
  const hasResults = sessionsByRecent.value.length > 0;
  const hasSearch = sessionSearchQuery.value.trim().length > 0;

  if (!hasResults) {
    return (
      <p class="text-sm text-[var(--color-text-muted)] px-2 py-4">
        {hasSearch ? t("sessions.noResults") : t("sessions.noSessions")}
      </p>
    );
  }

  // If searching, show flat list (no groups)
  if (hasSearch) {
    return (
      <ul class="space-y-0.5">
        {sessionsByRecent.value.map((session) => (
          <li key={session.key}>
            <SessionItem
              session={session}
              isActive={
                effectiveSessionKey.value === session.key && currentPath.value.startsWith("/chat")
              }
              isMain={isMainSession(session.key)}
              onClick={() => route(`/chat/${encodeURIComponent(session.key)}`)}
              onRename={onRename}
              onDelete={onDelete}
            />
          </li>
        ))}
      </ul>
    );
  }

  // Show grouped list
  return (
    <div class="space-y-3">
      {timeGroupOrder.map((groupKey) => {
        const sessions = groups.get(groupKey);
        if (!sessions || sessions.length === 0) return null;

        // Don't show "Pinned" header for main session
        const showHeader = groupKey !== "pinned";

        return (
          <div key={groupKey}>
            {showHeader && (
              <h4 class="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider px-2 py-1">
                {t(timeGroupLabels[groupKey])}
              </h4>
            )}
            <ul class="space-y-0.5">
              {sessions.map((session) => (
                <li key={session.key}>
                  <SessionItem
                    session={session}
                    isActive={
                      effectiveSessionKey.value === session.key &&
                      currentPath.value.startsWith("/chat")
                    }
                    isMain={isMainSession(session.key)}
                    onClick={() => route(`/chat/${encodeURIComponent(session.key)}`)}
                    onRename={onRename}
                    onDelete={onDelete}
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
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
