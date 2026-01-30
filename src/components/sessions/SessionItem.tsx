/**
 * SessionItem
 *
 * A clickable session item for lists (sidebar, pickers, etc.)
 */

import type { Session } from "@/types/sessions";

export interface SessionItemProps {
  /** The session to display */
  session: Session;

  /** Whether this session is currently active */
  isActive?: boolean;

  /** Click handler */
  onClick?: () => void;

  /** Show metadata like model/channel */
  showMeta?: boolean;
}

/**
 * Get a display label for a session
 */
export function getSessionLabel(session: Session): string {
  // Use custom label if set
  if (session.label) return session.label;

  // Use displayName if available
  if (session.displayName) return session.displayName;

  // Parse session key (format: "agent:main:main" or "channel:telegram:123")
  const parts = session.key.split(":");
  if (parts.length >= 2) {
    // Return the last meaningful part, capitalized
    const name = parts[parts.length - 1];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  return session.key;
}

/**
 * Format session metadata for display
 */
function getSessionMeta(session: Session): string | null {
  const parts: string[] = [];

  if (session.channel) {
    parts.push(session.channel);
  }

  if (session.model) {
    // Shorten model name (e.g., "claude-opus-4-5" -> "opus-4-5")
    const shortModel = session.model.replace(/^claude-/, "").replace(/^gpt-/, "");
    parts.push(shortModel);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

export function SessionItem({
  session,
  isActive = false,
  onClick,
  showMeta = false,
}: SessionItemProps) {
  const meta = showMeta ? getSessionMeta(session) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      class={`
        w-full text-left px-3.5 py-2.5 rounded-xl text-sm
        flex items-center gap-2.5 transition-all duration-200 ease-out
        ${
          isActive
            ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)] shadow-soft-sm"
            : "hover:bg-[var(--color-bg-primary)] hover:shadow-soft-sm text-[var(--color-text-primary)]"
        }
      `}
    >
      {/* Active indicator dot */}
      <span
        class={`w-2 h-2 rounded-full flex-shrink-0 ${
          isActive ? "bg-[var(--color-accent)]" : "bg-[var(--color-text-muted)]"
        }`}
        aria-hidden="true"
      />

      {/* Label and optional meta */}
      <span class="flex-1 min-w-0">
        <span class="block truncate">{getSessionLabel(session)}</span>
        {meta && <span class="block text-xs text-[var(--color-text-muted)] truncate">{meta}</span>}
      </span>
    </button>
  );
}
