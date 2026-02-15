/**
 * Message tool blocks
 *
 * Covers all message actions: send, broadcast, poll, react, reactions, read, edit, delete,
 * pin, unpin, list-pins, permissions, thread-create, thread-list, thread-reply, search,
 * sticker, member-info, role-info, emoji-list, emoji-upload, sticker-upload, channel-info,
 * channel-list, channel-create, channel-edit, channel-delete, channel-move, category-create,
 * category-edit, category-delete, voice-status, event-list, event-create, unsend, reply,
 * sendWithEffect, renameGroup, setGroupIcon, addParticipant, removeParticipant, leaveGroup,
 * sendAttachment.
 */

import { t } from "@/lib/i18n";
import { parseResult } from "./utils";
import { CodeBlock } from "./CodeBlock";
import { ToolInputContainer, ToolBadge, ToolOutputContainer } from "./shared";

// ============================================
// Input Block
// ============================================

interface MessageInputBlockProps {
  args: Record<string, unknown>;
}

/** Channel display names */
const CHANNEL_NAMES: Record<string, string> = {
  discord: "Discord",
  telegram: "Telegram",
  bluebubbles: "iMessage",
  imessage: "iMessage",
  whatsapp: "WhatsApp",
  signal: "Signal",
  slack: "Slack",
  googlechat: "Google Chat",
  irc: "IRC",
};

/** Action icons */
const ACTION_ICONS: Record<string, string> = {
  // Messaging
  send: "💬",
  broadcast: "📢",
  reply: "↩️",
  sendWithEffect: "✨",
  sendAttachment: "📎",
  unsend: "🗑️",
  // Reactions
  react: "👍",
  reactions: "😀",
  // Message management
  read: "👁️",
  edit: "✏️",
  delete: "🗑️",
  pin: "📌",
  unpin: "📌",
  "list-pins": "📌",
  // Threads
  "thread-create": "🧵",
  "thread-list": "🧵",
  "thread-reply": "🧵",
  // Search
  search: "🔍",
  // Stickers/Emoji
  sticker: "🎨",
  "emoji-list": "😀",
  "emoji-upload": "😀",
  "sticker-upload": "🎨",
  // Channel management
  "channel-info": "ℹ️",
  "channel-list": "📋",
  "channel-create": "➕",
  "channel-edit": "✏️",
  "channel-delete": "🗑️",
  "channel-move": "↔️",
  // Category management
  "category-create": "📁",
  "category-edit": "📁",
  "category-delete": "📁",
  // Polls
  poll: "📊",
  // Member/Role
  "member-info": "👤",
  "role-info": "🎭",
  permissions: "🔐",
  // Voice
  "voice-status": "🎤",
  // Events
  "event-list": "📅",
  "event-create": "📅",
  // Group management
  renameGroup: "✏️",
  setGroupIcon: "🖼️",
  addParticipant: "➕",
  removeParticipant: "➖",
  leaveGroup: "🚪",
};

/** Action category labels */
const ACTION_LABELS: Record<string, string> = {
  send: "Send",
  broadcast: "Broadcast",
  reply: "Reply",
  sendWithEffect: "Send with Effect",
  sendAttachment: "Send Attachment",
  unsend: "Unsend",
  react: "React",
  reactions: "Get Reactions",
  read: "Mark Read",
  edit: "Edit",
  delete: "Delete",
  pin: "Pin",
  unpin: "Unpin",
  "list-pins": "List Pins",
  "thread-create": "Create Thread",
  "thread-list": "List Threads",
  "thread-reply": "Reply in Thread",
  search: "Search",
  sticker: "Send Sticker",
  "emoji-list": "List Emoji",
  "emoji-upload": "Upload Emoji",
  "sticker-upload": "Upload Sticker",
  "channel-info": "Channel Info",
  "channel-list": "List Channels",
  "channel-create": "Create Channel",
  "channel-edit": "Edit Channel",
  "channel-delete": "Delete Channel",
  "channel-move": "Move Channel",
  "category-create": "Create Category",
  "category-edit": "Edit Category",
  "category-delete": "Delete Category",
  poll: "Create Poll",
  "member-info": "Member Info",
  "role-info": "Role Info",
  permissions: "Permissions",
  "voice-status": "Voice Status",
  "event-list": "List Events",
  "event-create": "Create Event",
  renameGroup: "Rename Group",
  setGroupIcon: "Set Group Icon",
  addParticipant: "Add Participant",
  removeParticipant: "Remove Participant",
  leaveGroup: "Leave Group",
};

