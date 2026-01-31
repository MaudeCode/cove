/**
 * SessionItem
 *
 * A clickable session item with metadata and action menu.
 */

import { useState, useRef } from "preact/hooks";
import type { Session } from "@/types/sessions";
import { formatRelativeTime, t } from "@/lib/i18n";
import { getAgentId, formatAgentName, looksLikeUuid, formatTokens } from "@/lib/session-utils";
import { useClickOutside } from "@/hooks";
import { MoreIcon, EditIcon, TrashIcon, PinIcon } from "@/components/ui";

export interface SessionItemProps {
  /** The session to display */
  session: Session;

  /** Whether this session is currently active */
  isActive?: boolean;

  /** Whether this is the main/primary session */
  isMain?: boolean;

  /** Click handler */
  onClick?: () => void;

  /** Rename handler */
  onRename?: (session: Session) => void;

  /** Delete handler */
  onDelete?: (session: Session) => void;
}

/**
 * Get a display label for a session
 *
 * Session key format: agent:<agentId>:<kind>[:uuid]
 * Examples:
 *   - agent:main:main → "Main"
 *   - agent:main:cron:6dff7c7f-... → "Cron"
 *   - agent:maude-pm:spawn:abc123 → "Spawn"
 */
export function getSessionLabel(session: Session): string {
  // User-set label takes priority
  if (session.label) return session.label;
  // Gateway-provided display name (e.g., "Cove" for main)
  if (session.displayName) return session.displayName;

  // Parse the session key
  const parts = session.key.split(":");
  // Format: agent:<agentId>:<kind>[:uuid]
  if (parts.length >= 3 && parts[0] === "agent") {
    const kind = parts[2];
    // For "main" kind, show the agent name
    if (kind === "main") {
      return formatAgentName(parts[1]);
    }
    // For other kinds (cron, spawn), show the kind
    return kind.charAt(0).toUpperCase() + kind.slice(1);
  }

  // Fallback: just capitalize the last part (but not if it looks like a UUID)
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1];
    // Skip if it looks like a UUID
    if (looksLikeUuid(lastPart)) {
      // Try the part before it
      const kindPart = parts[parts.length - 2];
      if (kindPart && !looksLikeUuid(kindPart)) {
        return kindPart.charAt(0).toUpperCase() + kindPart.slice(1);
      }
    }
    return lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
  }

  return session.key;
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

/**
 * Get channel badge for display
 */
function getChannelBadge(session: Session): string | null {
  const channel = session.channel ?? session.lastChannel;
  if (!channel || channel === "webchat") return null;

  // Capitalize first letter
  return channel.charAt(0).toUpperCase() + channel.slice(1);
}

export function SessionItem({
  session,
  isActive = false,
  isMain = false,
  onClick,
  onRename,
  onDelete,
}: SessionItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAbove, setMenuAbove] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu on click outside
  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  // Check if menu should open above or below
  const handleMenuToggle = () => {
    if (!menuOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // Menu is roughly 80px tall, add some padding
      setMenuAbove(spaceBelow < 100);
    }
    setMenuOpen(!menuOpen);
  };

  const kindBadge = getKindBadge(session);
  const channelBadge = getChannelBadge(session);
  const tokenDisplay = formatTokens(session.totalTokens ?? session.contextTokens);
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
        {/* Pin icon for main session, otherwise active indicator dot */}
        {isMain ? (
          <PinIcon
            class={`w-3.5 h-3.5 flex-shrink-0 mt-1 ${isActive ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"}`}
          />
        ) : (
          <span
            class={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
              isActive ? "bg-[var(--color-accent)]" : "bg-[var(--color-text-muted)]"
            }`}
            aria-hidden="true"
          />
        )}

        {/* Content */}
        <span class="flex-1 min-w-0">
          {/* Label row */}
          <span class="flex items-center gap-2">
            <span class="truncate font-medium">{getSessionLabel(session)}</span>
            {kindBadge && (
              <span class={`text-[10px] font-medium ${kindBadge.color}`}>{kindBadge.label}</span>
            )}
          </span>

          {/* Meta row - info left, time right */}
          <span class="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mt-0.5">
            {agentName && <span>{agentName}</span>}
            {channelBadge && (
              <>
                {agentName && <span class="text-[var(--color-border)]">•</span>}
                <span class="text-[var(--color-accent)]/70">{channelBadge}</span>
              </>
            )}
            {tokenDisplay && (
              <>
                {(agentName || channelBadge) && <span class="text-[var(--color-border)]">•</span>}
                <span title={`${session.totalTokens ?? session.contextTokens} tokens`}>
                  {tokenDisplay}
                </span>
              </>
            )}
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
            ref={buttonRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleMenuToggle();
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

          {/* Dropdown menu - opens above if near bottom of viewport */}
          {menuOpen && (
            <div
              class={`absolute right-0 w-36 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-lg shadow-lg z-50 py-1 ${
                menuAbove ? "bottom-full mb-1" : "top-full mt-1"
              }`}
            >
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
