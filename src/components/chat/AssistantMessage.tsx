/**
 * AssistantMessage
 *
 * Assistant message with avatar, name, and tool calls inline at their insertion points.
 * Supports images from content blocks or MEDIA: lines.
 */

import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import type { CommentaryItem, Message, ToolCall } from "@/types/messages";
import { MessageContent } from "./MessageContent";
import { MessageImages } from "./MessageImages";
import { MessageActions } from "./MessageActions";
import { ToolCallDetails, getToolCallSummary } from "./ToolCall";
import {
  getToolGroupKind,
  getToolGroupPhrase,
  getToolGroupPriority,
  getToolIconKindForToolCalls,
  getToolItemVerb,
  isFailedToolCall,
  isRunningToolCall,
  type ToolGroupKind,
} from "./tool-registry";
import { ThinkingBlock } from "./ThinkingBlock";
import { formatTimestamp, t } from "@/lib/i18n";
import { log } from "@/lib/logger";
import { isAvatarUrl } from "@/lib/utils";
import { parseMediaFromContent, mediaUrlsToImages } from "@/lib/media-parse";
import { dispatchChatContentToggle } from "@/lib/chat-scroll";
import { HistoryTruncationIndicator } from "./HistoryTruncationIndicator";
import { ThinkingStatus } from "./ThinkingStatus";
import { ChevronDownIcon } from "@/components/ui/icons";
import { TextShimmer } from "../ui/TextShimmer";
import { Brain, ChevronRight, Pencil, Search, SquareTerminal, Wrench } from "lucide-preact";

interface AssistantMessageProps {
  message: Message;
  assistantName?: string;
  assistantAvatar?: string;
  isStreaming?: boolean;
}

const TOOL_HEADER_THINKING_DELAY_MS = 2_000;

type ToolSummaryState = "complete" | "error" | "pending" | "running";
type ToolLiveMatcher = boolean | ((toolCall: ToolCall) => boolean);
type TextBlock = { type: "text"; content: string };
type SingleToolBlock = { type: "tool"; toolCall: ToolCall };
type ToolGroupBlock = { type: "tool-group"; toolCalls: ToolCall[] };
type CommentaryGroupBlock = { type: "commentary-group"; items: CommentaryItem[] };

/** A content block - either text or consecutive tool calls */
type ContentBlock = TextBlock | ToolGroupBlock | CommentaryGroupBlock;

/**
 * Split content into blocks interleaved with tool calls at their insertion points.
 */
function buildContentBlocks(content: string, toolCalls: ToolCall[]): ContentBlock[] {
  if (!toolCalls || toolCalls.length === 0) {
    return content ? [{ type: "text", content }] : [];
  }

  log.chat.debug("buildContentBlocks called", {
    contentLen: content.length,
    contentPreview: content.slice(0, 100),
    contentEnd: content.slice(-100),
    toolCallsCount: toolCalls.length,
    toolCallPositions: toolCalls.map((tc) => ({
      id: tc.id.slice(-8),
      name: tc.name,
      insertedAt: tc.insertedAtContentLength,
    })),
  });

  // Sort tool calls by their insertion position
  const sortedTools = [...toolCalls].sort((a, b) => {
    const posA = a.insertedAtContentLength ?? Infinity;
    const posB = b.insertedAtContentLength ?? Infinity;
    return posA - posB;
  });

  const blocks: Array<TextBlock | SingleToolBlock> = [];
  let currentPos = 0;

  for (const tool of sortedTools) {
    const insertPos = tool.insertedAtContentLength;

    // If no insertion position, tool goes at end
    if (insertPos === undefined || insertPos === Infinity) {
      continue; // Will add at end
    }

    // Add text before this tool call
    if (insertPos > currentPos) {
      const textBefore = content.slice(currentPos, insertPos);
      if (textBefore.trim()) {
        blocks.push({ type: "text", content: textBefore });
        log.chat.debug("buildContentBlocks: added text block", {
          from: currentPos,
          to: insertPos,
          textLen: textBefore.length,
        });
      }
    }

    // Add the tool call
    blocks.push({ type: "tool", toolCall: tool });
    currentPos = insertPos;
  }

  // Add remaining text after all tool calls
  if (currentPos < content.length) {
    const remainingText = content.slice(currentPos);
    log.chat.debug("buildContentBlocks: checking remaining text", {
      currentPos,
      contentLen: content.length,
      remainingLen: remainingText.length,
      remainingTrimmedLen: remainingText.trim().length,
      remainingPreview: remainingText.slice(0, 100),
    });
    if (remainingText.trim()) {
      blocks.push({ type: "text", content: remainingText });
      log.chat.debug("buildContentBlocks: added remaining text block");
    }
  }

  // Add any tool calls without insertion positions at the end
  for (const tool of sortedTools) {
    if (tool.insertedAtContentLength === undefined) {
      blocks.push({ type: "tool", toolCall: tool });
    }
  }

  const groupedBlocks = groupConsecutiveToolCalls(blocks);

  log.chat.debug("buildContentBlocks result", {
    totalBlocks: groupedBlocks.length,
    blockTypes: groupedBlocks.map((b) => b.type),
  });

  return groupedBlocks;
}

