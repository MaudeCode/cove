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

/** Internal system event patterns — injected by gateway, never shown to user */
const SYSTEM_EVENT_PATTERNS = [
  /^pre-compaction memory flush/i,
  /^read heartbeat\.md if it exists/i,
];

/**
 * Check if a message is an internal system event that should be hidden.
 * These are gateway-injected prompts (compaction triggers, heartbeat prompts, etc.)
 * that duplicate what isHeartbeatMessage already catches, plus compaction-related events.
 */
export function isSystemEvent(message: Message): boolean {
  if (message.role !== "user") return false;
  return SYSTEM_EVENT_PATTERNS.some((pattern) => pattern.test(message.content));
}

/**
 * Strip envelope metadata that the gateway injects into visible messages.
 * Handles both formats:
 *  - Legacy: `[WebChat 2026-02-12T23:11Z] actual message`
 *  - New:    `Conversation info (untrusted metadata):\n```json\n{...}\n```\n\nactual message`
 *  - Fenced: ```metadata\nsender: assistant\nmessage_id: ...\n```\n\nactual message
 *
 * Can also strip standalone `[message_id: ...]` and `message_id: ...` lines for
 * inbound metadata cleanup. Assistant/system visible content should not enable that.
 */
export function stripEnvelopeMetadata(
  text: string,
  options: { stripStandaloneMessageIds?: boolean } = {},
): string {
  let result = text;
  const stripStandaloneMessageIds = options.stripStandaloneMessageIds ?? true;

  // New format: "Conversation info (untrusted metadata):" block followed by JSON fence
  result = result.replace(
    /^Conversation info \(untrusted metadata\):\s*```json[^\S\r\n]*\r?\n[\s\S]*?\r?\n```\s*/,
    "",
  );

  // Fenced sender metadata block at the start of a message. Keep ordinary code fences intact.
  result = stripLeadingMetadataFence(result);

  // Legacy format: [Channel YYYY-MM-DD...] prefix
  const legacyMatch = result.match(/^\[([^\]]+)\]\s*/);
  if (legacyMatch) {
    const header = legacyMatch[1] ?? "";
    const isEnvelope =
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(header) || /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(header);
    if (isEnvelope) {
      result = result.slice(legacyMatch[0].length);
    }
  }

  // Strip standalone message id lines only for inbound/user metadata cleanup.
  if (stripStandaloneMessageIds && /message[-_]id:/i.test(result)) {
    result = stripStandaloneMessageIdLines(result);
  }

  return result.trim();
}

function stripLeadingMetadataFence(text: string): string {
  const match = text.match(/^```([a-z0-9_-]+)?[^\S\r\n]*\r?\n([\s\S]*?)\r?\n```\s*/i);
  if (!match) return text;

  const language = match[1]?.toLowerCase() ?? "";
  if (!["metadata", "meta"].includes(language)) return text;

  const body = match[2] ?? "";
  if (!/(^|\r?\n)\s*(sender|message[-_]id)\s*:/i.test(body)) return text;

  return text.slice(match[0].length);
}

function stripStandaloneMessageIdLines(text: string): string {
  let inCodeFence = false;

  return text
    .split(/\r?\n/)
    .filter((line) => {
      if (/^\s*```/.test(line)) {
        inCodeFence = !inCodeFence;
        return true;
      }

      if (inCodeFence) return true;
      return !/^\s*\[?message[-_]id:\s*[^\]\r\n]+\]?\s*$/i.test(line);
    })
    .join("\n");
}

/** Compaction summary patterns */
const COMPACTION_PATTERNS = [
  /^<summary>/i,
  /the conversation.*compacted/i,
  /context was summarized/i,
];

/**
 * Check if a message is a compaction summary
 */
export function isCompactionSummary(message: Message): boolean {
  if (message.role !== "user") return false;
  return COMPACTION_PATTERNS.some((pattern) => pattern.test(message.content));
}