export function MessageInputBlock({ args }: MessageInputBlockProps) {
  const action = args.action as string;
  const channel = args.channel as string | undefined;
  const target = (args.target ?? args.to) as string | undefined;
  const message = args.message as string | undefined;
  const emoji = args.emoji as string | undefined;
  const query = args.query as string | undefined;
  const pollQuestion = args.pollQuestion as string | undefined;
  const pollOptions = args.pollOption as string[] | undefined;
  const effect = (args.effect ?? args.effectId) as string | undefined;
  const participant = args.participant as string | undefined;
  const name = args.name as string | undefined;
  const threadName = args.threadName as string | undefined;
  const eventName = args.eventName as string | undefined;

  const icon = ACTION_ICONS[action] || "💬";
  const label = ACTION_LABELS[action] || action;
  const channelName = channel ? CHANNEL_NAMES[channel] || channel : undefined;

  // Build detail line based on action type
  const getDetails = (): string | null => {
    // Message content
    if (message) {
      return truncate(message, 60);
    }
    // Reaction
    if (action === "react" && emoji) {
      return emoji;
    }
    // Search query
    if (action === "search" && query) {
      return `"${truncate(query, 50)}"`;
    }
    // Poll
    if (action === "poll" && pollQuestion) {
      const optCount = pollOptions?.length ?? 0;
      return `${truncate(pollQuestion, 40)} (${optCount} options)`;
    }
    // Thread
    if (threadName) {
      return truncate(threadName, 50);
    }
    // Event
    if (eventName) {
      return truncate(eventName, 50);
    }
    // Group operations
    if (participant) {
      return participant;
    }
    if (name) {
      return truncate(name, 50);
    }
    return null;
  };

  const details = getDetails();

  return (
    <div class="space-y-1">
      <ToolInputContainer inline>
        <span class="sr-only">{t("toolInput.messageAction")}: </span>
        <span>
          {icon} {label}
        </span>
        {channelName && <ToolBadge>{channelName}</ToolBadge>}
        {target && (
          <span class="text-[var(--color-text-muted)] truncate" title={target}>
            → {formatTarget(target)}
          </span>
        )}
        {effect && <ToolBadge>✨ {effect}</ToolBadge>}
        {args.dryRun && <ToolBadge>{t("common.dryRun")}</ToolBadge>}
      </ToolInputContainer>
      {details && (
        <div class="text-xs text-[var(--color-text-muted)] pl-1 truncate" title={details}>
          {details}
        </div>
      )}
    </div>
  );
}

/** Truncate text with ellipsis */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

/** Format target for display */
function formatTarget(target: string): string {
  // Phone numbers - keep as is
  if (target.startsWith("+")) {
    return target;
  }
  // Discord-style targets
  if (target.startsWith("user:") || target.startsWith("channel:")) {
    return target;
  }
  // Truncate long IDs
  if (target.length > 20) {
    return target.slice(0, 8) + "…" + target.slice(-8);
  }
  return target;
}

// ============================================
// Result Block
// ============================================

interface SendResult {
  channel?: string;
  to?: string;
  via?: string;
  dryRun?: boolean;
  mediaUrl?: string | null;
}

interface PollResult {
  channel?: string;
  to?: string;
  question?: string;
  options?: string[];
  maxSelections?: number;
  durationHours?: number | null;
  via?: string;
  dryRun?: boolean;
}

interface SimpleResult {
  ok?: boolean;
  action?: string;
  channel?: string;
  dryRun?: boolean;
}

interface ChannelInfo {
  id?: string;
  name?: string;
  type?: string | number;
  topic?: string;
}

interface ChannelListResult {
  channels?: ChannelInfo[];
}

interface SearchResult {
  messages?: Array<{
    id?: string;
    content?: string;
    author?: string;
    timestamp?: string;
  }>;
}

interface MemberInfo {
  id?: string;
  username?: string;
  displayName?: string;
  roles?: string[];
  joinedAt?: string;
}

interface EventInfo {
  id?: string;
  name?: string;
  startTime?: string;
  location?: string;
}

interface EventListResult {
  events?: EventInfo[];
}

