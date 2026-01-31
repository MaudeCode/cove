/**
 * SessionItem
 *
 * A clickable session item with metadata and action menu.
 */

import { useState, useRef } from "preact/hooks";
import type { Session } from "@/types/sessions";
import { formatRelativeTime, t } from "@/lib/i18n";
import { useClickOutside } from "@/hooks";
import { MoreIcon, EditIcon, TrashIcon } from "@/components/ui";

export interface SessionItemProps {
  /** The session to display */
  session: Session;

  /** Whether this session is currently active */
  isActive?: boolean;

  /** Click handler */
  onClick?: () => void;

  /** Rename handler */
  onRename?: (session: Session) => void;

  /** Delete handler */
  onDelete?: (session: Session) => void;
}

/**
 * Get a display label for a session
 */
export function getSessionLabel(session: Session): string {
  if (session.label) return session.label;
  if (session.displayName) return session.displayName;

  const parts = session.key.split(":");
  if (parts.length >= 2) {
    const name = parts[parts.length - 1];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  return session.key;
}

/**
 * Extract the agent ID from a session key
 * e.g. "agent:main:main" → "main"
 *      "agent:maude-pm:spawn:uuid" → "maude-pm"
 */
function getAgentId(sessionKey: string): string | null {
  const parts = sessionKey.split(":");
  // Format: agent:<agentId>:<kind>[:uuid]
  if (parts.length >= 2 && parts[0] === "agent") {
    return parts[1];
  }
  return null;
}

/**
 * Format agent ID for display (capitalize, handle dashes)
 * e.g. "main" → "Main", "maude-pm" → "Maude PM"
 */
function formatAgentName(agentId: string): string {
  return agentId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Get session kind badge
 */
function getKindBadge(session: Session): { label: string; color: string } | null {
  if (!session.kind || session.kind === "main") return null;

  switch (session.kind) {
    case "isolated":
      return { label: "Isolated", color: "text-[var(--color-warning)]" };
    case "channel":
      return { label: session.channel || "Channel", color: "text-[var(--color-accent)]" };
    default:
      return null;
  }
}

export function SessionItem({
  session,
  isActive = false,
  onClick,
  onRename,
  onDelete,
}: SessionItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  const kindBadge = getKindBadge(session);
  const lastActive = session.updatedAt || session.lastActiveAt;

  // Extract agent name from session key
  const agentId = getAgentId(session.key);
  const agentName = agentId ? formatAgentName(agentId) : null;

  return (
    <div class="relative group">
      <button
        type="button"
        onClick={onClick}
        class={`
          w-full text-left px-3 py-2.5 rounded-xl text-sm
          flex items-start gap-2.5 transition-all duration-200 ease-out
          ${
            isActive
              ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)] shadow-soft-sm"
              : "hover:bg-[var(--color-bg-primary)] hover:shadow-soft-sm text-[var(--color-text-primary)]"
          }
        `}
      >
        {/* Active indicator dot */}
        <span
          class={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
            isActive ? "bg-[var(--color-accent)]" : "bg-[var(--color-text-muted)]"
          }`}
          aria-hidden="true"
        />

        {/* Content */}
        <span class="flex-1 min-w-0">
          {/* Label row */}
          <span class="flex items-center gap-2">
            <span class="truncate font-medium">{getSessionLabel(session)}</span>
            {kindBadge && (
              <span class={`text-[10px] font-medium ${kindBadge.color}`}>{kindBadge.label}</span>
            )}
          </span>

          {/* Meta row - agent name left, time pinned right */}
          <span class="flex items-center text-xs text-[var(--color-text-muted)] mt-0.5">
            {agentName && <span>{agentName}</span>}
            <span class="flex-1" />
            {lastActive && (
              <span class="whitespace-nowrap">{formatRelativeTime(new Date(lastActive))}</span>
            )}
          </span>
        </span>
      </button>

      {/* Action menu button - visible on hover */}
      {(onRename || onDelete) && (
        <div ref={menuRef} class="absolute right-2 top-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            class={`p-1 rounded-lg transition-all duration-150
              ${
                menuOpen
                  ? "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                  : "opacity-0 group-hover:opacity-100 hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]"
              }`}
            aria-label="Session actions"
          >
            <MoreIcon class="w-4 h-4" />
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <div class="absolute right-0 top-full mt-1 w-36 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg shadow-lg z-50 py-1">
              {onRename && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onRename(session);
                  }}
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                >
                  <EditIcon class="w-4 h-4" />
                  {t("actions.rename")}
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onDelete(session);
                  }}
                  class="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors"
                >
                  <TrashIcon class="w-4 h-4" />
                  {t("actions.delete")}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
