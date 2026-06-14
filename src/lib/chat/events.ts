/**
 * Chat Events
 *
 * Handling streaming events from the gateway.
 */

import { batch } from "@preact/signals";
import {
  isConnected,
  isGatewayMethodAdvertised,
  isUnknownGatewayMethodError,
  on,
  send,
  subscribe,
} from "@/lib/gateway";
import { log } from "@/lib/logger";
import { isChatEvent, isAgentEvent } from "@/lib/type-guards";
import {
  activeRuns,
  startRun,
  updateRunContent,
  completeRun,
  errorRun,
  abortRun as abortRunSignal,
  isCompacting,
  lastCompactionSummary,
  showCompletedCompaction,
  compactionInsertIndex,
  messages,
  addMessage,
} from "@/signals/chat";
import { effectiveSessionKey, isForActiveSession } from "@/signals/sessions";
import type { Message, ToolCall } from "@/types/messages";
import type { ChatEvent, AgentEvent, ChatRun } from "@/types/chat";
import { parseMessageContent, mergeToolCalls } from "@/types/chat";
import { isHeartbeatResponse } from "@/lib/message-detection";
import { processNextQueuedMessage } from "./send";
import { loadHistory } from "./history";
import { clearResetRuns, consumeResetRun, reconcileResetFinal } from "./reset-reconciliation";
import { extractToolResultContent } from "@/lib/tool-utils";
import { mergeAssistantStreamContent } from "./stream-events";

let chatEventUnsubscribe: (() => void) | null = null;
let agentEventUnsubscribe: (() => void) | null = null;
let sideResultUnsubscribe: (() => void) | null = null;
let activeSessionUnsubscribe: (() => void) | null = null;
let connectionUnsubscribe: (() => void) | null = null;
let selectedMessageSubscriptionKey: string | null = null;
let selectedMessageSubscriptionRequestedKey: string | null = null;
let selectedMessageSubscriptionPendingKey: string | null = null;
let selectedMessageSubscriptionGeneration = 0;
let selectedMessageSubscriptionUnsupported = false;
let sessionMessageRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let sessionMessageRefreshKey: string | null = null;
let sessionMessageRefreshNeedsActiveRunDelay = false;

/** Track runIds that belong to compaction — lifecycle handlers should ignore these */
const compactionRunIds = new Set<string>();
const chatDeltaFallbackRunIds = new Set<string>();
const SESSION_MESSAGE_REFRESH_DEBOUNCE_MS = 100;
const SESSION_MESSAGE_ACTIVE_RUN_REFRESH_DEFER_MS = 1_000;

/**
 * Subscribe to chat events from the gateway.
 */
export function subscribeToChatEvents(): () => void {
  if (chatEventUnsubscribe && agentEventUnsubscribe && sideResultUnsubscribe) {
    initSelectedSessionMessageSubscription();
    return unsubscribeFromChatEvents;
  }

  log.chat.info("Subscribing to chat events");

  chatEventUnsubscribe = on("chat", (payload) => {
    if (!isChatEvent(payload)) {
      log.chat.warn("Invalid chat event payload:", payload);
      return;
    }
    handleChatEvent(payload);
  });

  agentEventUnsubscribe = on("agent", (payload) => {
    if (!isAgentEvent(payload)) {
      log.chat.warn("Invalid agent event payload:", payload);
      return;
    }
    const evt = payload;

    if (evt.stream === "tool") {
      handleToolEvent(evt);
    } else if (evt.stream === "lifecycle") {
      if (evt.data?.phase === "start") {
        handleLifecycleStart(evt);
      } else if (evt.data?.phase === "end" || evt.data?.phase === "error") {
        handleLifecycleEnd(evt);
      }
    } else if (evt.stream === "compaction") {
      handleCompactionEvent(evt);
    } else if (evt.stream === "assistant") {
      handleAssistantStreamEvent(evt);
    }
  });

  sideResultUnsubscribe = subscribe((event) => {
    if (event.event === "chat.side_result") {
      handleSideResultEvent(event.payload, event.seq);
      return;
    }
    if (event.event === "session.message") {
      handleSessionMessageEvent(event.payload);
    }
  });

  initSelectedSessionMessageSubscription();

  return unsubscribeFromChatEvents;
}

