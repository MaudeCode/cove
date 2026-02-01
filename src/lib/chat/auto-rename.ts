/**
 * Auto-Rename Chat Sessions
 *
 * Automatically rename new chat sessions based on the first message content.
 */

import { send } from "@/lib/gateway";
import { updateSession } from "@/signals/sessions";
import { isUserCreatedChat } from "@/lib/session-utils";
import { log } from "@/lib/logger";

/**
 * Truncate a message to create a title-friendly snippet
 */
function truncateMessage(message: string, maxLength: number): string {
  // Clean up whitespace
  const cleaned = message.trim().replace(/\s+/g, " ");

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  // Truncate and add ellipsis
  return cleaned.slice(0, maxLength).trim() + "…";
}

/**
 * Auto-rename a session based on the first message
 */
export async function autoRenameSession(sessionKey: string, firstMessage: string): Promise<void> {
  // Only auto-rename user-created chats
  if (!isUserCreatedChat(sessionKey)) {
    return;
  }

  const title = truncateMessage(firstMessage, 50);

  if (!title) {
    log.chat.debug("autoRenameSession: empty message, skipping");
    return;
  }

  try {
    log.chat.debug("autoRenameSession: renaming", { sessionKey, title });

    // Update on server
    await send("sessions.patch", {
      key: sessionKey,
      label: title,
    });

    // Update local state
    updateSession(sessionKey, { label: title });

    log.chat.info("autoRenameSession: renamed session", { sessionKey, title });
  } catch (err) {
    log.chat.error("autoRenameSession: failed", { sessionKey, error: err });
    // Non-fatal - don't throw, just log
  }
}
