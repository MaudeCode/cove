/**
 * Message Grouping
 *
 * Group special messages (heartbeats, compaction) for collapsed display.
 */

import type { Message } from "@/types/messages";
import { isHeartbeatMessage, isCompactionSummary, isNoReply } from "./message-detection";

export type MessageGroup =
  | { type: "message"; message: Message }
  | { type: "heartbeat"; messages: Message[] }
  | { type: "compaction"; messages: Message[] };

/**
 * Group messages, collapsing consecutive heartbeats and marking compaction summaries.
 */
export function groupMessages(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let currentHeartbeatGroup: Message[] = [];

  const flushHeartbeats = () => {
    if (currentHeartbeatGroup.length > 0) {
      groups.push({ type: "heartbeat", messages: currentHeartbeatGroup });
      currentHeartbeatGroup = [];
    }
  };

  for (const msg of messages) {
    // Skip NO_REPLY messages entirely - they're internal signals
    if (isNoReply(msg)) {
      continue;
    }

    if (isHeartbeatMessage(msg)) {
      currentHeartbeatGroup.push(msg);
    } else if (isCompactionSummary(msg)) {
      flushHeartbeats();
      groups.push({ type: "compaction", messages: [msg] });
    } else {
      flushHeartbeats();
      groups.push({ type: "message", message: msg });
    }
  }

  flushHeartbeats();
  return groups;
}
