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
import { ToolBadge, ToolOutputContainer, ResultCard, ResultGrid, ResultGridRow } from "./shared";

// ============================================
// Input Block
// ============================================

interface MessageInputBlockProps {
  args: Record<string, unknown>;
}

/** Channel display names */
const CHANNEL_NAMES: Record<string, string> = {
  // Core channels
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  discord: "Discord",
  irc: "IRC",
  googlechat: "Google Chat",
  slack: "Slack",
  signal: "Signal",
  imessage: "iMessage",
  // Plugin channels
  bluebubbles: "BlueBubbles",
  // Aliases
  imsg: "iMessage",
  gchat: "Google Chat",
  "google-chat": "Google Chat",
  "internet-relay-chat": "IRC",
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

  const icon = ACTION_ICONS[action] || "💬";
  const label = ACTION_LABELS[action] || action;
  const channelName = channel ? CHANNEL_NAMES[channel] || channel : undefined;

  // Filter out keys already shown in header (action, channel, dryRun)
  const headerKeys = new Set(["action", "channel", "dryRun"]);
  const displayArgs = Object.entries(args).filter(
    ([key, value]) => !headerKeys.has(key) && value !== undefined && value !== null,
  );

  return (
    <div class="text-xs p-2 rounded-md bg-[var(--color-bg-tertiary)]">
      <div class="flex items-center gap-2 mb-2">
        <span class="sr-only">{t("toolInput.messageAction")}: </span>
        <span>
          {icon} {label}
        </span>
        {channelName && <ToolBadge>{channelName}</ToolBadge>}
        {args.dryRun && <ToolBadge>{t("common.dryRun")}</ToolBadge>}
      </div>
      {displayArgs.length > 0 && (
        <div class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[var(--color-text-muted)]">
          {displayArgs.map(([key, value]) => (
            <>
              <span key={`${key}-label`}>{key}:</span>
              <span
                key={`${key}-value`}
                class="text-[var(--color-text-primary)] truncate"
                title={String(value)}
              >
                {typeof value === "object" ? JSON.stringify(value) : String(value)}
              </span>
            </>
          ))}
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

interface BroadcastResultItem {
  channel?: string;
  to?: string;
  ok?: boolean;
  result?: SendResult;
  error?: string;
}

interface BroadcastResult {
  results?: BroadcastResultItem[];
}

export function MessageResultBlock({ result }: { result: unknown }) {
  // Parse string results (tool results often come as JSON strings)
  let parsed = result;
  if (typeof result === "string") {
    if (!result.trim()) {
      return <ToolOutputContainer>{t("toolOutput.messageSent")}</ToolOutputContainer>;
    }
    try {
      parsed = JSON.parse(result);
    } catch {
      // Not JSON, show as-is
      return <CodeBlock content={result} maxLines={10} />;
    }
  }

  const data = parseResult<
    | SendResult
    | PollResult
    | SimpleResult
    | ChannelListResult
    | SearchResult
    | MemberInfo
    | EventListResult
    | BroadcastResult
  >(parsed);

  if (!data) {
    return <CodeBlock content={result} maxLines={20} />;
  }

  // Broadcast results (array of send results)
  if ("results" in data && Array.isArray(data.results)) {
    const results = data.results as BroadcastResultItem[];
    const successCount = results.filter((r) => r.ok).length;
    const failCount = results.length - successCount;

    return (
      <div class="space-y-1">
        <ToolOutputContainer>
          <span class="text-[var(--color-success)]">✓ {t("toolOutput.broadcastSent")}</span>
          <span class="text-[var(--color-text-muted)]">
            {" "}
            — {successCount}/{results.length} {t("common.success").toLowerCase()}
            {failCount > 0 && `, ${failCount} failed`}
          </span>
        </ToolOutputContainer>
        {results.slice(0, 5).map((r, i) => (
          <div
            key={i}
            class="flex items-center gap-2 text-xs px-2 py-1 rounded bg-[var(--color-bg-tertiary)]"
          >
            <span class={r.ok ? "text-[var(--color-success)]" : "text-[var(--color-error)]"}>
              {r.ok ? "✓" : "✗"}
            </span>
            <span class="text-[var(--color-text-muted)]">{r.to}</span>
            {r.error && <span class="text-[var(--color-error)] truncate">{r.error}</span>}
          </div>
        ))}
        {results.length > 5 && (
          <div class="text-xs text-[var(--color-text-muted)] px-2">+{results.length - 5} more</div>
        )}
      </div>
    );
  }

  // Channel list result
  if ("channels" in data && Array.isArray(data.channels)) {
    const channels = data.channels as Array<ChannelInfo & { guild_id?: string }>;
    const isDiscord = channels.some((ch) => "guild_id" in ch);
    const countText =
      channels.length === 1
        ? t("toolOutput.channelCount", { count: channels.length })
        : t("toolOutput.channelCountPlural", { count: channels.length });

    // Discord channel type labels
    const discordTypes: Record<number, { icon: string; label: string }> = {
      0: { icon: "#", label: "text" },
      2: { icon: "🔊", label: "voice" },
      4: { icon: "📁", label: "category" },
      5: { icon: "📢", label: "announcement" },
      13: { icon: "🎭", label: "stage" },
      15: { icon: "💬", label: "forum" },
    };

    const getChannelDisplay = (ch: ChannelInfo) => {
      if (isDiscord && typeof ch.type === "number") {
        const info = discordTypes[ch.type] || { icon: "•", label: `type ${ch.type}` };
        return { icon: info.icon, typeLabel: info.label };
      }
      return { icon: "•", typeLabel: ch.type !== undefined ? String(ch.type) : null };
    };

    return (
      <ResultCard
        header={
          <>
            <span class="font-medium text-[var(--color-text-primary)]">{countText}</span>
            {isDiscord && <ToolBadge>Discord</ToolBadge>}
          </>
        }
      >
        <details open>
          <summary class="cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            {t("toolOutput.showAll")}
          </summary>
          <div class="mt-2 space-y-0.5 max-h-60 overflow-y-auto font-mono">
            {channels.map((ch, i) => {
              const display = getChannelDisplay(ch);
              return (
                <div
                  key={ch.id || i}
                  class="flex items-center gap-2 text-[var(--color-text-muted)]"
                >
                  <span class="w-4 text-center">{display.icon}</span>
                  <span class="text-[var(--color-text-primary)]">
                    {ch.name || t("toolOutput.unnamed")}
                  </span>
                  {display.typeLabel && (
                    <span class="text-[10px] opacity-50">{display.typeLabel}</span>
                  )}
                  <span class="ml-auto text-[10px] opacity-30">{ch.id}</span>
                </div>
              );
            })}
          </div>
        </details>
      </ResultCard>
    );
  }

  // Member info result
  if ("member" in data && typeof data.member === "object" && data.member !== null) {
    const member = data.member as {
      user?: { id?: string; username?: string; global_name?: string; avatar?: string };
      nick?: string;
      roles?: string[];
      joined_at?: string;
    };
    const displayName =
      member.nick || member.user?.global_name || member.user?.username || "Unknown";
    const joinDate = member.joined_at ? new Date(member.joined_at).toLocaleDateString() : null;

    return (
      <ResultCard
        header={
          <>
            <span class="font-medium text-[var(--color-text-primary)]">👤 {displayName}</span>
            {member.user?.username && member.user.username !== displayName && (
              <span class="text-[var(--color-text-muted)]">@{member.user.username}</span>
            )}
          </>
        }
      >
        <ResultGrid>
          {member.user?.id && (
            <ResultGridRow label={t("toolOutput.fieldId")} mono small>
              {member.user.id}
            </ResultGridRow>
          )}
          {joinDate && (
            <ResultGridRow label={t("toolOutput.fieldJoined")}>{joinDate}</ResultGridRow>
          )}
          {member.roles && member.roles.length > 0 && (
            <ResultGridRow label={t("toolOutput.fieldRoles")}>{member.roles.length}</ResultGridRow>
          )}
        </ResultGrid>
      </ResultCard>
    );
  }

  // Emoji list result
  if ("emojis" in data && Array.isArray(data.emojis)) {
    const emojis = data.emojis as Array<{ id?: string; name?: string; animated?: boolean }>;
    if (emojis.length === 0) {
      return (
        <ToolOutputContainer>
          <span class="text-[var(--color-text-muted)]">{t("toolOutput.noEmojis")}</span>
        </ToolOutputContainer>
      );
    }
    const countText =
      emojis.length === 1
        ? t("toolOutput.emojiCount", { count: emojis.length })
        : t("toolOutput.emojiCountPlural", { count: emojis.length });

    return (
      <ResultCard
        header={<span class="font-medium text-[var(--color-text-primary)]">{countText}</span>}
      >
        <div class="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
          {emojis.map((e, i) => (
            <span key={e.id || i} class="text-[var(--color-text-muted)]" title={e.name}>
              :{e.name}:
            </span>
          ))}
        </div>
      </ResultCard>
    );
  }

  // Events list result
  if ("events" in data && Array.isArray(data.events)) {
    const events = data.events as Array<{
      id?: string;
      name?: string;
      scheduled_start_time?: string;
    }>;
    if (events.length === 0) {
      return (
        <ToolOutputContainer>
          <span class="text-[var(--color-text-muted)]">{t("toolOutput.noScheduledEvents")}</span>
        </ToolOutputContainer>
      );
    }
    const countText =
      events.length === 1
        ? t("toolOutput.eventCount", { count: events.length })
        : t("toolOutput.eventCountPlural", { count: events.length });

    return (
      <ResultCard
        header={<span class="font-medium text-[var(--color-text-primary)]">📅 {countText}</span>}
      >
        <div class="space-y-1 max-h-40 overflow-y-auto">
          {events.map((e, i) => (
            <div key={e.id || i} class="flex items-center gap-2 text-[var(--color-text-muted)]">
              <span class="text-[var(--color-text-primary)]">
                {e.name || t("toolOutput.unnamed")}
              </span>
              {e.scheduled_start_time && (
                <span class="text-[10px]">{new Date(e.scheduled_start_time).toLocaleString()}</span>
              )}
            </div>
          ))}
        </div>
      </ResultCard>
    );
  }

  // Pinned messages result
  if ("pins" in data && Array.isArray(data.pins)) {
    const pins = data.pins as Array<{
      id?: string;
      content?: string;
      author?: { username?: string };
    }>;
    if (pins.length === 0) {
      return (
        <ToolOutputContainer>
          <span class="text-[var(--color-text-muted)]">{t("toolOutput.noPinnedMessages")}</span>
        </ToolOutputContainer>
      );
    }
    const countText =
      pins.length === 1
        ? t("toolOutput.pinnedCount", { count: pins.length })
        : t("toolOutput.pinnedCountPlural", { count: pins.length });

    return (
      <ResultCard
        header={<span class="font-medium text-[var(--color-text-primary)]">📌 {countText}</span>}
      >
        <div class="space-y-1 max-h-40 overflow-y-auto">
          {pins.map((p, i) => (
            <div key={p.id || i} class="text-[var(--color-text-muted)]">
              {p.author?.username && <span class="font-medium">{p.author.username}: </span>}
              <span class="text-[var(--color-text-primary)]">
                {p.content
                  ? p.content.length > 60
                    ? p.content.slice(0, 60) + "..."
                    : p.content
                  : t("toolOutput.noText")}
              </span>
            </div>
          ))}
        </div>
      </ResultCard>
    );
  }

  // Simple success (ok: true at top level)
  // Show ALL the data - don't hide anything
  if ("ok" in data && data.ok === true) {
    const {
      ok: _ok,
      action,
      channel,
      dryRun,
      ...rest
    } = data as SimpleResult & Record<string, unknown>;
    const hasExtraData = Object.keys(rest).length > 0;

    return (
      <ResultCard
        header={
          <>
            <span class="font-medium text-[var(--color-text-primary)]">
              {action ? ACTION_LABELS[action] || action : t("common.success")}
            </span>
            {channel && <ToolBadge>{CHANNEL_NAMES[channel] || channel}</ToolBadge>}
            {dryRun && <ToolBadge>{t("common.dryRun")}</ToolBadge>}
          </>
        }
      >
        {hasExtraData && (
          <pre class="p-2 bg-[var(--color-bg-secondary)] rounded text-[10px] overflow-x-auto max-h-80 overflow-y-auto">
            {JSON.stringify(rest, null, 2)}
          </pre>
        )}
      </ResultCard>
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
      <ResultCard
        header={
          <>
            <span class="font-medium text-[var(--color-text-primary)]">
              {t("toolOutput.messageSent")}
            </span>
            {send.dryRun && <ToolBadge>{t("common.dryRun")}</ToolBadge>}
          </>
        }
      >
        <ResultGrid>
          <ResultGridRow label={t("toolOutput.fieldChannel")}>
            {send.channel && (CHANNEL_NAMES[send.channel] || send.channel)}
          </ResultGridRow>
          <ResultGridRow label={t("toolOutput.fieldTo")}>{send.to}</ResultGridRow>
          {send.via && <ResultGridRow label={t("toolOutput.fieldVia")}>{send.via}</ResultGridRow>}
          {send.mediaUrl !== undefined && (
            <ResultGridRow label={t("toolOutput.fieldMedia")}>
              {send.mediaUrl || "none"}
            </ResultGridRow>
          )}
        </ResultGrid>
      </ResultCard>
    );
  }

  // Fallback
  return <CodeBlock content={result} maxLines={20} />;
}
