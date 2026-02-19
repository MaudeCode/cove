/**
 * Message Types
 *
 * CRITICAL: These types are used for BOTH streaming and history.
 * The same Message type must work for both cases.
 *
 * @see "Streaming = History" principle in ROADMAP.md
 */

/** Message send status */
export type MessageStatus = "queued" | "sending" | "sent" | "failed";

/** Image in a message */
export interface MessageImage {
  /** Data URL (data:image/...;base64,...) or URL. Can be empty for omitted placeholders. */
  url: string;
  /** Alt text */
  alt?: string;
  /** True when gateway omitted image bytes from history payload. */
  omitted?: boolean;
  /** Original image size in bytes (when omitted). */
  bytes?: number;
}

export interface Message {
  /** Unique message ID */
  id: string;

  /** Who sent this message */
  role: "user" | "assistant" | "system";

  /** Message content (markdown) */
  content: string;

  /** Images attached to this message */
  images?: MessageImage[];

  /** Tool calls made in this message (assistant only) */
  toolCalls?: ToolCall[];

  /** Thinking/reasoning content (assistant only) */
  thinking?: string;

  /** When the message was created */
  timestamp: number;

  /** Whether this message is currently streaming */
  isStreaming?: boolean;

  /** Send status for user messages */
  status?: MessageStatus;

  /** Error message if send failed */
  error?: string;

  /** Session key (for retry) */
  sessionKey?: string;

  /** Message kind for special rendering (e.g., compaction dividers) */
  kind?: "compaction";
}

export interface ToolCall {
  /** Unique tool call ID */
  id: string;

  /** Tool name (e.g., "read", "exec", "write") */
  name: string;

  /** Arguments passed to the tool */
  args?: Record<string, unknown>;

  /** Tool result (once complete) */
  result?: unknown;

  /** Current status */
  status: "pending" | "running" | "complete" | "error";

  /** When the tool call started */
  startedAt?: number;

  /** When the tool call completed */
  completedAt?: number;

  /** Position in content string where this tool call was inserted (for interleaved rendering) */
  insertedAtContentLength?: number;

  /** Content snapshot when tool started (for calculating final insertion position) */
  contentSnapshotAtStart?: string;
}