function groupConsecutiveToolCalls(blocks: Array<TextBlock | SingleToolBlock>): ContentBlock[] {
  const grouped: ContentBlock[] = [];
  let pendingTools: ToolCall[] = [];

  const flushTools = () => {
    if (pendingTools.length > 0) {
      grouped.push({ type: "tool-group", toolCalls: pendingTools });
    }
    pendingTools = [];
  };

  for (const block of blocks) {
    if (block.type === "tool") {
      pendingTools.push(block.toolCall);
      continue;
    }

    flushTools();
    grouped.push(block);
  }

  flushTools();
  return grouped;
}

function buildActivityContentBlocks(
  content: string,
  toolCalls: ToolCall[],
  commentaryItems: CommentaryItem[],
): ContentBlock[] {
  const activityItems = [
    ...commentaryItems.map((item, index) => ({
      type: "commentary" as const,
      item,
      seq: item.seq,
      fallbackOrder: index * 2,
    })),
    ...toolCalls.map((toolCall, index) => ({
      type: "tool" as const,
      toolCall,
      seq: toolCall.seq,
      fallbackOrder: index * 2 + 1,
    })),
  ].sort((a, b) => {
    if (a.seq != null && b.seq != null && a.seq !== b.seq) return a.seq - b.seq;
    return a.fallbackOrder - b.fallbackOrder;
  });

  const blocks: ContentBlock[] = [];

  for (const item of activityItems) {
    const previous = blocks[blocks.length - 1];

    if (item.type === "commentary") {
      if (previous?.type === "commentary-group") {
        previous.items.push(item.item);
      } else {
        blocks.push({ type: "commentary-group", items: [item.item] });
      }
      continue;
    }

    if (previous?.type === "tool-group") {
      previous.toolCalls.push(item.toolCall);
    } else {
      blocks.push({ type: "tool-group", toolCalls: [item.toolCall] });
    }
  }

  if (content) {
    blocks.push({ type: "text", content });
  }

  return blocks;
}

