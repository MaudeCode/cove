/**
 * AssistantMessage
 *
 * Assistant message with avatar, name, and tool calls inline at their insertion points.
 */

import type { Message, ToolCall } from "@/types/messages";
import { MessageContent } from "./MessageContent";
import { ToolCall as ToolCallComponent } from "./ToolCall";
import { formatRelativeTime } from "@/lib/i18n";

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

  // Sort tool calls by their insertion position
  const sortedTools = [...toolCalls].sort((a, b) => {
    const posA = a.insertedAtContentLength ?? Infinity;
    const posB = b.insertedAtContentLength ?? Infinity;
    return posA - posB;
  });

  const blocks: ContentBlock[] = [];
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
      }
    }

    // Add the tool call
    blocks.push({ type: "tool", toolCall: tool });
    currentPos = insertPos;
  }

  // Add remaining text after all tool calls
  if (currentPos < content.length) {
    const remainingText = content.slice(currentPos);
    if (remainingText.trim()) {
      blocks.push({ type: "text", content: remainingText });
    }
  }

  // Add any tool calls without insertion positions at the end
  for (const tool of sortedTools) {
    if (tool.insertedAtContentLength === undefined) {
      blocks.push({ type: "tool", toolCall: tool });
    }
  }

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

        {/* Timestamp */}
        {!isStreaming && message.timestamp && (
          <span class="text-xs text-[var(--color-text-muted)]">
            {formatRelativeTime(new Date(message.timestamp))}
          </span>
        )}

        {/* Streaming indicator */}
        {isStreaming && (
          <span class="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
            <StreamingDots />
          </span>
        )}
      </div>

      {/* Message Content - interleaved blocks */}
      <div class="space-y-3">
        {blocks.map((block, idx) =>
          block.type === "text" ? (
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
          ),
        )}

        {/* Show streaming indicator after all content */}
        {isStreaming && (
          <span class="inline-flex items-end gap-1 ml-1">
            <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-bounce-dot" />
            <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-bounce-dot [animation-delay:200ms]" />
            <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-bounce-dot [animation-delay:400ms]" />
          </span>
        )}

        {/* Empty state with streaming indicator */}
        {!hasContent && isStreaming && (
          <span class="inline-flex items-center gap-2 text-[var(--color-text-muted)]">
            Thinking
            <span class="inline-flex items-end gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-bounce-dot" />
              <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-bounce-dot [animation-delay:200ms]" />
              <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-bounce-dot [animation-delay:400ms]" />
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

function StreamingDots() {
  return (
    <span class="inline-flex items-end gap-1">
      <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-bounce-dot" />
      <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-bounce-dot [animation-delay:200ms]" />
      <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-bounce-dot [animation-delay:400ms]" />
    </span>
  );
}
