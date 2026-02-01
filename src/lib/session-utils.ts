/**
 * Session Utilities
 *
 * Shared helpers for parsing and working with session keys.
 */

import { mainSessionKey } from "@/lib/gateway";
import { capitalize } from "@/lib/utils";
import type { Session } from "@/types/sessions";

/** Known channel types that appear in session keys */
const CHANNEL_KEY_PATTERNS = [
  ":discord:",
  ":telegram:",
  ":signal:",
  ":slack:",
  ":whatsapp:",
  ":imessage:",
] as const;

/**
 * Check if a session key represents the main session
 */
export function isMainSession(sessionKey: string): boolean {
  return (
    sessionKey === mainSessionKey.value || sessionKey === "main" || sessionKey.endsWith(":main")
  );
}

/**
 * Check if a session is a cron session
 * Cron sessions have kind "cron" in the key (e.g. "agent:main:cron:uuid")
 */
export function isCronSession(session: Session): boolean {
  const kind = getSessionKind(session.key);
  return kind === "cron";
}

/**
 * Check if a session key is a user-created chat (vs main session, cron, etc.)
 * User-created chats have format: agent:<agentId>:chat:<uuid>
 */
export function isUserCreatedChat(sessionKey: string): boolean {
  return /^agent:[^:]+:chat:[^:]+$/.test(sessionKey);
}

/**
 * Check if a session is a spawn/sub-agent session
 */
export function isSpawnSession(session: Session): boolean {
  const kind = getSessionKind(session.key);
  return kind === "spawn";
}

/**
 * Check if a session is a channel session (discord, telegram, etc.)
 * Checks both session key pattern and gateway kind.
 */
export function isChannelSession(session: Session): boolean {
  const keyLower = session.key.toLowerCase();
  // Check key pattern for known channels
  if (CHANNEL_KEY_PATTERNS.some((pattern) => keyLower.includes(pattern))) {
    return true;
  }
  // Gateway kind "group" = channel session
  return session.kind === "group";
}

/**
 * Extract the agent ID from a session key
 * e.g. "agent:main:main" → "main"
 *      "agent:maude-pm:spawn:uuid" → "maude-pm"
 */
export function getAgentId(sessionKey: string): string | null {
  const parts = sessionKey.split(":");
  // Format: agent:<agentId>:<kind>[:uuid]
  if (parts.length >= 2 && parts[0] === "agent") {
    return parts[1];
  }
  return null;
}

/**
 * Extract the session kind from a session key
 * e.g. "agent:main:main" → "main"
 *      "agent:main:cron:uuid" → "cron"
 */
function getSessionKind(sessionKey: string): string | null {
  const parts = sessionKey.split(":");
  // Format: agent:<agentId>:<kind>[:uuid]
  if (parts.length >= 3 && parts[0] === "agent") {
    return parts[2];
  }
  return null;
}

/**
 * Format agent ID for display (capitalize, handle dashes)
 * e.g. "main" → "Main", "maude-pm" → "Maude PM"
 */
export function formatAgentName(agentId: string): string {
  return agentId.split("-").map(capitalize).join(" ");
}

/**
 * Check if a string looks like a UUID (contains dashes and is long)
 */
export function looksLikeUuid(str: string): boolean {
  return str.includes("-") && str.length > 20;
}

/**
 * Time group for session grouping
 */
export type TimeGroup = "pinned" | "today" | "yesterday" | "thisWeek" | "older";

/**
 * Get the time group for a session based on its last activity
 */
function getTimeGroup(session: Session): TimeGroup {
  // Main session is always pinned
  if (isMainSession(session.key)) {
    return "pinned";
  }

  const lastActive = session.updatedAt ?? session.lastActiveAt;
  if (!lastActive) return "older";

  const now = new Date();
  const sessionDate = new Date(lastActive);

  // Start of today
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Start of yesterday
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  // Start of this week (Sunday)
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - todayStart.getDay());

  if (sessionDate >= todayStart) return "today";
  if (sessionDate >= yesterdayStart) return "yesterday";
  if (sessionDate >= weekStart) return "thisWeek";
  return "older";
}

/**
 * Group sessions by time period
 */
export function groupSessionsByTime(sessions: Session[]): Map<TimeGroup, Session[]> {
  const groups = new Map<TimeGroup, Session[]>([
    ["pinned", []],
    ["today", []],
    ["yesterday", []],
    ["thisWeek", []],
    ["older", []],
  ]);

  for (const session of sessions) {
    const group = getTimeGroup(session);
    groups.get(group)!.push(session);
  }

  return groups;
}

/**
 * Format token count for display
 */
export function formatTokens(tokens: number | undefined): string | null {
  if (tokens === undefined || tokens === 0) return null;
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}