/**
 * Unsubscribe from chat events.
 */
export function unsubscribeFromChatEvents(): void {
  if (chatEventUnsubscribe) {
    chatEventUnsubscribe();
    chatEventUnsubscribe = null;
  }
  if (agentEventUnsubscribe) {
    agentEventUnsubscribe();
    agentEventUnsubscribe = null;
  }
  if (sideResultUnsubscribe) {
    sideResultUnsubscribe();
    sideResultUnsubscribe = null;
  }
  cleanupSelectedSessionMessageSubscription();
  clearPendingSessionMessageRefresh();
  compactionRunIds.clear();
  chatDeltaFallbackRunIds.clear();
  clearResetRuns();
}

function initSelectedSessionMessageSubscription(): void {
  if (activeSessionUnsubscribe && connectionUnsubscribe) {
    syncSelectedSessionMessageSubscription();
    return;
  }

  activeSessionUnsubscribe = effectiveSessionKey.subscribe(() => {
    syncSelectedSessionMessageSubscription();
  });
  connectionUnsubscribe = isConnected.subscribe((connected) => {
    if (!connected) {
      selectedMessageSubscriptionGeneration++;
      selectedMessageSubscriptionKey = null;
      selectedMessageSubscriptionRequestedKey = null;
      selectedMessageSubscriptionPendingKey = null;
      return;
    }
    selectedMessageSubscriptionUnsupported = false;
    syncSelectedSessionMessageSubscription({ force: true });
  });

  syncSelectedSessionMessageSubscription();
}

function cleanupSelectedSessionMessageSubscription(): void {
  activeSessionUnsubscribe?.();
  activeSessionUnsubscribe = null;
  connectionUnsubscribe?.();
  connectionUnsubscribe = null;
  selectedMessageSubscriptionGeneration++;

  const key = selectedMessageSubscriptionKey;
  selectedMessageSubscriptionKey = null;
  selectedMessageSubscriptionRequestedKey = null;
  selectedMessageSubscriptionPendingKey = null;

  if (key && isConnected.value && !selectedMessageSubscriptionUnsupported) {
    send("sessions.messages.unsubscribe", { key }).catch((err) => {
      if (!isSelectedMessageSubscriptionUnavailable(err, "sessions.messages.unsubscribe")) {
        log.chat.warn("Failed to unsubscribe from selected-session messages:", err);
      }
    });
  }
}

