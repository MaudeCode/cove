/**
 * MessageList
 *
 * Scrollable message container with auto-scroll behavior.
 */

import { useRef, useEffect, useCallback } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { Message, ToolCall } from "@/types/messages";
import { ChatMessage } from "./ChatMessage";
import { IconButton, Spinner, ArrowDownIcon } from "@/components/ui";
import { t } from "@/lib/i18n";

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  error?: string | null;
  streamingContent?: string;
  streamingToolCalls?: ToolCall[];
  isStreaming?: boolean;
  assistantName?: string;
  assistantAvatar?: string;
  userName?: string;
  userAvatar?: string;
}

export function MessageList({
  messages,
  isLoading = false,
  error = null,
  streamingContent = "",
  streamingToolCalls = [],
  isStreaming = false,
  assistantName,
  assistantAvatar,
  userName,
  userAvatar,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const showScrollButton = useSignal(false);
  const isAutoScrolling = useRef(true);

  /**
   * Scroll to bottom of message list
   */
  const scrollToBottom = useCallback((smooth = true) => {
    // Use requestAnimationFrame to ensure DOM is updated before scrolling
    requestAnimationFrame(() => {
      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: smooth ? "smooth" : "auto",
        });
      }
    });
  }, []);

  /**
   * Handle scroll events to show/hide scroll button
   * Note: showScrollButton is a Preact Signal (stable ref), not React state
   */
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Show button if scrolled up more than 100px
    showScrollButton.value = distanceFromBottom > 100;

    // Track if user manually scrolled up
    isAutoScrolling.current = distanceFromBottom < 50;
  }, []);

  /**
   * Auto-scroll on new messages or tool call changes (if at bottom)
   * We track: message count, content length, tool call count, and completed tool count
   */
  const completedToolCount = streamingToolCalls.filter(
    (tc) => tc.status === "complete" || tc.status === "error",
  ).length;

  const lastMessageRef = useRef<string | null>(null);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    const isNewUserMessage =
      lastMessage?.role === "user" && lastMessage.id !== lastMessageRef.current;

    // Always scroll for new user messages (they just sent it)
    // Otherwise respect auto-scroll preference
    if (isNewUserMessage || isAutoScrolling.current) {
      scrollToBottom(false);
    }

    lastMessageRef.current = lastMessage?.id ?? null;
  }, [
    messages.length,
    streamingContent.length,
    streamingToolCalls.length,
    completedToolCount,
    scrollToBottom,
  ]);

  /**
   * Initial scroll to bottom
   */
  useEffect(() => {
    scrollToBottom(false);
  }, [scrollToBottom]);

  // Create streaming message placeholder
  const streamingMessage: Message | null = isStreaming
    ? {
        id: "streaming",
        role: "assistant",
        content: streamingContent,
        toolCalls: streamingToolCalls.length > 0 ? streamingToolCalls : undefined,
        timestamp: Date.now(),
        isStreaming: true,
      }
    : null;

  return (
    <div class="relative flex-1 flex flex-col overflow-hidden">
      {/* Scrollable message area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        class="flex-1 overflow-y-auto"
        role="list"
        aria-label="Messages"
      >
        {/* Centered container with max-width */}
        <div class="max-w-5xl mx-auto px-6 py-6">
          {/* Loading state */}
          {isLoading && (
            <div class="flex justify-center py-8">
              <Spinner size="md" label={t("status.loading")} />
            </div>
          )}

          {/* Error state */}
          {error && (
            <div class="flex justify-center py-8">
              <div class="text-[var(--color-error)] text-center">
                <p>{error}</p>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && messages.length === 0 && !isStreaming && (
            <div class="flex-1 flex items-center justify-center py-16">
              <div class="text-center">
                <div class="text-5xl mb-4">💬</div>
                <h3 class="text-lg font-medium mb-1">{t("chat.emptyState.title")}</h3>
                <p class="text-[var(--color-text-muted)]">{t("chat.emptyState.description")}</p>
              </div>
            </div>
          )}

          {/* Messages */}
          <div class="space-y-6">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                assistantName={assistantName}
                assistantAvatar={assistantAvatar}
                userName={userName}
                userAvatar={userAvatar}
              />
            ))}

            {/* Streaming message */}
            {streamingMessage && (
              <ChatMessage
                message={streamingMessage}
                isStreaming
                assistantName={assistantName}
                assistantAvatar={assistantAvatar}
              />
            )}
          </div>

          {/* Scroll anchor */}
          <div ref={bottomRef} class="h-1" />
        </div>
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton.value && (
        <div class="absolute bottom-4 right-4">
          <IconButton
            icon={<ArrowDownIcon />}
            label={t("chat.scrollToBottom")}
            onClick={() => {
              isAutoScrolling.current = true;
              scrollToBottom(true);
            }}
            variant="default"
            size="md"
            class="shadow-lg bg-[var(--color-bg-surface)] border border-[var(--color-border)]"
          />
        </div>
      )}
    </div>
  );
}
