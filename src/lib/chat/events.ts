/**
 * Chat Events
 *
 * Handling streaming events from the gateway.
 */

import { batch } from "@preact/signals";
import { on } from "@/lib/gateway";
import { log } from "@/lib/logger";
import { isChatEvent, isAgentEvent } from "@/lib/type-guards";
import { mergeDeltaText } from "@/lib/streaming";
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
} from "@/signals/chat";
import { isForActiveSession } from "@/signals/sessions";
import type { Message, ToolCall } from "@/types/messages";
import type { ChatEvent, AgentEvent } from "@/types/chat";
import { parseMessageContent, mergeToolCalls } from "@/types/chat";
import { isHeartbeatResponse, isNoReplyContent } from "@/lib/message-detection";
import { processNextQueuedMessage } from "./send";
import { loadHistory } from "./history";
import { extractToolResultContent } from "@/lib/tool-utils";

let chatEventUnsubscribe: (() => void) | null = null;
let agentEventUnsubscribe: (() => void) | null = null;

/** Track runIds that belong to compaction — lifecycle handlers should ignore these */
const compactionRunIds = new Set<string>();

/**
 * Subscribe to chat events from the gateway.
 */
export function subscribeToChatEvents(): () => void {
  if (chatEventUnsubscribe && agentEventUnsubscribe) {
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
  compactionRunIds.clear();
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

  if (!text) return;

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

  // Use mergeDeltaText to handle block boundaries correctly
  // It detects when text resets (new block) vs continues (same block)
  const { content: newContent, lastBlockStart: newLastBlockStart } = mergeDeltaText(
    run.content,
    text,
    run.lastBlockStart,
  );

  updateRunContent(runId, newContent, run.toolCalls, newLastBlockStart);
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
        status: "running",
        startedAt: Date.now(),
        insertedAtContentLength: run!.content.length,
        contentSnapshotAtStart: run!.content,
      });
      idx = existingToolCalls.length - 1;
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
      abortRunSignal(runId);
      break;

    case "error":
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
  const { runId, sessionKey, message } = event;
  if (!message) return;

  const parsed = parseMessageContent(message.content);
  let existingRun = activeRuns.value.get(runId);

  // If no run exists (e.g., page refreshed mid-stream), create one on-the-fly
  if (!existingRun) {
    log.chat.debug("Creating run on-the-fly for delta:", runId, "session:", sessionKey);
    startRun(runId, sessionKey);
    existingRun = activeRuns.value.get(runId);
    if (!existingRun) return;
  }

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

  // Check for heartbeat/no-reply responses - complete run immediately without adding message
  if (message?.content) {
    const parsed = parseMessageContent(message.content);
    if (
      parsed.text &&
      (isNoReplyContent(parsed.text) ||
        isHeartbeatResponse({ role: "assistant", content: parsed.text, id: "", timestamp: 0 }))
    ) {
      log.chat.debug("Heartbeat/no-reply detected, completing run without message:", runId);
      completeRun(runId);
      setTimeout(() => processNextQueuedMessage(sessionKey), 100);
      return;
    }
  }

  let finalContent = existingRun?.content ?? "";
  let finalParsedToolCalls: ToolCall[] = [];

  if (message?.content) {
    const parsed = parseMessageContent(message.content);

    log.chat.debug("Final message parsed", {
      runId,
      parsedTextLen: parsed.text.length,
      parsedToolCallsCount: parsed.toolCalls.length,
      existingContentLen: finalContent.length,
      willUseFinaContent: parsed.text.length >= finalContent.length,
    });

    if (parsed.text.length >= finalContent.length) {
      finalContent = parsed.text;
      finalParsedToolCalls = parsed.toolCalls;
    } else if (parsed.text) {
      log.chat.debug("Final merging partial text", {
        existingLen: finalContent.length,
        parsedLen: parsed.text.length,
      });
      const merged = mergeDeltaText(finalContent, parsed.text, existingRun?.lastBlockStart);
      finalContent = merged.content;
    }
  }

  log.chat.debug("Final content determined", {
    runId,
    finalContentLen: finalContent.length,
    finalContentPreview: finalContent.slice(-200),
  });

  // Build final tool calls list
  const finalToolCalls = existingRun?.toolCalls?.map((tc) => {
    const updated = { ...tc };

    if (updated.status === "running" || updated.status === "pending") {
      updated.status = "complete";
      updated.completedAt = Date.now();
    }

    const parsedTc = finalParsedToolCalls.find((p) => p.id === tc.id);
    if (parsedTc?.insertedAtContentLength !== undefined) {
      updated.insertedAtContentLength = parsedTc.insertedAtContentLength;
    }

    delete updated.contentSnapshotAtStart;
    return updated;
  });

  const finalMessage: Message = {
    id: `assistant_${runId}`,
    role: "assistant",
    content: finalContent,
    toolCalls: finalToolCalls?.length ? finalToolCalls : undefined,
    timestamp: message?.timestamp ?? Date.now(),
  };

  completeRun(runId, finalMessage);

  // Process next queued message after a short delay
  setTimeout(() => {
    processNextQueuedMessage(sessionKey);
  }, 100);
}