function syncSelectedSessionMessageSubscription(opts: { force?: boolean } = {}): void {
  const nextKey = normalizeSubscriptionKey(effectiveSessionKey.value);

  if (!isConnected.value || selectedMessageSubscriptionUnsupported) {
    return;
  }

  if (isGatewayMethodAdvertised("sessions.messages.subscribe") === false) {
    selectedMessageSubscriptionUnsupported = true;
    return;
  }

  if (!nextKey) {
    if (selectedMessageSubscriptionKey) {
      void unsubscribeSelectedSessionMessageBestEffort(selectedMessageSubscriptionKey);
    }
    selectedMessageSubscriptionGeneration++;
    selectedMessageSubscriptionKey = null;
    selectedMessageSubscriptionRequestedKey = null;
    selectedMessageSubscriptionPendingKey = null;
    return;
  }

  if (
    !opts.force &&
    selectedMessageSubscriptionRequestedKey === nextKey &&
    selectedMessageSubscriptionKey
  ) {
    return;
  }

  if (!opts.force && selectedMessageSubscriptionPendingKey === nextKey) {
    return;
  }

  const generation = ++selectedMessageSubscriptionGeneration;
  const previousKey = selectedMessageSubscriptionKey;
  const previousRequestedKey = selectedMessageSubscriptionRequestedKey;
  const selectedKeyChanged = previousRequestedKey !== null && previousRequestedKey !== nextKey;
  const shouldUnsubscribePrevious = Boolean(previousKey && (selectedKeyChanged || opts.force));
  const shouldSubscribe =
    opts.force ||
    selectedKeyChanged ||
    selectedMessageSubscriptionKey === null ||
    selectedMessageSubscriptionRequestedKey === null;

  selectedMessageSubscriptionPendingKey = shouldSubscribe ? nextKey : null;

  void (async () => {
    try {
      if (shouldUnsubscribePrevious && previousKey) {
        void unsubscribeSelectedSessionMessageBestEffort(previousKey);
        if (isCurrentSelectedSessionMessageSync(generation, nextKey)) {
          selectedMessageSubscriptionKey = null;
          selectedMessageSubscriptionRequestedKey = null;
        }
      }

      if (!shouldSubscribe || !isCurrentSelectedSessionMessageSync(generation, nextKey)) {
        return;
      }

      const result = await send("sessions.messages.subscribe", { key: nextKey });
      const subscribedKey = getSubscriptionResultKey(result) ?? nextKey;

      if (!isCurrentSelectedSessionMessageSync(generation, nextKey)) {
        if (!isCurrentSelectedSessionMessageSubscription(subscribedKey, nextKey)) {
          await unsubscribeSelectedSessionMessageBestEffort(subscribedKey);
        }
        return;
      }

      selectedMessageSubscriptionKey = subscribedKey;
      selectedMessageSubscriptionRequestedKey = nextKey;
    } catch (err) {
      if (isSelectedMessageSubscriptionUnavailable(err, "sessions.messages.subscribe")) {
        selectedMessageSubscriptionUnsupported = true;
        log.chat.warn("Selected-session message subscriptions are unavailable:", err);
      } else if (isCurrentSelectedSessionMessageSync(generation, nextKey)) {
        log.chat.warn("Failed to subscribe to selected-session messages:", err);
      }
    } finally {
      if (isCurrentSelectedSessionMessageSync(generation, nextKey)) {
        selectedMessageSubscriptionPendingKey = null;
      }
    }
  })();
}

function isCurrentSelectedSessionMessageSync(generation: number, requestedKey: string): boolean {
  return (
    activeSessionUnsubscribe !== null &&
    generation === selectedMessageSubscriptionGeneration &&
    normalizeSubscriptionKey(effectiveSessionKey.value) === requestedKey
  );
}

function isCurrentSelectedSessionMessageSubscription(
  subscribedKey: string,
  requestedKey: string,
): boolean {
  return (
    activeSessionUnsubscribe !== null &&
    selectedMessageSubscriptionKey === subscribedKey &&
    normalizeSubscriptionKey(effectiveSessionKey.value) === requestedKey
  );
}

async function unsubscribeSelectedSessionMessageBestEffort(key: string): Promise<void> {
  if (!isConnected.value || selectedMessageSubscriptionUnsupported) return;
  try {
    await send("sessions.messages.unsubscribe", { key });
  } catch (err) {
    if (!isSelectedMessageSubscriptionUnavailable(err, "sessions.messages.unsubscribe")) {
      log.chat.warn("Failed to unsubscribe from stale selected-session messages:", err);
    }
  }
}

function normalizeSubscriptionKey(key: string | null | undefined): string | null {
  const normalized = key?.trim();
  return normalized ? normalized : null;
}

function getSubscriptionResultKey(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const key = (result as { key?: unknown }).key;
  return typeof key === "string" ? normalizeSubscriptionKey(key) : null;
}

function isSelectedMessageSubscriptionUnavailable(err: unknown, method: string): boolean {
  if (isUnknownGatewayMethodError(err, method)) return true;
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return message.includes("unknown method") && message.includes(method.toLowerCase());
}

function handleSessionMessageEvent(payload: unknown): void {
  const event = parseSessionMessageEvent(payload);
  const sessionKey = event.sessionKey;

  if (!isForActiveSession(sessionKey)) {
    return;
  }

  const keyToLoad = normalizeSubscriptionKey(effectiveSessionKey.value) ?? sessionKey;
  if (!keyToLoad) return;

  scheduleSessionMessageRefresh(keyToLoad, event.hasActiveRun);
}

