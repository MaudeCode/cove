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
} from "./message-detection";

export type MessageGroup =
  | { type: "message"; message: Message }
  | { type: "compaction"; messages: Message[] }
  | { type: "cron"; message: Message };

/**
 * Group messages, filtering out heartbeats and marking compaction summaries.
 */
export function groupMessages(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];

  for (const msg of messages) {
    // Skip NO_REPLY messages entirely - they're internal signals
    if (isNoReply(msg)) {
      continue;
    }

    // Skip heartbeat messages - they're shown in the HeartbeatIndicator dropdown
    if (isHeartbeatMessage(msg)) {
      continue;
    }

    if (isCompactionSummary(msg)) {
      groups.push({ type: "compaction", messages: [msg] });
    } else if (isCronSummary(msg)) {
      groups.push({ type: "cron", message: msg });
    } else {
      groups.push({ type: "message", message: msg });
    }
  }

  return groups;
}
