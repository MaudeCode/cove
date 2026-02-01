/**
 * AssistantMessage
 *
 * Assistant message with avatar, name, and tool calls inline at their insertion points.
 * Supports images from content blocks or MEDIA: lines.
 */

import { useSignal } from "@preact/signals";
import type { Message, ToolCall } from "@/types/messages";
import { MessageContent } from "./MessageContent";
import { MessageImages } from "./MessageImages";
import { MessageActions } from "./MessageActions";
import { ToolCall as ToolCallComponent } from "./ToolCall";
import { BouncingDots } from "@/components/ui";
import { formatTimestamp, t } from "@/lib/i18n";
import { log } from "@/lib/logger";
import { parseMediaFromContent, mediaUrlsToImages } from "@/lib/media-parse";

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
  const isHovered = useSignal(false);

  // Parse MEDIA: lines from content
  const parsedMedia = parseMediaFromContent(message.content);
  const mediaImages = mediaUrlsToImages(parsedMedia.mediaUrls);

  // Combine images from message.images (content blocks) and parsed MEDIA: lines
  const allImages = [...(message.images ?? []), ...mediaImages];

  // Build content blocks using cleaned text (MEDIA: lines removed)
  const blocks = buildContentBlocks(parsedMedia.text, message.toolCalls ?? []);
  const hasContent = blocks.length > 0 || isStreaming || allImages.length > 0;

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
        <div class="w-6 h-6 rounded-full bg-[var(--color-bg-surface)] border border-[var(--color-border)] flex items-center justify-center text-sm">
          {assistantAvatar || "🤖"}
        </div>

        {/* Name */}
        <span class="text-sm font-medium text-[var(--color-text-primary)]">{assistantName}</span>

        {/* Timestamp (hide while streaming) */}
        {!isStreaming && message.timestamp && (
          <span class="text-xs text-[var(--color-text-muted)]">
            {formatTimestamp(message.timestamp)}
          </span>
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
