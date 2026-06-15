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
  ensureRun,
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
    const historyRequestedAt = Date.now();
    const result = await loadStartupHistory(sessionKey, limit);
    const normalized = normalizeHistoryMessages(result.messages);

    if (!isForActiveSession(sessionKey)) {
      log.chat.debug("Ignoring stale history response for inactive session:", sessionKey);
      return;
    }

    const startupActiveRunIds = getStartupActiveRunIds(result);
    for (const runId of startupActiveRunIds) {
      ensureRun(runId, sessionKey);
    }
    const reconciled = reconcileMessagesFromHistory(sessionKey, normalized, historyRequestedAt, {
      preservePendingSteerRunIds: startupActiveRunIds,
      preserveSessionPendingSteers:
        startupActiveRunIds.size === 0 && getStartupHasActiveRun(result) === true,
    });
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

function getStartupHasActiveRun(result: ChatHistoryResult | ChatStartupResult): boolean {
  if (!("sessionInfo" in result)) return false;
  if (result.sessionInfo?.hasActiveRun === true) return true;
  return getStartupActiveRunIds(result).size > 0;
}

function getStartupActiveRunIds(result: ChatHistoryResult | ChatStartupResult): Set<string> {
  if (!("inFlightRun" in result)) return new Set();
  return extractRunIds(result.inFlightRun);
}

function extractRunIds(value: unknown): Set<string> {
  const runIds = new Set<string>();
  collectRunIds(value, runIds, 0);
  return runIds;
}

function collectRunIds(value: unknown, runIds: Set<string>, depth: number): void {
  if (depth > 2 || value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) {
      collectRunIds(item, runIds, depth + 1);
    }
    return;
  }

  const record = value as Record<string, unknown>;
  for (const key of ["runId", "id"]) {
    const runId = record[key];
    if (typeof runId === "string" && runId.trim()) {
      runIds.add(runId);
    }
  }

  for (const key of ["run", "activeRun", "inFlightRun"]) {
    collectRunIds(record[key], runIds, depth + 1);
  }
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
