/**
 * Message Detection
 *
 * Utilities for detecting special message types (heartbeat, compaction, etc.)
 */

import type { Message } from "@/types/messages";

/** Heartbeat prompt patterns */
const HEARTBEAT_PROMPT_PATTERNS = [
  /read heartbeat\.md/i,
  /heartbeat poll/i,
  /if nothing needs attention.*reply.*heartbeat_ok/i,
];

/** Heartbeat response pattern */
const HEARTBEAT_RESPONSE = /^\s*heartbeat_ok\s*$/i;

/**
 * Check if a message is a heartbeat prompt
 */
export function isHeartbeatPrompt(message: Message): boolean {
  if (message.role !== "user") return false;
  return HEARTBEAT_PROMPT_PATTERNS.some((pattern) => pattern.test(message.content));
}

/**
 * Check if a message is a heartbeat response
 */
export function isHeartbeatResponse(message: Message): boolean {
  if (message.role !== "assistant") return false;
  return HEARTBEAT_RESPONSE.test(message.content);
}

/**
 * Check if a message is part of a heartbeat exchange
 */
export function isHeartbeatMessage(message: Message): boolean {
  return isHeartbeatPrompt(message) || isHeartbeatResponse(message);
}

/** Compaction summary patterns */
const COMPACTION_PATTERNS = [
  /^<summary>/i,
  /the conversation.*compacted/i,
  /pre-compaction memory flush/i,
  /context was summarized/i,
];

/**
 * Check if a message is a compaction summary
 */
export function isCompactionSummary(message: Message): boolean {
  if (message.role !== "user") return false;
  return COMPACTION_PATTERNS.some((pattern) => pattern.test(message.content));
}

/**
 * Get the type of special message (if any)
 */
export type SpecialMessageType = "heartbeat-prompt" | "heartbeat-response" | "compaction" | null;

export function getSpecialMessageType(message: Message): SpecialMessageType {
  if (isHeartbeatPrompt(message)) return "heartbeat-prompt";
  if (isHeartbeatResponse(message)) return "heartbeat-response";
  if (isCompactionSummary(message)) return "compaction";
  return null;
}