export function AssistantMessage({
  message,
  assistantName = "Assistant",
  assistantAvatar,
  isStreaming = false,
}: AssistantMessageProps) {
  const isHovered = useSignal(false);

  // Parse MEDIA: lines from content
  const parsedMedia = parseMediaFromContent(message.content);
  const mediaImages = mediaUrlsToImages(parsedMedia.mediaUrls);

  // Combine images from message.images (content blocks) and parsed MEDIA: lines
  const allImages = [...(message.images ?? []), ...mediaImages];

  const toolCalls = message.toolCalls ?? [];
  const commentaryItems = message.commentaryItems ?? [];
  const hasCompletedRunActivity = !isStreaming && commentaryItems.length > 0;
  const hasLiveRunProgress = isStreaming && commentaryItems.length > 0;
  const hasRunActivity = hasCompletedRunActivity || hasLiveRunProgress;
  const activityBlocks = hasRunActivity
    ? buildActivityContentBlocks("", toolCalls, commentaryItems)
    : [];

  // Build content blocks using cleaned text (MEDIA: lines removed)
  const blocks = hasRunActivity
    ? parsedMedia.text
      ? [{ type: "text" as const, content: parsedMedia.text }]
      : []
    : buildContentBlocks(parsedMedia.text, toolCalls);
  const hasContent =
    blocks.length > 0 ||
    activityBlocks.length > 0 ||
    allImages.length > 0 ||
    !!message.thinking ||
    !!message.commentaryItems?.length;
  const streamingToolGroupKey = isStreaming ? getStreamingToolGroupKey(blocks) : null;

  // Debug: log every render to track reactivity issues
  log.chat.debug("AssistantMessage render", {
    messageId: message.id,
    contentLen: message.content.length,
    toolCallsCount: message.toolCalls?.length ?? 0,
    blocksCount: blocks.length,
    imagesCount: allImages.length,
    localPaths: parsedMedia.localPaths,
    isStreaming,
  });

  return (
    <div
      class="group"
      onMouseEnter={() => (isHovered.value = true)}
      onMouseLeave={() => (isHovered.value = false)}
    >
      {/* Header: Avatar + Name + Timestamp + Actions */}
      <div class="flex items-center gap-2 mb-1.5">
        {/* Avatar */}
        {isAvatarUrl(assistantAvatar) ? (
          <img
            src={assistantAvatar}
            alt={assistantName || "Assistant"}
            class="w-6 h-6 rounded-full object-cover"
          />
        ) : (
          <div class="w-6 h-6 rounded-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] flex items-center justify-center text-sm">
            {assistantAvatar || "🤖"}
          </div>
        )}

        {/* Name */}
        <span class="text-sm font-medium text-[var(--color-text-primary)]">{assistantName}</span>

        {/* Timestamp (hide while streaming) */}
        {!isStreaming && message.timestamp && (
          <span class="text-xs text-[var(--color-text-muted)]">
            {formatTimestamp(message.timestamp)}
          </span>
        )}

        {/* History truncation marker */}
        {!isStreaming && message.historyTruncated && (
          <HistoryTruncationIndicator reason={message.historyTruncationReason} />
        )}

        {/* Spacer */}
        <div class="flex-1" />

        {/* Actions menu */}
        {!isStreaming && message.content && (
          <MessageActions content={message.content} visible={isHovered.value} />
        )}
      </div>

      {/* Message Content - interleaved blocks */}
      <div class="space-y-3">
        {/* Thinking/reasoning block (collapsible) */}
        {message.thinking && <ThinkingBlock content={message.thinking} />}

        {hasCompletedRunActivity && <RunActivityBlock message={message} blocks={activityBlocks} />}
        {hasLiveRunProgress && <RunLiveActivityBlock blocks={activityBlocks} />}

        {blocks.map((block, idx) => {
          log.chat.debug("Rendering block", {
            idx,
            type: block.type,
            contentLen: block.type === "text" ? block.content.length : undefined,
          });

          if (block.type === "commentary-group") {
            return (
              <RunProgressBlock
                key={`commentary-${block.items.map((item) => item.id).join("-")}`}
                items={block.items}
              />
            );
          }

          if (block.type === "text") {
            return (
              <div
                key={`text-${idx}`}
                class="prose prose-sm max-w-none text-[var(--color-text-primary)]"
              >
                <MessageContent content={block.content} isStreaming={false} />
              </div>
            );
          }

          const blockKey = getToolBlockKey(block);
          return (
            <ToolCallGroup
              key={blockKey}
              toolCalls={block.toolCalls}
              isStreaming={blockKey === streamingToolGroupKey}
            />
          );
        })}

        {/* Images from content blocks or MEDIA: lines */}
        {allImages.length > 0 && <MessageImages images={allImages} />}

        {/* Note about local files that couldn't be displayed */}
        {parsedMedia.localPaths.length > 0 && (
          <div class="text-xs text-[var(--color-text-muted)] italic">
            {parsedMedia.localPaths.length === 1
              ? `📎 File: ${parsedMedia.localPaths[0]}`
              : `📎 ${parsedMedia.localPaths.length} files attached`}
          </div>
        )}

        {/* Empty state with streaming indicator */}
        {!hasContent && isStreaming && <ThinkingStatus />}
      </div>
    </div>
  );
}

