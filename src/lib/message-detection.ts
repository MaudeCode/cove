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

/** NO_REPLY pattern (should be hidden - these are signals to not send anything)
 * Also catches truncated versions like "NO_" from streaming race conditions */
const NO_REPLY_PATTERN = /^\s*no_(?:reply|repl|rep|re|r|_?)?\s*$/i;

/** Cron summary prefix pattern (isolated cron jobs post summaries with this prefix) */
const CRON_PREFIX_PATTERN = /^\s*\[cron\]/i;

/**
 * Check if a message is a heartbeat prompt
 */
function isHeartbeatPrompt(message: Message): boolean {
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
 * Check if a message is a NO_REPLY signal (or truncated version like "NO_")
 * These should be hidden entirely - they're signals to not send anything.
 */
export function isNoReply(message: Message): boolean {
  if (message.role !== "assistant") return false;
  return NO_REPLY_PATTERN.test(message.content);
}

/**
 * Check if raw content looks like a NO_REPLY signal.
 * Used for filtering streaming content before it's wrapped as a Message.
 */
export function isNoReplyContent(content: string): boolean {
  return NO_REPLY_PATTERN.test(content);
}

/**
 * Check if a message is a cron job summary (posted from isolated cron to main)
 */
export function isCronSummary(message: Message): boolean {
  if (message.role !== "assistant") return false;
  return CRON_PREFIX_PATTERN.test(message.content);
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
