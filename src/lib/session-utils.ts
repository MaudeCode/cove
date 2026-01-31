/**
 * Session Utilities
 *
 * Shared helpers for parsing and working with session keys.
 */

import { mainSessionKey } from "@/lib/gateway";

/**
 * Check if a session key represents the main session
 */
export function isMainSession(sessionKey: string): boolean {
  return (
    sessionKey === mainSessionKey.value || sessionKey === "main" || sessionKey.endsWith(":main")
  );
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
export function getSessionKind(sessionKey: string): string | null {
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
  return agentId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Check if a string looks like a UUID (contains dashes and is long)
 */
export function looksLikeUuid(str: string): boolean {
  return str.includes("-") && str.length > 20;
}