function RunLiveActivityBlock({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div class="min-w-0 space-y-3">
      {blocks.map((block) => {
        if (block.type === "commentary-group") {
          return (
            <RunProgressBlock
              key={`live-commentary-${block.items.map((item) => item.id).join("-")}`}
              items={block.items}
            />
          );
        }

        if (block.type === "tool-group") {
          return (
            <ToolCallGroup
              key={getToolBlockKey(block)}
              toolCalls={block.toolCalls}
              isStreaming={hasLiveToolCall(block.toolCalls)}
            />
          );
        }

        return null;
      })}
    </div>
  );
}

function hasLiveToolCall(toolCalls: ToolCall[]): boolean {
  return toolCalls.some((toolCall) => isRunningToolCall(toolCall, true));
}

function RunProgressBlock({ items }: { items: CommentaryItem[] }) {
  return (
    <output
      aria-live="polite"
      aria-label={t("chat.runProgress")}
      class="block min-w-0 max-w-full space-y-1 text-sm text-[var(--color-text-muted)]"
    >
      {items.map((item) => (
        <span key={item.id} class="block truncate">
          {item.text}
        </span>
      ))}
    </output>
  );
}

function RunActivityBlock({ message, blocks }: { message: Message; blocks: ContentBlock[] }) {
  const expanded = useSignal(false);
  const label = getRunActivityLabel(message);

  return (
    <section
      class="min-w-0 border-b border-[var(--color-border)] pb-3 text-[var(--color-text-muted)]"
      aria-label={t("chat.runActivity")}
    >
      <button
        type="button"
        class="group flex w-full min-w-0 items-center gap-2 text-left text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
        aria-expanded={expanded.value}
        onClick={(event) => {
          dispatchChatContentToggle(event.currentTarget);
          expanded.value = !expanded.value;
        }}
      >
        <span class="truncate">{label}</span>
        {expanded.value ? (
          <ChevronDownIcon
            class="w-4 h-4 flex-shrink-0 text-[var(--color-text-muted)]"
            open={expanded.value}
          />
        ) : (
          <ChevronRight
            class="w-4 h-4 flex-shrink-0 text-[var(--color-text-muted)]"
            aria-hidden="true"
          />
        )}
      </button>

      {expanded.value && (
        <div class="mt-4 min-w-0 space-y-4">
          {blocks.map((block) => {
            if (block.type === "commentary-group") {
              return (
                <RunCommentaryActivityBlock
                  key={`run-commentary-${block.items.map((item) => item.id).join("-")}`}
                  items={block.items}
                />
              );
            }

            if (block.type === "tool-group") {
              return (
                <ToolCallGroup
                  key={getToolBlockKey(block)}
                  toolCalls={block.toolCalls}
                  isStreaming={false}
                />
              );
            }

            return null;
          })}
        </div>
      )}
    </section>
  );
}

function RunCommentaryActivityBlock({ items }: { items: CommentaryItem[] }) {
  return (
    <div class="min-w-0 space-y-2 text-[var(--color-text-secondary)]">
      {items.map((item) => (
        <p key={item.id} class="m-0 whitespace-pre-wrap break-words text-sm">
          {item.text}
        </p>
      ))}
    </div>
  );
}

function getRunActivityLabel(message: Message): string {
  const startedAt = message.runStartedAt;
  const completedAt = message.runCompletedAt ?? message.timestamp;

  if (startedAt != null && completedAt >= startedAt) {
    return t("chat.runActivityWorkedFor", {
      duration: formatRunActivityDuration(completedAt - startedAt),
    });
  }

  return t("chat.runActivity");
}

