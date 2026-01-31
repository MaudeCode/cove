/**
 * Chat Module
 *
 * High-level chat operations that combine gateway calls with state updates.
 *
 * Usage:
 *   import { loadHistory, sendMessage, abortChat, initChat } from '@/lib/chat'
 *
 *   await initChat('main')
 *   await sendMessage('main', 'Hello!')
 *   abortChat('main')
 */

import { clearMessages } from "@/signals/chat";
import { loadHistory } from "./history";
import { subscribeToChatEvents, unsubscribeFromChatEvents } from "./events";

// Re-export everything
export { loadHistory, reloadHistory } from "./history";
export {
  sendMessage,
  retryMessage,
  resendMessage,
  processMessageQueue,
  processNextQueuedMessage,
  abortChat,
  abortRun,
} from "./send";
export { subscribeToChatEvents, unsubscribeFromChatEvents } from "./events";

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
