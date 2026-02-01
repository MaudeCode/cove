/**
 * MessageList
 *
 * Scrollable message container with auto-scroll behavior.
 */

import { useRef, useEffect, useCallback, useMemo } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { Message, ToolCall } from "@/types/messages";
import { ChatMessage } from "./ChatMessage";
import { CollapsedMessage } from "./CollapsedMessage";
import { SearchBar } from "./SearchBar";
import { IconButton, Spinner, ArrowDownIcon, CoveLogo } from "@/components/ui";
import { t } from "@/lib/i18n";
import { log } from "@/lib/logger";
import { searchQuery, isSearchOpen, scrollToMessageId } from "@/signals/chat";
import { groupMessages } from "@/lib/message-grouping";

/** Classes for active highlight (scroll-to effect) */
const MESSAGE_HIGHLIGHT_ACTIVE = ["bg-[var(--color-bg-hover)]", "rounded-lg", "transition-colors"];

/** Classes for hover highlight (search results) - no padding to prevent layout shift */
const MESSAGE_HIGHLIGHT_HOVER =
  "cursor-pointer hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors";

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
  /** Number of queued messages (triggers scroll when changed) */
  queuedCount?: number;
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
  queuedCount = 0,
}: MessageListProps) {
  // Debug: log every render to track reactivity issues
  log.chat.debug("MessageList render", {
    messagesCount: messages.length,
    streamingContentLen: streamingContent.length,
    streamingToolCallsCount: streamingToolCalls.length,
    isStreaming,
    queuedCount,
  });

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
    // Also always scroll when new messages are queued (so user can see queue + typing indicator)
    // Otherwise respect auto-scroll preference
    if (isNewUserMessage || queuedCount > 0 || isAutoScrolling.current) {
      scrollToBottom(false);
    }

    lastMessageRef.current = lastMessage?.id ?? null;
  }, [
    messages.length,
    streamingContent.length,
    streamingToolCalls.length,
    completedToolCount,
    queuedCount,
    scrollToBottom,
  ]);

  /**
   * Initial scroll to bottom
   */
  useEffect(() => {
    scrollToBottom(false);
  }, [scrollToBottom]);

  /**
   * Scroll to specific message when scrollToMessageId is set
   */
  useEffect(() => {
    const targetId = scrollToMessageId.value;
    if (!targetId || !containerRef.current) return;

    // Find the message element
    const messageEl = containerRef.current.querySelector(`[data-message-id="${targetId}"]`);
    if (messageEl) {
      // Scroll to the message with some offset from top
      messageEl.scrollIntoView({ behavior: "smooth", block: "center" });

      // Add a brief highlight effect
      messageEl.classList.add(...MESSAGE_HIGHLIGHT_ACTIVE);
      setTimeout(() => {
        messageEl.classList.remove(...MESSAGE_HIGHLIGHT_ACTIVE);
      }, 2000);
    }

    // Clear the scroll target
    scrollToMessageId.value = null;
  }, [scrollToMessageId.value]);

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

  // Group messages for display (filters heartbeats, collapses compaction summaries)
  const messageGroups = useMemo(() => groupMessages(messages), [messages]);

  return (
    <div class="relative flex-1 flex flex-col overflow-hidden">
      {/* Search bar overlay - zero-height wrapper to not affect flex layout */}
      <div class="relative h-0 overflow-visible z-10">
        <SearchBar />
      </div>

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
                <CoveLogo size="lg" class="mx-auto mb-4 opacity-80" />
                <h3 class="text-lg font-medium mb-1">{t("chat.emptyState.title")}</h3>
                <p class="text-[var(--color-text-muted)]">{t("chat.emptyState.description")}</p>
              </div>
            </div>
          )}

          {/* Messages */}
          <div class="space-y-6">
            {messageGroups.map((group, idx) => {
              if (group.type === "compaction") {
                return (
                  <CollapsedMessage
                    key={`compaction-${idx}`}
                    messages={group.messages}
                    type="compaction"
                  />
                );
              }

              const message = group.message;
              const handleNavigate = isSearchOpen.value
                ? () => {
                    // Clear search and scroll to this message in full context
                    scrollToMessageId.value = message.id;
                    searchQuery.value = "";
                    isSearchOpen.value = false;
                  }
                : undefined;

              return (
                <div
                  key={message.id}
                  data-message-id={message.id}
                  onClick={handleNavigate}
                  onKeyDown={
                    handleNavigate
                      ? (e) => {
                          if (e.key === "Enter") handleNavigate();
                        }
                      : undefined
                  }
                  role={isSearchOpen.value ? "button" : undefined}
                  tabIndex={isSearchOpen.value ? 0 : undefined}
                  class={`-mx-2 px-2 py-1 rounded-lg ${isSearchOpen.value ? MESSAGE_HIGHLIGHT_HOVER : ""}`}
                >
                  <ChatMessage
                    message={message}
                    assistantName={assistantName}
                    assistantAvatar={assistantAvatar}
                    userName={userName}
                    userAvatar={userAvatar}
                  />
                </div>
              );
            })}

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