function parseSessionMessageEvent(payload: unknown): {
  hasActiveRun: boolean;
  sessionKey?: string;
} {
  if (!payload || typeof payload !== "object") {
    return { hasActiveRun: false };
  }

  const data = payload as { hasActiveRun?: unknown; sessionKey?: unknown };
  return {
    hasActiveRun: data.hasActiveRun === true,
    sessionKey: typeof data.sessionKey === "string" ? data.sessionKey : undefined,
  };
}

function scheduleSessionMessageRefresh(key: string, hasActiveRun: boolean): void {
  sessionMessageRefreshKey = key;
  sessionMessageRefreshNeedsActiveRunDelay =
    sessionMessageRefreshNeedsActiveRunDelay || hasActiveRun || hasPendingRunForSession(key);

  if (sessionMessageRefreshTimer !== null) {
    clearTimeout(sessionMessageRefreshTimer);
  }

  const delay = sessionMessageRefreshNeedsActiveRunDelay
    ? SESSION_MESSAGE_ACTIVE_RUN_REFRESH_DEFER_MS
    : SESSION_MESSAGE_REFRESH_DEBOUNCE_MS;

  sessionMessageRefreshTimer = setTimeout(() => {
    void flushSessionMessageRefresh();
  }, delay);
}

async function flushSessionMessageRefresh(): Promise<void> {
  sessionMessageRefreshTimer = null;
  const key = sessionMessageRefreshKey;
  sessionMessageRefreshKey = null;
  sessionMessageRefreshNeedsActiveRunDelay = false;

  if (!key || !isForActiveSession(key)) {
    return;
  }

  if (hasPendingRunForSession(key)) {
    scheduleSessionMessageRefresh(key, true);
    return;
  }

  try {
    await loadHistory(key);
  } catch (err) {
    log.chat.warn("Failed to refresh history after session message event:", err);
  }
}

function clearPendingSessionMessageRefresh(): void {
  if (sessionMessageRefreshTimer !== null) {
    clearTimeout(sessionMessageRefreshTimer);
  }
  sessionMessageRefreshTimer = null;
  sessionMessageRefreshKey = null;
  sessionMessageRefreshNeedsActiveRunDelay = false;
}

function hasPendingRunForSession(sessionKey: string): boolean {
  for (const run of activeRuns.value.values()) {
    if (run.sessionKey === sessionKey && (run.status === "pending" || run.status === "streaming")) {
      return true;
    }
  }
  return false;
}

/**
 * Handle lifecycle start event - ensures run exists even before text deltas.
 */
function handleLifecycleStart(evt: AgentEvent): void {
  const { runId, sessionKey } = evt;

  // Filter out events from other sessions
  if (!isForActiveSession(sessionKey)) {
    return;
  }

  // Skip compaction runs — they don't produce user-visible messages
  if (compactionRunIds.has(runId)) return;

  const existingRun = activeRuns.value.get(runId);

  if (!existingRun && sessionKey) {
    log.chat.debug("Creating run on-the-fly for lifecycle start:", runId, "session:", sessionKey);
    startRun(runId, sessionKey);
  }
}

/**
 * Handle lifecycle end event - completes runs that may not receive a chat.final event.
 * This is critical for heartbeat runs where the gateway suppresses chat events but still
 * sends lifecycle events.
 */
