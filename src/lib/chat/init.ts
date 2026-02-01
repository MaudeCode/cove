/**
 * Chat Initialization
 *
 * High-level chat setup and teardown.
 */

import { clearMessages } from "@/signals/chat";
import { loadHistory } from "./history";
import { subscribeToChatEvents, unsubscribeFromChatEvents } from "./events";

/**
 * Initialize chat for a session.
 */
export async function initChat(sessionKey: string): Promise<void> {
  subscribeToChatEvents();
  await loadHistory(sessionKey);
}

/**
 * Cleanup chat state and subscriptions.
 */
export function cleanupChat(): void {
  unsubscribeFromChatEvents();
  clearMessages();
}
