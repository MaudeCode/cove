/**
 * Chat Events
 *
 * Handling streaming events from the gateway.
 */

import { on } from "@/lib/gateway";
import { log } from "@/lib/logger";
import { mergeDeltaText } from "@/lib/streaming";
import {
  activeRuns,
  startRun,
  updateRunContent,
  completeRun,
  errorRun,
  abortRun as abortRunSignal,
  isCompacting,
} from "@/signals/chat";
import type { Message, ToolCall } from "@/types/messages";
import type { ChatEvent, AgentEvent } from "@/types/chat";
import { parseMessageContent, mergeToolCalls } from "@/types/chat";
import { processNextQueuedMessage } from "./send";

let chatEventUnsubscribe: (() => void) | null = null;

/**
 * Subscribe to chat events from the gateway.
 */
export function subscribeToChatEvents(): () => void {
  if (chatEventUnsubscribe) {
    return chatEventUnsubscribe;
  }

  log.chat.info("Subscribing to chat events");

  chatEventUnsubscribe = on("chat", (payload) => {
    handleChatEvent(payload as ChatEvent);
  });

  on("agent", (payload) => {
    const evt = payload as AgentEvent;
    if (evt.stream === "tool") {
      handleToolEvent(evt);
    } else if (evt.stream === "lifecycle" && evt.data?.phase === "start") {
      handleLifecycleStart(evt);
    } else if (evt.stream === "compaction") {
      handleCompactionEvent(evt);
    }
  });

  return chatEventUnsubscribe;
}

/**
 * Unsubscribe from chat events.
 */
export function unsubscribeFromChatEvents(): void {
  if (chatEventUnsubscribe) {
    chatEventUnsubscribe();
    chatEventUnsubscribe = null;
  }
}

/**
 * Handle lifecycle start event - ensures run exists even before text deltas.
 */
function handleLifecycleStart(evt: AgentEvent): void {
  const { runId, sessionKey } = evt;
  const existingRun = activeRuns.value.get(runId);

  if (!existingRun && sessionKey) {
    log.chat.debug("Creating run on-the-fly for lifecycle start:", runId, "session:", sessionKey);
    startRun(runId, sessionKey);
  }
}

/**
 * Handle compaction events from the agent stream.
 */
function handleCompactionEvent(evt: AgentEvent): void {
  const phase = evt.data?.phase;
  log.chat.info("Compaction event:", phase);

  if (phase === "start") {
    isCompacting.value = true;
  } else if (phase === "end") {
    isCompacting.value = false;
  }
}

/**
 * Handle a tool event from the agent stream.
 */
function handleToolEvent(evt: AgentEvent): void {
  const { runId, sessionKey, data } = evt;
  if (!data) return;

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
      existingToolCalls[idx] = { ...existingToolCalls[idx], result: data.partialResult };
      updateRunContent(runId, run.content, existingToolCalls);
      break;
    }

    case "result": {
      const idx = findOrCreateToolCall();
      existingToolCalls[idx] = {
        ...existingToolCalls[idx],
        result: data.result,
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

  log.chat.debug("Delta event received", {
    runId,
    parsedTextLen: parsed.text.length,
    parsedTextPreview: parsed.text.slice(0, 100),
    parsedToolCallsCount: parsed.toolCalls.length,
    existingContentLen: existingRun.content.length,
    existingToolCallsCount: existingRun.toolCalls.length,
    lastBlockStart: existingRun.lastBlockStart,
  });

  // Merge tool calls
  const mergedToolCalls = mergeToolCalls(existingRun.toolCalls, parsed.toolCalls);

  // Merge text content using the streaming helper
  const { content, lastBlockStart } = mergeDeltaText(
    existingRun.content,
    parsed.text,
    existingRun.lastBlockStart,
  );

  log.chat.debug("Delta merged result", {
    runId,
    newContentLen: content.length,
    newLastBlockStart: lastBlockStart,
    contentPreview: content.slice(-100),
    mergedToolCallsCount: mergedToolCalls.length,
  });

  updateRunContent(runId, content, mergedToolCalls, lastBlockStart);
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

  // If no run exists, create one on-the-fly
  if (!existingRun && message) {
    log.chat.debug("Creating run on-the-fly for final:", runId, "session:", sessionKey);
    startRun(runId, sessionKey);
    existingRun = activeRuns.value.get(runId);
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