function handleLifecycleEnd(evt: AgentEvent): void {
  const { runId, sessionKey } = evt;

  // Filter out events from other sessions
  if (!isForActiveSession(sessionKey)) {
    return;
  }

  // Skip compaction runs — handled by handleCompactionEvent
  // Also clear isCompacting as a safety fallback in case the compaction stream
  // "end" event was missed or arrived out of order.
  if (compactionRunIds.has(runId)) {
    compactionRunIds.delete(runId);
    if (isCompacting.value) {
      log.chat.warn("Clearing stale isCompacting flag via lifecycle end for run:", runId);
      batch(() => {
        isCompacting.value = false;
        showCompletedCompaction.value = true;
      });
    }
    return;
  }

  const existingRun = activeRuns.value.get(runId);

  if (existingRun && (existingRun.status === "pending" || existingRun.status === "streaming")) {
    log.chat.debug("Completing run via lifecycle end:", runId, "phase:", evt.data?.phase);

    if (consumeResetRun(runId)) {
      chatDeltaFallbackRunIds.delete(runId);
      completeRun(runId);
      if (existingRun.sessionKey) {
        setTimeout(() => processNextQueuedMessage(existingRun.sessionKey), 100);
      }
      return;
    }

    const wasEmpty = !existingRun.content;

    // If the run has content, create a message from it
    if (existingRun.content) {
      const finalMessage = {
        id: `assistant_${runId}`,
        role: "assistant" as const,
        content: existingRun.content,
        toolCalls: existingRun.toolCalls?.length ? existingRun.toolCalls : undefined,
        timestamp: Date.now(),
      };
      completeRun(runId, finalMessage);
    } else {
      // Empty run (heartbeat, no-reply, etc.) - just complete without adding a message
      completeRun(runId);
    }

    // Process next queued message
    if (existingRun.sessionKey) {
      setTimeout(() => processNextQueuedMessage(existingRun.sessionKey), 100);

      // For empty runs (heartbeat/no-reply), refresh history to pick up the prompt message
      // that was injected by the gateway but not broadcast to webchat.
      // Add a small delay to ensure the gateway has committed the messages.
      if (wasEmpty) {
        const sessionKeyForRefresh = existingRun.sessionKey;
        setTimeout(() => {
          loadHistory(sessionKeyForRefresh).catch((err) => {
            log.chat.warn("Failed to refresh history after heartbeat:", err);
          });
        }, 500);
      }
    }
  }
}

/**
 * Handle compaction events from the agent stream.
 * On "end", transitions the inline divider from active → completed state.
 * On reload, the gateway's __openclaw compaction marker in history handles it.
 */
function handleCompactionEvent(evt: AgentEvent): void {
  if (!isForActiveSession(evt.sessionKey)) {
    return;
  }

  const phase = evt.data?.phase;
  log.chat.info(
    "Compaction event:",
    phase,
    "runId:",
    evt.runId,
    "isCompacting:",
    isCompacting.value,
  );

  // Track this runId so lifecycle handlers don't create a ghost run/message
  if (evt.runId) {
    compactionRunIds.add(evt.runId);
  }

  if (phase === "start") {
    // Clean up any ghost run created by handleLifecycleStart before we registered the runId
    if (evt.runId && activeRuns.value.has(evt.runId)) {
      log.chat.debug("Removing ghost run created before compaction registration:", evt.runId);
      const newRuns = new Map(activeRuns.value);
      newRuns.delete(evt.runId);
      activeRuns.value = newRuns;
    }
    isCompacting.value = true;
  } else if (phase === "end") {
    // Capture where the divider should be rendered (current message count)
    const insertIdx = messages.value.length;

    const summary = typeof evt.data?.summary === "string" ? evt.data.summary : undefined;

    batch(() => {
      isCompacting.value = false;
      lastCompactionSummary.value = summary;
      showCompletedCompaction.value = true;
      compactionInsertIndex.value = insertIdx;
    });
    log.chat.info("Compaction ended, divider at index:", insertIdx);
  }
}

/**
 * Handle assistant stream events (immediate text updates, not throttled).
 * These arrive faster than chat delta events which are throttled at 150ms.
 *
 * Uses `text` (accumulated text for current block) which resets after tool calls.
 * We detect block boundaries by checking if new text is NOT a continuation of existing content.
 */
function handleAssistantStreamEvent(evt: AgentEvent): void {
  const { runId, sessionKey, data } = evt;
  const text = typeof data?.text === "string" ? data.text : null;
  const delta = typeof data?.delta === "string" ? data.delta : null;

  if (!text && !delta) return;

  // Skip compaction runs
  if (compactionRunIds.has(runId)) return;

  // Session filter - only process events for the active session
  if (!isForActiveSession(sessionKey)) {
    return;
  }

  let run = activeRuns.value.get(runId);

  // If no run exists, create one on-the-fly
  if (!run && sessionKey) {
    log.chat.debug("Creating run for assistant stream:", runId, "session:", sessionKey);
    startRun(runId, sessionKey);
    run = activeRuns.value.get(runId);
  }

  if (!run) return;

  if (text || delta) {
    chatDeltaFallbackRunIds.delete(runId);
  }

  const merged = mergeAssistantStreamContent(run, text, delta);
  if (!merged) return;

  updateRunContent(runId, merged.content, run.toolCalls, merged.lastBlockStart);
}

