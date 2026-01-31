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
export const sessions = signal<Session[]>(loadCachedSessions());

/** Currently active session key */
export const activeSessionKey = signal<string | null>(null);

/** Filter by session kind (null = all) */
export const sessionKindFilter = signal<string | null>(null);

/** Whether we're loading sessions */
export const isLoadingSessions = signal<boolean>(false);

/** Error from loading sessions */
export const sessionsError = signal<string | null>(null);

// ============================================
// Derived State
// ============================================

/** The currently active session (derived) */
export const activeSession = computed(
  () => sessions.value.find((s) => s.key === activeSessionKey.value) ?? null,
);

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

/** Sessions sorted by last active time, filtered by kind */
export const sessionsByRecent = computed(() => {
  let filtered = sessions.value;

  // Apply kind filter if set
  if (sessionKindFilter.value) {
    filtered = filtered.filter((s) => s.kind === sessionKindFilter.value);
  }

  // Sort by most recent
  return [...filtered].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
});

/** Number of sessions */
export const sessionCount = computed(() => sessions.value.length);

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
      limit: params?.limit ?? 50,
      activeMinutes: params?.activeMinutes ?? 60 * 24 * 7, // Last week by default
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
 * Find or create main session
 */
export function ensureMainSession(): string {
  // Default to 'main' session key
  const mainKey = "main";

  // Check if main session exists
  const mainSession = sessions.value.find((s) => s.key === mainKey);

  if (!mainSession) {
    // Add placeholder for main session
    sessions.value = [
      {
        key: mainKey,
        label: "Main",
        channel: "webchat",
      },
      ...sessions.value,
    ];
  }

  return mainKey;
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
  console.log("[sessions] updateSession:", sessionKey, updates);
  const before = sessions.value.find((s) => s.key === sessionKey);
  console.log("[sessions] before:", before?.model);
  sessions.value = sessions.value.map((s) => (s.key === sessionKey ? { ...s, ...updates } : s));
  const after = sessions.value.find((s) => s.key === sessionKey);
  console.log("[sessions] after:", after?.model);
}

/**
 * Remove a session from the list
 */
export function removeSession(sessionKey: string): void {
  sessions.value = sessions.value.filter((s) => s.key !== sessionKey);
  if (activeSessionKey.value === sessionKey) {
    activeSessionKey.value = null;
  }
}
