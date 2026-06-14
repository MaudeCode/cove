/**
 * Chat History
 *
 * Loading and processing chat history from the gateway.
 */

import { isGatewayMethodAdvertised, isUnknownGatewayMethodError, send } from "@/lib/gateway";
import { log } from "@/lib/logger";
import { DEFAULT_HISTORY_LIMIT } from "@/lib/constants";
import {
  isLoadingHistory,
  historyError,
  thinkingLevel,
  reconcileMessagesFromHistory,
  saveCachedMessages,
} from "@/signals/chat";
import { applyChatMetadata } from "@/signals/models";
import { isForActiveSession } from "@/signals/sessions";
import { normalizeHistoryMessages } from "./history-processing";
import type { ChatHistoryResult, ChatStartupResult } from "@/types/chat";

/** Track in-flight history loads to prevent concurrent loads for the same session */
const pendingLoads = new Map<string, Promise<void>>();
let latestLoadToken = 0;

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
  const loadToken = ++latestLoadToken;
  isLoadingHistory.value = true;
  historyError.value = null;

  try {
    const result = await loadStartupHistory(sessionKey, limit);
    const normalized = normalizeHistoryMessages(result.messages);

    if (!isForActiveSession(sessionKey)) {
      log.chat.debug("Ignoring stale history response for inactive session:", sessionKey);
      return;
    }

    const reconciled = reconcileMessagesFromHistory(sessionKey, normalized);
    saveCachedMessages(sessionKey, reconciled);

    const sessionInfo = getStartupSessionInfo(result);
    const nextThinkingLevel = sessionInfo?.thinkingLevel ?? result.thinkingLevel;
    if (nextThinkingLevel) {
      thinkingLevel.value = nextThinkingLevel;
    }
    applyStartupMetadata(result);
  } catch (err) {
    if (loadToken === latestLoadToken) {
      historyError.value = err instanceof Error ? err.message : String(err);
    }
    throw err;
  } finally {
    if (loadToken === latestLoadToken) {
      isLoadingHistory.value = false;
    }
  }
}

function getStartupSessionInfo(result: ChatHistoryResult | ChatStartupResult) {
  return "sessionInfo" in result ? result.sessionInfo : undefined;
}

function applyStartupMetadata(result: ChatHistoryResult | ChatStartupResult): void {
  if ("metadata" in result) {
    applyChatMetadata(result.metadata);
  }
}

async function loadStartupHistory(
  sessionKey: string,
  limit: number,
): Promise<ChatHistoryResult | ChatStartupResult> {
  if (isGatewayMethodAdvertised("chat.startup") === false) {
    return send("chat.history", { sessionKey, limit });
  }

  try {
    return await send("chat.startup", { sessionKey, limit });
  } catch (err) {
    if (isUnknownGatewayMethodError(err, "chat.startup")) {
      return send("chat.history", { sessionKey, limit });
    }
    throw err;
  }
}