/**
 * Handle a tool event from the agent stream.
 */
function handleToolEvent(evt: AgentEvent): void {
  const { runId, sessionKey, data } = evt;
  if (!data) return;

  // Skip compaction runs
  if (compactionRunIds.has(runId)) return;

  // Filter out events from other sessions
  if (!isForActiveSession(sessionKey)) {
    return;
  }

  log.chat.debug("Tool event received", {
    runId,
    phase: data.phase,
    toolCallId: data.toolCallId,
    toolName: data.name,
  });

  let run = activeRuns.value.get(runId);

  // If no run exists (e.g., page refreshed mid-stream), create one on-the-fly
  if (!run) {
    log.chat.debug("Creating run on-the-fly for tool event:", runId, "session:", sessionKey);
    startRun(runId, sessionKey ?? "unknown");
    run = activeRuns.value.get(runId);
    if (!run) return;
  }

  const toolCallId = data.toolCallId ?? `tool_${Date.now()}`;
  const toolName = data.name ?? "unknown";
  const existingToolCalls = [...run.toolCalls];

  log.chat.debug("Tool event state before processing", {
    runId,
    currentContentLen: run.content.length,
    existingToolCallsCount: existingToolCalls.length,
    existingToolCallIds: existingToolCalls.map((tc) => tc.id),
  });

  // Helper to find or create a tool call entry
  const findOrCreateToolCall = (): number => {
    let idx = existingToolCalls.findIndex((tc) => tc.id === toolCallId);
    if (idx < 0) {
      log.chat.debug("Creating missing tool call:", toolCallId);
      existingToolCalls.push({
        id: toolCallId,
        name: toolName,
        args: data.args as Record<string, unknown> | undefined,
        status: "running",
        startedAt: Date.now(),
        insertedAtContentLength: run!.content.length,
        contentSnapshotAtStart: run!.content,
      });
      idx = existingToolCalls.length - 1;
    } else if (data.args && !existingToolCalls[idx].args) {
      // Backfill args if we receive them later
      existingToolCalls[idx] = {
        ...existingToolCalls[idx],
        args: data.args as Record<string, unknown>,
      };
    }
    return idx;
  };

  switch (data.phase) {
    case "start": {
      // Avoid duplicates
      if (existingToolCalls.some((tc) => tc.id === toolCallId)) {
        log.chat.debug("Tool start skipped - duplicate", { toolCallId });
        return;
      }

      // Defer tool start processing to allow any pending text deltas to be processed first
      setTimeout(() => {
        const currentRun = activeRuns.value.get(runId);
        if (!currentRun) {
          log.chat.warn("Tool start deferred - run no longer exists", { runId, toolCallId });
          return;
        }

        const currentToolCalls = [...currentRun.toolCalls];
        if (currentToolCalls.some((tc) => tc.id === toolCallId)) {
          log.chat.debug("Tool start deferred skipped - duplicate", { toolCallId });
          return;
        }

        const newToolCall: ToolCall = {
          id: toolCallId,
          name: toolName,
          args: data.args as Record<string, unknown> | undefined,
          status: "running",
          startedAt: Date.now(),
          insertedAtContentLength: currentRun.content.length,
          contentSnapshotAtStart: currentRun.content,
        };

        log.chat.debug("Tool start processed", {
          toolCallId,
          toolName,
          insertedAtContentLength: newToolCall.insertedAtContentLength,
          contentSnapshotLen: currentRun.content.length,
        });

        currentToolCalls.push(newToolCall);
        updateRunContent(runId, currentRun.content, currentToolCalls);
      }, 0);
      break;
    }

    case "update": {
      const idx = findOrCreateToolCall();
      existingToolCalls[idx] = {
        ...existingToolCalls[idx],
        result: extractToolResultContent(data.partialResult),
      };
      updateRunContent(runId, run.content, existingToolCalls);
      break;
    }

    case "result": {
      const idx = findOrCreateToolCall();
      existingToolCalls[idx] = {
        ...existingToolCalls[idx],
        result: extractToolResultContent(data.result),
        status: data.isError ? "error" : "complete",
        completedAt: Date.now(),
      };
      updateRunContent(runId, run.content, existingToolCalls);
      break;
    }
  }
}