export function MessageResultBlock({ result }: { result: unknown }) {
  // Handle string results
  if (typeof result === "string") {
    if (!result.trim()) {
      return <ToolOutputContainer>{t("toolOutput.messageSent")}</ToolOutputContainer>;
    }
    return <CodeBlock content={result} maxLines={10} />;
  }

  const data = parseResult<
    | SendResult
    | PollResult
    | SimpleResult
    | ChannelListResult
    | SearchResult
    | MemberInfo
    | EventListResult
  >(result);

  if (!data) {
    return <CodeBlock content={result} maxLines={20} />;
  }

  // Simple success
  if ("ok" in data && data.ok === true) {
    const action = (data as SimpleResult).action;
    const channel = (data as SimpleResult).channel;
    return (
      <ToolOutputContainer>
        <span class="text-[var(--color-success)]">
          ✓ {action ? ACTION_LABELS[action] || action : t("common.success")}
          {channel && ` (${CHANNEL_NAMES[channel] || channel})`}
        </span>
        {(data as SimpleResult).dryRun && (
          <span class="text-[var(--color-text-muted)]"> — {t("common.dryRun")}</span>
        )}
      </ToolOutputContainer>
    );
  }

  // Poll result
  if ("question" in data && "options" in data) {
    const poll = data as PollResult;
    return (
      <div class="text-xs p-2 rounded-md bg-[var(--color-bg-tertiary)] space-y-2">
        <div class="flex items-center gap-2">
          <span>📊</span>
          <span class="font-medium text-[var(--color-text-primary)]">{poll.question}</span>
          {poll.dryRun && <ToolBadge>{t("common.dryRun")}</ToolBadge>}
        </div>
        {poll.options && poll.options.length > 0 && (
          <div class="space-y-1 pl-5">
            {poll.options.map((opt, i) => (
              <div key={i} class="text-[var(--color-text-muted)]">
                • {opt}
              </div>
            ))}
          </div>
        )}
        <div class="text-[var(--color-text-muted)] text-[10px]">
          {poll.channel && (CHANNEL_NAMES[poll.channel] || poll.channel)}
          {poll.to && ` → ${formatTarget(poll.to)}`}
        </div>
      </div>
    );
  }

  // Channel list
  if ("channels" in data && Array.isArray(data.channels)) {
    const channels = data.channels as ChannelInfo[];
    if (channels.length === 0) {
      return <ToolOutputContainer>{t("toolOutput.noChannels")}</ToolOutputContainer>;
    }
    return (
      <div class="space-y-1">
        <div class="text-xs text-[var(--color-text-muted)] px-1">
          {t("toolOutput.channelCount", { count: channels.length })}
        </div>
        {channels.slice(0, 10).map((ch, i) => (
          <div
            key={ch.id ?? i}
            class="flex items-center gap-2 text-xs p-2 rounded-md bg-[var(--color-bg-tertiary)]"
          >
            <span class="text-[var(--color-text-muted)]">#</span>
            <span class="font-medium text-[var(--color-text-primary)] truncate">
              {ch.name || ch.id}
            </span>
            {ch.topic && (
              <span class="text-[var(--color-text-muted)] truncate text-[10px]">{ch.topic}</span>
            )}
          </div>
        ))}
        {channels.length > 10 && (
          <div class="text-xs text-[var(--color-text-muted)] px-1">
            +{channels.length - 10} more
          </div>
        )}
      </div>
    );
  }

  // Search results
  if ("messages" in data && Array.isArray(data.messages)) {
    const messages = data.messages;
    if (messages.length === 0) {
      return <ToolOutputContainer>{t("toolOutput.noResults")}</ToolOutputContainer>;
    }
    return (
      <div class="space-y-1">
        <div class="text-xs text-[var(--color-text-muted)] px-1">
          {t("toolOutput.messageCount", { count: messages.length })}
        </div>
        {messages.slice(0, 5).map((msg, i) => (
          <div key={msg.id ?? i} class="text-xs p-2 rounded-md bg-[var(--color-bg-tertiary)]">
            {msg.author && (
              <span class="font-medium text-[var(--color-accent)]">{msg.author}: </span>
            )}
            <span class="text-[var(--color-text-primary)]">{truncate(msg.content || "", 80)}</span>
          </div>
        ))}
        {messages.length > 5 && (
          <div class="text-xs text-[var(--color-text-muted)] px-1">+{messages.length - 5} more</div>
        )}
      </div>
    );
  }

  // Event list
  if ("events" in data && Array.isArray(data.events)) {
    const events = data.events as EventInfo[];
    if (events.length === 0) {
      return <ToolOutputContainer>{t("toolOutput.noEvents")}</ToolOutputContainer>;
    }
    return (
      <div class="space-y-1">
        {events.slice(0, 5).map((evt, i) => (
          <div
            key={evt.id ?? i}
            class="flex items-center gap-2 text-xs p-2 rounded-md bg-[var(--color-bg-tertiary)]"
          >
            <span>📅</span>
            <span class="font-medium text-[var(--color-text-primary)]">{evt.name}</span>
            {evt.startTime && (
              <span class="text-[var(--color-text-muted)] text-[10px]">{evt.startTime}</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Member info
  if ("username" in data || "displayName" in data) {
    const member = data as MemberInfo;
    return (
      <div class="text-xs p-2 rounded-md bg-[var(--color-bg-tertiary)] space-y-1">
        <div class="flex items-center gap-2">
          <span>👤</span>
          <span class="font-medium text-[var(--color-text-primary)]">
            {member.displayName || member.username}
          </span>
          {member.username && member.displayName && (
            <span class="text-[var(--color-text-muted)]">@{member.username}</span>
          )}
        </div>
        {member.roles && member.roles.length > 0 && (
          <div class="flex flex-wrap gap-1 pl-5">
            {member.roles.slice(0, 5).map((role, i) => (
              <ToolBadge key={i}>{role}</ToolBadge>
            ))}
            {member.roles.length > 5 && (
              <span class="text-[10px] text-[var(--color-text-muted)]">
                +{member.roles.length - 5}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Send result (fallback for simple send confirmations)
  if ("channel" in data && "to" in data) {
    const send = data as SendResult;
    return (
      <ToolOutputContainer>
        <span class="text-[var(--color-success)]">✓ </span>
        <span class="text-[var(--color-text-muted)]">
          {send.channel && (CHANNEL_NAMES[send.channel] || send.channel)}
          {send.to && ` → ${formatTarget(send.to)}`}
        </span>
        {send.dryRun && <span class="text-[var(--color-text-muted)]"> — {t("common.dryRun")}</span>}
      </ToolOutputContainer>
    );
  }

  // Fallback
  return <CodeBlock content={result} maxLines={20} />;
}
