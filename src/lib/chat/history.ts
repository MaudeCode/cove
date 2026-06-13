/**
 * Chat History
 *
 * Loading and processing chat history from the gateway.
 */

import { send } from "@/lib/gateway";
import { log } from "@/lib/logger";
import { DEFAULT_HISTORY_LIMIT } from "@/lib/constants";
import {
  isLoadingHistory,
  historyError,
  thinkingLevel,
  setMessages,
  saveCachedMessages,
} from "@/signals/chat";
import { normalizeHistoryMessages } from "./history-processing";

/** Track in-flight history loads to prevent concurrent loads for the same session */
const pendingLoads = new Map<string, Promise<void>>();

/**
 * Load chat history for a session.
 * Guards against concurrent loads for the same session.
 */
export async function loadHistory(
  sessionKey: string,
  limit = DEFAULT_HISTORY_LIMIT,
): Promise<void> {
  // If already loading this session, wait for the existing load
  const pending = pendingLoads.get(sessionKey);
  if (pending) {
    log.chat.debug("History load already in progress for session, waiting:", sessionKey);
    return pending;
  }

  const loadPromise = doLoadHistory(sessionKey, limit);
  pendingLoads.set(sessionKey, loadPromise);

  try {
    await loadPromise;
  } finally {
    pendingLoads.delete(sessionKey);
  }
}

/** Internal history load implementation */
async function doLoadHistory(sessionKey: string, limit: number): Promise<void> {
  isLoadingHistory.value = true;
  historyError.value = null;

  try {
    const result = await send("chat.history", { sessionKey, limit });
    const normalized = normalizeHistoryMessages(result.messages);

    setMessages(normalized);
    saveCachedMessages(sessionKey, normalized);

    if (result.thinkingLevel) {
      thinkingLevel.value = result.thinkingLevel;
    }
  } catch (err) {
    historyError.value = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    isLoadingHistory.value = false;
  }
}