/**
 * Handle a chat event from the gateway.
 */
function handleChatEvent(event: ChatEvent): void {
  const { runId, state, errorMessage } = event;

  // Filter out events from other sessions — without this, hook/cron/channel sessions
  // create phantom runs in activeRuns, which sets the global isStreaming flag and
  // blocks the user from sending messages in the active session.
  if (!isForActiveSession(event.sessionKey)) {
    return;
  }

  // Skip compaction runs — they don't produce user-visible messages
  if (compactionRunIds.has(runId)) {
    log.chat.debug("Skipping chat event for compaction run:", runId, state);
    return;
  }

  log.chat.debug("Chat event:", state, runId, "session:", event.sessionKey);

  switch (state) {
    case "delta":
      handleDeltaEvent(event);
      break;

    case "final":
      handleFinalEvent(event);
      break;

    case "aborted":
      chatDeltaFallbackRunIds.delete(runId);
      abortRunSignal(runId);
      break;

    case "error":
      chatDeltaFallbackRunIds.delete(runId);
      errorRun(runId, errorMessage ?? "Unknown error");
      break;
  }
}

/**
 * Handle streaming delta event.
 *
 * Text updates are handled by assistant stream (faster, not throttled).
 * Chat delta only processes tool calls as a supplement to tool events.
 */
function handleDeltaEvent(event: ChatEvent): void {
  const { runId, sessionKey, message, deltaText, replace } = event;

  const parsed = message ? parseMessageContent(message.content) : null;
  let existingRun = activeRuns.value.get(runId);

  // If no run exists (e.g., page refreshed mid-stream), create one on-the-fly
  if (!existingRun) {
    log.chat.debug("Creating run on-the-fly for delta:", runId, "session:", sessionKey);
    startRun(runId, sessionKey);
    existingRun = activeRuns.value.get(runId);
    if (!existingRun) return;
  }

  const shouldUseTextFallback =
    typeof deltaText === "string" &&
    deltaText.length > 0 &&
    (!existingRun.content || chatDeltaFallbackRunIds.has(runId));
  if (shouldUseTextFallback) {
    chatDeltaFallbackRunIds.add(runId);
    const nextContent = replace ? deltaText : existingRun.content + deltaText;
    const nextToolCalls = parsed?.toolCalls.length
      ? mergeToolCalls(existingRun.toolCalls, parsed.toolCalls)
      : existingRun.toolCalls;
    updateRunContent(runId, nextContent, nextToolCalls, existingRun.lastBlockStart);
    return;
  }

  if (!parsed) return;

  // Only process if there are tool calls to merge
  // Text content is handled by assistant stream events (faster, not throttled)
  if (parsed.toolCalls.length === 0) {
    return;
  }

  log.chat.debug("Delta event - processing tool calls only", {
    runId,
    parsedToolCallsCount: parsed.toolCalls.length,
    existingToolCallsCount: existingRun.toolCalls.length,
  });

  // Merge tool calls
  const mergedToolCalls = mergeToolCalls(existingRun.toolCalls, parsed.toolCalls);

  // Keep existing content, only update tool calls
  updateRunContent(runId, existingRun.content, mergedToolCalls, existingRun.lastBlockStart);
}

function handleSideResultEvent(payload: unknown, seq?: number): void {
  if (!payload || typeof payload !== "object") return;
  const data = payload as { sessionKey?: string; text?: string; title?: string };
  if (!isForActiveSession(data.sessionKey)) return;

  const text = typeof data.text === "string" ? data.text.trim() : "";
  if (!text) return;

  addMessage({
    id: `side_${data.sessionKey ?? "session"}_${seq ?? Date.now()}`,
    role: "system",
    content: data.title ? `**${data.title}**\n\n${text}` : text,
    timestamp: Date.now(),
  });
}

