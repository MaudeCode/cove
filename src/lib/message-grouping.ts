/**
 * Message Grouping
 *
 * Group special messages (compaction) for collapsed display.
 * Heartbeats are filtered out entirely (shown in HeartbeatIndicator).
 */

import type { Message } from "@/types/messages";
import {
  isCompactionSummary,
  isNoReply,
  isHeartbeatMessage,
  isCronSummary,
  isSystemEvent,
} from "./message-detection";

export type MessageGroup =
  | { type: "message"; message: Message }
  | { type: "compaction"; messages: Message[] }
  | { type: "cron"; message: Message };

/**
 * Group messages, filtering out heartbeats and marking compaction summaries.
 *
 * Dedup strategy: if structural compaction markers (msg.kind === "compaction")
 * exist, suppress regex-detected compaction messages within ±2 positions of
 * any structural marker to avoid duplicate dividers.
 */
export function groupMessages(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];

  // Build a set of indices near structural compaction markers for dedup.
  // When a structural marker exists, regex matches nearby are redundant.
  const structuralIndices = new Set<number>();
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].kind === "compaction") {
      for (let j = Math.max(0, i - 2); j <= Math.min(messages.length - 1, i + 2); j++) {
        structuralIndices.add(j);
      }
    }
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Skip NO_REPLY messages entirely - they're internal signals
    if (isNoReply(msg)) {
      continue;
    }

    // Skip heartbeat messages - they're shown in the HeartbeatIndicator dropdown
    if (isHeartbeatMessage(msg)) {
      continue;
    }

    // Skip internal system events (compaction triggers, etc.)
    if (isSystemEvent(msg)) {
      continue;
    }

    // Structural compaction marker — always show divider
    if (msg.kind === "compaction") {
      groups.push({ type: "compaction", messages: [msg] });
    } else if (isCompactionSummary(msg)) {
      // Regex-detected compaction: only show if not near a structural marker
      if (structuralIndices.has(i)) {
        // Suppress — the structural marker already covers this
        continue;
      }
      groups.push({ type: "compaction", messages: [msg] });
    } else if (isCronSummary(msg)) {
      groups.push({ type: "cron", message: msg });
    } else {
      groups.push({ type: "message", message: msg });
    }
  }

  return groups;
}
