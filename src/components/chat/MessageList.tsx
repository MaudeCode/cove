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
import { CompactionDivider } from "./CompactionDivider";
import { SearchBar } from "./SearchBar";
import { IconButton } from "@/components/ui/IconButton";
import { Spinner } from "@/components/ui/Spinner";
import { ArrowDownIcon } from "@/components/ui/icons";
import { CoveLogo } from "@/components/ui/CoveLogo";
import { t } from "@/lib/i18n";
import { log } from "@/lib/logger";
import { isAvatarUrl } from "@/lib/utils";
import {
  searchQuery,
  isSearchOpen,
  scrollToMessageId,
  isCompacting,
  showCompletedCompaction,
  lastCompactionSummary,
  compactionInsertIndex,
} from "@/signals/chat";
import { groupMessages } from "@/lib/message-grouping";
import { isNoReplyContent } from "@/lib/message-detection";

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
      // Reset auto-scroll when user sends a message (they want to see it + response)
      if (isNewUserMessage) {
        isAutoScrolling.current = true;
      }
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
   * Re-scroll when images load (they change content height after initial render)
   */
  useEffect(() => {
    if (!containerRef.current) return;

    const handleImageLoad = () => {
      // Re-scroll if we should be at bottom
      if (isAutoScrolling.current) {
        scrollToBottom(false);
      }
    };

    // Listen for load events on images (they bubble)
    const container = containerRef.current;
    container.addEventListener("load", handleImageLoad, true);

    return () => container.removeEventListener("load", handleImageLoad, true);
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

  // Create streaming message placeholder (hide if it's a NO_REPLY signal)
  const isStreamingNoReply = isStreaming && isNoReplyContent(streamingContent);
  const streamingMessage: Message | null =
    isStreaming && !isStreamingNoReply
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

  // Find the group index where the ephemeral compaction divider should be inserted.
  // compactionInsertIndex is a message index; we need to find which group contains it.
  const ephemeralDividerGroupIdx = useMemo(() => {
    const insertAt = compactionInsertIndex.value;
    if (insertAt < 0 || !showCompletedCompaction.value) return -1;

    // Find the first group whose source message index >= insertAt
    for (let i = 0; i < messageGroups.length; i++) {
      const g = messageGroups[i];
      const srcMsg =
        g.type === "message" || g.type === "cron"
          ? g.message
          : g.type === "compaction" && g.messages.length > 0
            ? g.messages[0]
            : null;
      if (srcMsg) {
        const msgIdx = messages.indexOf(srcMsg);
        if (msgIdx >= insertAt) return i;
      }
    }
    return messageGroups.length; // past all groups → render at end
  }, [messageGroups, compactionInsertIndex.value, showCompletedCompaction.value]);

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
        {/* Centered container with max-width - flex column with min-height for empty state */}
        <div class="max-w-5xl mx-auto px-6 py-6 min-h-full flex flex-col">
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
              <div class="text-center max-w-md">
                {isAvatarUrl(assistantAvatar) ? (
                  <img
                    src={assistantAvatar}
                    alt={assistantName || t("chat.emptyState.assistant")}
                    class="w-20 h-20 rounded-2xl mx-auto mb-4 opacity-90"
                  />
                ) : assistantAvatar ? (
                  <div
                    class="text-6xl mx-auto mb-4"
                    role="img"
                    aria-label={assistantName || t("chat.emptyState.assistant")}
                  >
                    {assistantAvatar}
                  </div>
                ) : (
                  <CoveLogo size="lg" class="mx-auto mb-4 opacity-80" />
                )}
                <h3 class="text-xl font-medium mb-2">
                  {assistantName
                    ? t("chat.emptyState.titleWithName", { name: assistantName })
                    : t("chat.emptyState.title")}
                </h3>
                <p class="text-[var(--color-text-muted)] mb-6">
                  {t("chat.emptyState.description")}
                </p>
                <div class="text-sm text-[var(--color-text-muted)]">
                  <p class="mb-2">{t("chat.emptyState.hint")}</p>
                  <div class="flex items-center justify-center gap-4 text-xs">
                    <span class="flex items-center gap-1">
                      <kbd class="px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] font-mono">
                        ⌘
                      </kbd>
                      <kbd class="px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] font-mono">
                        F
                      </kbd>
                      <span class="ml-1">{t("chat.emptyState.search")}</span>
                    </span>
                    <span class="flex items-center gap-1">
                      <kbd class="px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] font-mono">
                        /new
                      </kbd>
                      <span class="ml-1">{t("chat.emptyState.newSession")}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div class="space-y-6">
            {messageGroups.map((group, idx) => {
              // Render ephemeral completed divider at its anchored position
              const showEphemeralHere =
                !isCompacting.value &&
                showCompletedCompaction.value &&
                ephemeralDividerGroupIdx === idx;

              const rendered = [];

              if (showEphemeralHere) {
                rendered.push(
                  <CompactionDivider
                    key="compaction-ephemeral"
                    summary={lastCompactionSummary.value}
                  />,
                );
              }

              if (group.type === "compaction") {
                rendered.push(
                  <CompactionDivider key={`compaction-${idx}`} messages={group.messages} />,
                );
              } else if (group.type === "cron") {
                rendered.push(<CollapsedMessage key={`cron-${idx}`} messages={[group.message]} />);
              } else {
                const message = group.message;
                const handleNavigate = isSearchOpen.value
                  ? () => {
                      scrollToMessageId.value = message.id;
                      searchQuery.value = "";
                      isSearchOpen.value = false;
                    }
                  : undefined;

                rendered.push(
                  <div
                    key={message.id}
                    data-message-id={message.id}
                    onClick={handleNavigate}
                    onKeyDown={
                      handleNavigate
                        ? (e: KeyboardEvent) => {
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
                  </div>,
                );
              }

              return rendered;
            })}

            {/* Ephemeral divider at end (when insert index is past all groups) */}
            {!isCompacting.value &&
              showCompletedCompaction.value &&
              ephemeralDividerGroupIdx >= messageGroups.length && (
                <CompactionDivider summary={lastCompactionSummary.value} />
              )}

            {/* Active compaction divider — always at bottom with spinner */}
            {isCompacting.value && <CompactionDivider active />}

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