/**
 * Handle final message event.
 */
function handleFinalEvent(event: ChatEvent): void {
  const { runId, sessionKey, message } = event;
  let existingRun = activeRuns.value.get(runId);

  log.chat.debug("Final event received", {
    runId,
    hasExistingRun: !!existingRun,
    existingContentLen: existingRun?.content?.length,
    existingToolCallsCount: existingRun?.toolCalls?.length,
    hasMessage: !!message,
  });

  // If no run exists, create one on-the-fly (even without message, to properly complete it)
  if (!existingRun) {
    log.chat.debug("Creating run on-the-fly for final:", runId, "session:", sessionKey);
    startRun(runId, sessionKey);
    existingRun = activeRuns.value.get(runId);
  }

  // If still no run (shouldn't happen), just bail
  if (!existingRun) {
    log.chat.warn("Final event with no run and couldn't create one:", runId);
    return;
  }

  // Check for heartbeat responses - complete run immediately without adding message
  if (message?.content) {
    const parsed = parseMessageContent(message.content);
    if (
      parsed.text &&
      isHeartbeatResponse({ role: "assistant", content: parsed.text, id: "", timestamp: 0 })
    ) {
      log.chat.debug("Heartbeat detected, completing run without message:", runId);
      completeRun(runId);
      setTimeout(() => processNextQueuedMessage(sessionKey), 100);
      return;
    }
  }

  const finalMessage = buildFinalMessage(runId, existingRun, message);

  const resetAction = reconcileResetFinal(runId, finalMessage);
  if (resetAction === "drop" || resetAction === "defer") {
    log.chat.debug("Reset final reconciled from history:", runId, "action:", resetAction);
    completeRun(runId);
    chatDeltaFallbackRunIds.delete(runId);
    setTimeout(() => {
      processNextQueuedMessage(sessionKey);
    }, 100);
    return;
  }

  completeRun(runId, finalMessage);
  chatDeltaFallbackRunIds.delete(runId);

  // Process next queued message after a short delay
  setTimeout(() => {
    processNextQueuedMessage(sessionKey);
  }, 100);
}

function buildFinalMessage(
  runId: string,
  existingRun: ChatRun,
  message: ChatEvent["message"],
): Message {
  // The gateway final event only sends merged text (no tool_use blocks).
  // Tool call positions were set during streaming based on the streamed content.
  // We must keep the streamed content + positions together since they're consistent.
  // Only fall back to the final message text if we have no streamed content.
  let finalContent = existingRun.content;

  if (message?.content) {
    const parsed = parseMessageContent(message.content);

    log.chat.debug("Final message parsed", {
      runId,
      parsedTextLen: parsed.text.length,
      parsedToolCallsCount: parsed.toolCalls.length,
      existingContentLen: finalContent.length,
      existingToolCallsCount: existingRun.toolCalls.length,
    });

    // If the final message has tool_use blocks (history replay), use its text + positions
    if (parsed.toolCalls.length > 0) {
      finalContent = parsed.text;
    } else if (!finalContent && parsed.text) {
      // No streamed content — use the final message text
      finalContent = parsed.text;
    }
    // Otherwise keep streamed content — it's consistent with tool call positions
  }

  log.chat.debug("Final content determined", {
    runId,
    finalContentLen: finalContent.length,
    finalContentPreview: finalContent.slice(-200),
  });

  // Keep streaming tool calls with their original positions (consistent with finalContent)
  const finalToolCalls = existingRun.toolCalls.map((tc) => {
    const updated = { ...tc };

    if (updated.status === "running" || updated.status === "pending") {
      updated.status = "complete";
      updated.completedAt = Date.now();
    }

    delete updated.contentSnapshotAtStart;
    return updated;
  });

  return {
    id: `assistant_${runId}`,
    role: "assistant",
    content: finalContent,
    toolCalls: finalToolCalls.length ? finalToolCalls : undefined,
    timestamp: message?.timestamp ?? Date.now(),
  };
}
