/**
 * Sessions Signals
 *
 * Chat session state.
 *
 * Usage:
 *   import { sessions, activeSessionKey, activeSession } from '@/signals/sessions'
 *   import { loadSessions, setActiveSession } from '@/signals/sessions'
 */

import { signal, computed } from "@preact/signals";
import { send, mainSessionKey } from "@/lib/gateway";
import {
  isMainSession,
  isCronSession,
  isSpawnSession,
  isChannelSession,
  groupSessionsByTime,
} from "@/lib/session-utils";
import { SESSION_DELETE_ANIMATION_MS } from "@/lib/constants";
import type { Session, SessionsListResult, SessionsListParams } from "@/types/sessions";

// ============================================
// Cache
// ============================================

const SESSIONS_CACHE_KEY = "cove:sessions-cache";

function loadCachedSessions(): Session[] {
  try {
    const cached = localStorage.getItem(SESSIONS_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Ignore
  }
  return [];
}

function saveCachedSessions(sessions: Session[]): void {
  try {
    localStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify(sessions));
  } catch {
    // Ignore
  }
}

// ============================================
// State
// ============================================

/** All known sessions (initialized from cache) */
const sessions = signal<Session[]>(loadCachedSessions());

/** Currently active session key */
export const activeSessionKey = signal<string | null>(null);

/** Filter by session kind (null = all) */
export const sessionKindFilter = signal<string | null>(null);

/** Search query for filtering sessions */
export const sessionSearchQuery = signal<string>("");

/** Whether to show cron sessions (hidden by default) */
export const showCronSessions = signal<boolean>(false);

/** Whether to show spawn/sub-agent sessions (shown by default) */
const showSpawnSessions = signal<boolean>(true);

/** Whether we're loading sessions */
const isLoadingSessions = signal<boolean>(false);

/** Session key currently being deleted (for animation) */
export const deletingSessionKey = signal<string | null>(null);

/** Error from loading sessions */
const sessionsError = signal<string | null>(null);

// ============================================
// Derived State
// ============================================

/**
 * The effective session key to use for chat operations.
 * Resolves "main" to the actual mainSessionKey from the gateway.
 */
export const effectiveSessionKey = computed(() => {
  const current = activeSessionKey.value;

  // If no session selected or "main", use the gateway's mainSessionKey
  if (!current || current === "main") {
    return mainSessionKey.value ?? "main";
  }

  return current;
});

/** The currently active session (derived) - uses effectiveSessionKey to handle "main" alias */
export const activeSession = computed(
  () => sessions.value.find((s) => s.key === effectiveSessionKey.value) ?? null,
);

/** Get display label for a session (for search matching) */
function getSessionDisplayLabel(session: Session): string {
  if (session.label) return session.label;
  if (session.displayName) return session.displayName;
  return session.key;
}

/**
 * Get the effective kind for filtering.
 * Maps gateway kinds to our filter categories.
 *
 * Gateway returns: "direct", "group"
 * Our filters: "main", "isolated", "channel"
 */
function getEffectiveKind(session: Session): string {
  if (isChannelSession(session)) return "channel";
  if (isMainSession(session.key)) return "main";
  // Everything else is isolated (cron, spawn, etc.)
  return "isolated";
}

/** Sessions filtered and sorted by last active time, with main pinned to top */
export const sessionsByRecent = computed(() => {
  let filtered = sessions.value;

  // Apply kind filter if set
  if (sessionKindFilter.value) {
    filtered = filtered.filter((s) => {
      const effectiveKind = getEffectiveKind(s);
      return effectiveKind === sessionKindFilter.value;
    });
  }

  // Hide cron sessions unless toggled
  if (!showCronSessions.value) {
    filtered = filtered.filter((s) => !isCronSession(s));
  }

  // Hide spawn sessions if toggled off
  if (!showSpawnSessions.value) {
    filtered = filtered.filter((s) => !isSpawnSession(s));
  }

  // Apply search filter
  const query = sessionSearchQuery.value.toLowerCase().trim();
  if (query) {
    filtered = filtered.filter((s) => {
      const label = getSessionDisplayLabel(s).toLowerCase();
      const channel = (s.channel ?? "").toLowerCase();
      const model = (s.model ?? "").toLowerCase();
      return label.includes(query) || channel.includes(query) || model.includes(query);
    });
  }

  // Sort by most recent, but pin main session to top
  return [...filtered].sort((a, b) => {
    // Main session always first
    const aIsMain = isMainSession(a.key);
    const bIsMain = isMainSession(b.key);
    if (aIsMain && !bIsMain) return -1;
    if (bIsMain && !aIsMain) return 1;
    // Otherwise sort by recency
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
  });
});

/** Sessions grouped by time period */
export const sessionsGrouped = computed(() => {
  return groupSessionsByTime(sessionsByRecent.value);
});

// ============================================
// Actions
// ============================================

/**
 * Load sessions from the gateway
 */
export async function loadSessions(params?: SessionsListParams): Promise<void> {
  isLoadingSessions.value = true;
  sessionsError.value = null;

  try {
    const result = await send<SessionsListResult>("sessions.list", {
      limit: params?.limit ?? 100,
      ...params,
    });

    sessions.value = result.sessions ?? [];
    saveCachedSessions(sessions.value);
  } catch (err) {
    sessionsError.value = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    isLoadingSessions.value = false;
  }
}

/**
 * Set the active session
 */
export function setActiveSession(sessionKey: string | null): void {
  activeSessionKey.value = sessionKey;
}

/**
 * Set the session kind filter
 */
export function setSessionKindFilter(kind: string | null): void {
  sessionKindFilter.value = kind;
}

/**
 * Set the session search query
 */
export function setSessionSearchQuery(query: string): void {
  sessionSearchQuery.value = query;
}

/**
 * Toggle showing cron sessions
 */
export function toggleCronSessions(): void {
  showCronSessions.value = !showCronSessions.value;
}

/**
 * Clear sessions
 */
export function clearSessions(): void {
  sessions.value = [];
  activeSessionKey.value = null;
  sessionsError.value = null;
}

/**
 * Update a session in the list
 */
export function updateSession(sessionKey: string, updates: Partial<Session>): void {
  sessions.value = sessions.value.map((s) => (s.key === sessionKey ? { ...s, ...updates } : s));
}

/**
 * Remove a session from the list
 */
function removeSession(sessionKey: string): void {
  sessions.value = sessions.value.filter((s) => s.key !== sessionKey);
  if (activeSessionKey.value === sessionKey) {
    activeSessionKey.value = null;
  }
  deletingSessionKey.value = null;
}

/**
 * Remove a session with fade-out animation.
 * Sets deletingSessionKey to trigger animation, then removes after delay.
 */
export function removeSessionAnimated(sessionKey: string): Promise<void> {
  return new Promise((resolve) => {
    deletingSessionKey.value = sessionKey;
    setTimeout(() => {
      removeSession(sessionKey);
      resolve();
    }, SESSION_DELETE_ANIMATION_MS);
  });
}
