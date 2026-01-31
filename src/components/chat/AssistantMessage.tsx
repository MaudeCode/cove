/**
 * AssistantMessage
 *
 * Assistant message with avatar, name, and tool calls inline at their insertion points.
 */

import type { Message, ToolCall } from "@/types/messages";
import { MessageContent } from "./MessageContent";
import { ToolCall as ToolCallComponent } from "./ToolCall";
import { BouncingDots } from "@/components/ui";
import { formatRelativeTime, t } from "@/lib/i18n";
import { log } from "@/lib/logger";

interface AssistantMessageProps {
  message: Message;
  assistantName?: string;
  assistantAvatar?: string;
  isStreaming?: boolean;
}

/** A content block - either text or a tool call */
type ContentBlock = { type: "text"; content: string } | { type: "tool"; toolCall: ToolCall };

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
  // Treat insertedAt:0 as "unknown" if there's content - this happens when tool events
  // arrive before text deltas (race condition after page refresh or reconnection)
  const getEffectivePosition = (tc: ToolCall): number => {
    const pos = tc.insertedAtContentLength;
    if (pos === undefined) return Infinity;
    // If tool claims position 0 but there's content, it's likely a race condition
    // Put it at the end instead of breaking the text flow
    if (pos === 0 && content.length > 0) return Infinity;
    return pos;
  };

  const sortedTools = [...toolCalls].sort((a, b) => {
    return getEffectivePosition(a) - getEffectivePosition(b);
  });

  const blocks: ContentBlock[] = [];
  let currentPos = 0;

  for (const tool of sortedTools) {
    const insertPos = getEffectivePosition(tool);

    // If no insertion position (or corrected to end), tool goes at end
    if (insertPos === Infinity) {
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

  // Add any tool calls without valid insertion positions at the end
  // (includes undefined positions and position:0 with existing content)
  for (const tool of sortedTools) {
    if (getEffectivePosition(tool) === Infinity) {
      blocks.push({ type: "tool", toolCall: tool });
    }
  }

  log.chat.debug("buildContentBlocks result", {
    totalBlocks: blocks.length,
    blockTypes: blocks.map((b) => b.type),
  });

  return blocks;
}

export function AssistantMessage({
  message,
  assistantName = "Assistant",
  assistantAvatar,
  isStreaming = false,
}: AssistantMessageProps) {
  const blocks = buildContentBlocks(message.content, message.toolCalls ?? []);
  const hasContent = blocks.length > 0 || isStreaming;

  // Debug: log every render to track reactivity issues
  log.chat.debug("AssistantMessage render", {
    messageId: message.id,
    contentLen: message.content.length,
    toolCallsCount: message.toolCalls?.length ?? 0,
    blocksCount: blocks.length,
    isStreaming,
  });

  return (
    <div class="group">
      {/* Header: Avatar + Name + Timestamp */}
      <div class="flex items-center gap-2 mb-1.5">
        {/* Avatar */}
        <div class="w-6 h-6 rounded-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] flex items-center justify-center text-sm">
          {assistantAvatar || "🤖"}
        </div>

        {/* Name */}
        <span class="text-sm font-medium text-[var(--color-text-primary)]">{assistantName}</span>

        {/* Timestamp (hide while streaming) */}
        {!isStreaming && message.timestamp && (
          <span class="text-xs text-[var(--color-text-muted)]">
            {formatRelativeTime(new Date(message.timestamp))}
          </span>
        )}
      </div>

      {/* Message Content - interleaved blocks */}
      <div class="space-y-3">
        {blocks.map((block, idx) => {
          log.chat.debug("Rendering block", {
            idx,
            type: block.type,
            contentLen: block.type === "text" ? block.content.length : undefined,
            toolName: block.type === "tool" ? block.toolCall.name : undefined,
          });
          return block.type === "text" ? (
            <div
              key={`text-${idx}`}
              class="prose prose-sm max-w-none text-[var(--color-text-primary)]"
            >
              <MessageContent content={block.content} isStreaming={false} />
            </div>
          ) : (
            <div key={block.toolCall.id}>
              <ToolCallComponent toolCall={block.toolCall} />
            </div>
          );
        })}

        {/* Show streaming indicator after all content */}
        {isStreaming && (
          <span class="ml-1">
            <BouncingDots />
          </span>
        )}

        {/* Empty state with streaming indicator */}
        {!hasContent && isStreaming && (
          <span class="inline-flex items-center gap-2 text-[var(--color-text-muted)]">
            {t("chat.thinking")}
            <BouncingDots />
          </span>
        )}
      </div>
    </div>
  );
}