function formatRunActivityDuration(ms: number): string {
  if (ms < 1000) return "<1s";

  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${secs}s`;
}

function getToolBlockKey(block: ToolGroupBlock): string {
  const firstToolCall = block.toolCalls[0];
  return `tool-block-${firstToolCall?.id ?? "empty"}`;
}

function getStreamingToolGroupKey(blocks: ContentBlock[]): string | null {
  let lastToolGroup: ToolGroupBlock | null = null;
  let activeToolGroup: ToolGroupBlock | null = null;

  for (const block of blocks) {
    if (block.type !== "tool-group") continue;
    lastToolGroup = block;
    if (block.toolCalls.some((toolCall) => isRunningToolCall(toolCall, true))) {
      activeToolGroup = block;
    }
  }

  const streamingGroup = activeToolGroup ?? lastToolGroup;
  return streamingGroup ? getToolBlockKey(streamingGroup) : null;
}

function ToolCallGroup({
  toolCalls,
  isStreaming,
}: {
  toolCalls: ToolCall[];
  isStreaming: boolean;
}) {
  const hasApprovalPendingToolCall = toolCalls.some(isApprovalPendingToolCall);
  const expanded = useSignal(hasApprovalPendingToolCall);
  const lingeredToolCallIds = useSignal<string[]>([]);
  const thinkingDelayElapsed = useSignal(true);
  const previousActiveToolCallIds = useRef<string[]>([]);
  const thinkingDelayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toolStatusKey = getToolStatusKey(toolCalls);
  useEffect(() => {
    if (hasApprovalPendingToolCall && !expanded.value) {
      expanded.value = true;
    }
  }, [hasApprovalPendingToolCall]);

  useEffect(() => {
    const clearThinkingDelayTimer = () => {
      if (thinkingDelayTimer.current) {
        clearTimeout(thinkingDelayTimer.current);
        thinkingDelayTimer.current = null;
      }
    };

    if (!isStreaming) {
      clearThinkingDelayTimer();
      lingeredToolCallIds.value = [];
      previousActiveToolCallIds.current = [];
      thinkingDelayElapsed.value = true;
      return clearThinkingDelayTimer;
    }

    const activeToolCalls = toolCalls.filter((toolCall) => isRunningToolCall(toolCall, true));
    if (activeToolCalls.length > 0) {
      clearThinkingDelayTimer();
      lingeredToolCallIds.value = [];
      previousActiveToolCallIds.current = activeToolCalls.map((toolCall) => toolCall.id);
      thinkingDelayElapsed.value = false;
      return clearThinkingDelayTimer;
    }

    const recentlyCompletedToolCallIds = previousActiveToolCallIds.current.filter((toolCallId) =>
      toolCalls.some(
        (toolCall) => toolCall.id === toolCallId && !isRunningToolCall(toolCall, true),
      ),
    );
    if (recentlyCompletedToolCallIds.length > 0) {
      clearThinkingDelayTimer();
      lingeredToolCallIds.value = recentlyCompletedToolCallIds;
      previousActiveToolCallIds.current = [];
      thinkingDelayElapsed.value = false;
      thinkingDelayTimer.current = setTimeout(() => {
        lingeredToolCallIds.value = [];
        thinkingDelayElapsed.value = true;
        thinkingDelayTimer.current = null;
      }, TOOL_HEADER_THINKING_DELAY_MS);
      return clearThinkingDelayTimer;
    }

    if (lingeredToolCallIds.value.length === 0) {
      thinkingDelayElapsed.value = true;
    }

    return clearThinkingDelayTimer;
  }, [isStreaming, toolStatusKey]);
  const liveState = {
    lingeredToolCallIds: lingeredToolCallIds.value,
    previousActiveToolCallIds: previousActiveToolCallIds.current,
    thinkingDelayElapsed: thinkingDelayElapsed.value,
  };
  const summary = getToolCallGroupHeaderLabel(toolCalls, isStreaming, liveState);
  const iconKind = getToolCallGroupIconKind(toolCalls, isStreaming, liveState);
  const running = isStreaming;
  const shimmerStyle = running
    ? `--tool-call-shimmer-duration: ${getToolCallShimmerDuration(summary)}`
    : undefined;

  return (
    <section
      class="min-w-0 space-y-2 text-[var(--color-text-muted)]"
      aria-label={`Tool calls: ${summary}`}
      data-tool-call-group
    >
      <button
        type="button"
        class="group flex w-full min-w-0 items-center gap-2 text-left text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
        aria-expanded={expanded.value}
        onClick={(event) => {
          dispatchChatContentToggle(event.currentTarget);
          expanded.value = !expanded.value;
        }}
      >
        {iconKind === "thinking" ? (
          <Brain class="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        ) : iconKind === "search" ? (
          <Search class="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        ) : iconKind === "edit" ? (
          <Pencil class="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        ) : iconKind === "custom" ? (
          <Wrench class="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        ) : (
          <SquareTerminal class="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        )}
        {running ? (
          <TextShimmer class="truncate" style={shimmerStyle} text={summary} />
        ) : (
          <span class="truncate">{summary}</span>
        )}
        {expanded.value ? (
          <ChevronDownIcon
            class="w-4 h-4 flex-shrink-0 text-[var(--color-text-muted)]"
            open={expanded.value}
          />
        ) : (
          <ChevronRight
            class="w-4 h-4 flex-shrink-0 text-[var(--color-text-muted)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            aria-hidden="true"
          />
        )}
      </button>

      {expanded.value && (
        <div class="min-w-0 space-y-2 pl-6" data-tool-call-group-items>
          {toolCalls.map((toolCall) => (
            <ToolCallGroupItem
              key={toolCall.id}
              live={isStreaming || isApprovalPendingToolCall(toolCall)}
              toolCall={toolCall}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ToolCallGroupItem({ live, toolCall }: { live: boolean; toolCall: ToolCall }) {
  const approvalPending = isApprovalPendingToolCall(toolCall);
  const expanded = useSignal(approvalPending);
  const itemLabel = getToolGroupItemLabel(toolCall, live);
  const detailsId = `tool-details-${toolCall.id}`;
  useEffect(() => {
    if (approvalPending && !expanded.value) {
      expanded.value = true;
    }
  }, [approvalPending, toolCall.id]);

  return (
    <div class="min-w-0" data-tool-call-group-item={toolCall.name}>
      <button
        type="button"
        class="group flex w-full min-w-0 items-center gap-2 text-left text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
        aria-expanded={expanded.value}
        aria-controls={detailsId}
        onClick={(event) => {
          dispatchChatContentToggle(event.currentTarget);
          expanded.value = !expanded.value;
        }}
      >
        <span class="truncate">{itemLabel}</span>
        {expanded.value ? (
          <ChevronDownIcon
            class="w-4 h-4 flex-shrink-0 text-[var(--color-text-muted)]"
            open={expanded.value}
          />
        ) : (
          <ChevronRight
            class="w-4 h-4 flex-shrink-0 text-[var(--color-text-muted)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            aria-hidden="true"
          />
        )}
      </button>

      {expanded.value && (
        <div
          id={detailsId}
          class="mt-2 mb-3 min-w-0 overflow-hidden rounded-md bg-[var(--color-bg-secondary)] p-3 space-y-3"
        >
          <ToolCallDetails toolCall={toolCall} />
        </div>
      )}
    </div>
  );
}

function getToolCallGroupHeaderLabel(
  toolCalls: ToolCall[],
  isStreaming: boolean,
  liveState?: {
    lingeredToolCallIds: string[];
    previousActiveToolCallIds: string[];
    thinkingDelayElapsed: boolean;
  },
): string {
  if (!isStreaming) {
    return summarizeToolGroup(toolCalls, isApprovalPendingToolCall);
  }

  const runningToolCalls = toolCalls.filter((toolCall) => isRunningToolCall(toolCall, true));
  if (runningToolCalls.length === 0) {
    const lingeringToolCalls = toolCalls.filter((toolCall) =>
      liveState?.lingeredToolCallIds.includes(toolCall.id),
    );
    if (lingeringToolCalls.length > 0 && liveState?.thinkingDelayElapsed === false) {
      return summarizeToolGroup(lingeringToolCalls, false);
    }

    const recentlyActiveToolCalls = toolCalls.filter((toolCall) =>
      liveState?.previousActiveToolCallIds.includes(toolCall.id),
    );
    if (recentlyActiveToolCalls.length > 0 && liveState?.thinkingDelayElapsed === false) {
      return summarizeToolGroup(recentlyActiveToolCalls, false);
    }

    return "Thinking...";
  }

  return summarizeToolGroup(runningToolCalls, true);
}

function getToolCallGroupIconKind(
  toolCalls: ToolCall[],
  isStreaming: boolean,
  liveState?: {
    lingeredToolCallIds: string[];
    previousActiveToolCallIds: string[];
    thinkingDelayElapsed: boolean;
  },
): "custom" | "default" | "edit" | "search" | "thinking" {
  if (isToolCallGroupThinking(toolCalls, isStreaming, liveState)) {
    return "thinking";
  }

  const visibleToolCalls = getToolCallGroupHeaderToolCalls(toolCalls, isStreaming, liveState);
  return getToolIconKindForToolCalls(visibleToolCalls);
}

function isToolCallGroupThinking(
  toolCalls: ToolCall[],
  isStreaming: boolean,
  liveState?: {
    lingeredToolCallIds: string[];
    previousActiveToolCallIds: string[];
    thinkingDelayElapsed: boolean;
  },
): boolean {
  if (!isStreaming) return false;
  if (toolCalls.some((toolCall) => isRunningToolCall(toolCall, true))) return false;
  if (liveState?.thinkingDelayElapsed === false) {
    const lingeringToolCallIds = new Set([
      ...(liveState.lingeredToolCallIds ?? []),
      ...(liveState.previousActiveToolCallIds ?? []),
    ]);
    return !toolCalls.some((toolCall) => lingeringToolCallIds.has(toolCall.id));
  }
  return true;
}

function getToolCallGroupHeaderToolCalls(
  toolCalls: ToolCall[],
  isStreaming: boolean,
  liveState?: {
    lingeredToolCallIds: string[];
    previousActiveToolCallIds: string[];
    thinkingDelayElapsed: boolean;
  },
): ToolCall[] {
  if (!isStreaming) {
    return toolCalls;
  }

  const runningToolCalls = toolCalls.filter((toolCall) => isRunningToolCall(toolCall, true));
  if (runningToolCalls.length > 0) {
    return runningToolCalls;
  }

  const lingeringToolCalls = toolCalls.filter((toolCall) =>
    liveState?.lingeredToolCallIds.includes(toolCall.id),
  );
  if (lingeringToolCalls.length > 0 && liveState?.thinkingDelayElapsed === false) {
    return lingeringToolCalls;
  }

  const recentlyActiveToolCalls = toolCalls.filter((toolCall) =>
    liveState?.previousActiveToolCallIds.includes(toolCall.id),
  );
  if (recentlyActiveToolCalls.length > 0 && liveState?.thinkingDelayElapsed === false) {
    return recentlyActiveToolCalls;
  }

  return toolCalls;
}

function summarizeToolGroup(toolCalls: ToolCall[], live: ToolLiveMatcher = false): string {
  if (toolCalls.length === 1) {
    return getToolGroupItemLabel(toolCalls[0], isToolCallLive(toolCalls[0], live));
  }

  const groups = new Map<string, { count: number; kind: ToolGroupKind; state: ToolSummaryState }>();
  for (const toolCall of toolCalls) {
    const kind = getToolGroupKind(toolCall);
    const state = getToolSummaryState(toolCall, isToolCallLive(toolCall, live));
    const key = `${kind}:${state}`;
    const current = groups.get(key) ?? { count: 0, kind, state };
    groups.set(key, {
      count: current.count + 1,
      kind,
      state,
    });
  }

  const entries = Array.from(groups.entries())
    .map(([, group]) => group)
    .sort((left, right) => {
      const stateDelta =
        getToolSummaryStatePriority(left.state) - getToolSummaryStatePriority(right.state);
      if (stateDelta !== 0) return stateDelta;
      return getToolGroupPriority(left.kind) - getToolGroupPriority(right.kind);
    });
  const parts = collapseNoisyToolSummary(entries);

  return parts.map((part, index) => (index === 0 ? capitalize(part) : part)).join(", ");
}

function collapseNoisyToolSummary(
  entries: Array<{ count: number; kind: ToolGroupKind; state: ToolSummaryState }>,
): string[] {
  if (entries.length <= 3) {
    return entries.map(({ kind, count, state }) =>
      getToolGroupPhrase(kind, count, state === "running", state === "error", state === "pending"),
    );
  }

  const visibleCount = 2;
  const hiddenToolCount = entries
    .slice(visibleCount)
    .reduce((total, { count }) => total + count, 0);

  return [
    ...entries
      .slice(0, visibleCount)
      .map(({ kind, count, state }) =>
        getToolGroupPhrase(
          kind,
          count,
          state === "running",
          state === "error",
          state === "pending",
        ),
      ),
    `used ${hiddenToolCount} other tools`,
  ];
}

function getToolGroupItemLabel(toolCall: ToolCall, live = false): string {
  const summary = getToolCallSummary(toolCall);
  const kind = getToolGroupKind(toolCall);
  const preview = summary.fullPreview ?? summary.preview;
  const verb = getToolItemVerb(toolCall, live);

  if (kind === "read") {
    return `${verb} ${formatToolTarget(preview) ?? "file"}`;
  }
  if (kind === "write") {
    return `${verb} ${formatToolTarget(preview) ?? "file"}`;
  }
  if (kind === "edit") {
    return `${verb} ${formatToolTarget(preview) ?? "file"}`;
  }
  if (kind === "exec") {
    return `${verb} ${preview || "command"}`;
  }
  if (kind === "search") {
    return `${verb} ${preview || ""}`.trim();
  }
  if (kind === "fetch") {
    return `${verb} ${preview || "page"}`;
  }

  const action = kind.startsWith("custom:") ? verb : summary.label;
  return preview ? `${action} ${preview}` : action;
}

function formatToolTarget(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const clean = value.replace(/^…\//, "");
  const withoutRange = clean.replace(/:\d+(?:-\d+|\+)?$/u, "");
  return withoutRange.split("/").filter(Boolean).at(-1) ?? withoutRange;
}

function capitalize(value: string): string {
  return value.replace(/^./, (char) => char.toUpperCase());
}

function getToolSummaryState(toolCall: ToolCall, live: boolean): ToolSummaryState {
  if (isFailedToolCall(toolCall)) return "error";
  if (isRunningToolCall(toolCall, live)) return "running";
  if (toolCall.status === "pending") return "pending";
  return "complete";
}

function isToolCallLive(toolCall: ToolCall, live: ToolLiveMatcher): boolean {
  return typeof live === "function" ? live(toolCall) : live;
}

function getToolSummaryStatePriority(state: ToolSummaryState): number {
  if (state === "error") return 0;
  if (state === "running") return 1;
  if (state === "pending") return 2;
  return 3;
}

function isApprovalPendingToolCall(toolCall: ToolCall): boolean {
  if (!toolCall.result || typeof toolCall.result !== "object") return false;
  const result = toolCall.result as Record<string, unknown>;
  if (!result.details || typeof result.details !== "object") return false;
  const details = result.details as Record<string, unknown>;
  return details.status === "approval-pending" && typeof details.approvalId === "string";
}

function getToolStatusKey(toolCalls: ToolCall[]): string {
  return toolCalls
    .map((toolCall) =>
      [
        toolCall.id,
        toolCall.status,
        isApprovalPendingToolCall(toolCall) ? "approval-pending" : "",
      ].join(":"),
    )
    .join("|");
}

function getToolCallShimmerDuration(text: string): string {
  const seconds = Math.min(4.8, Math.max(1.8, 1.6 + text.length * 0.025));
  return `${seconds.toFixed(2)}s`;
}
