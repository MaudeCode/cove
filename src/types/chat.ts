/**
 * Chat Types
 *
 * Types for chat messages and streaming.
 */

import type { Message, ToolCall, MessageImage } from "./messages";

// ============================================
// Content Block Types (Discriminated Union)
// ============================================

/** Text content block */
export interface TextBlock {
  type: "text";
  text: string;
}

/** Tool use content block (Anthropic format) */
export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input?: Record<string, unknown>;
}

/** Tool call content block (OpenClaw history format) */
export interface ToolCallBlock {
  type: "toolCall";
  id: string;
  name: string;
  arguments?: Record<string, unknown>;
}

/** Tool result content block */
export interface ToolResultBlock {
  type: "tool_result";
  id: string;
  content?: unknown;
}

/** Image content block (Anthropic format) */
export interface ImageBlock {
  type: "image";
  source?: {
    type: "base64";
    media_type: string;
    data: string;
  };
  /** Alternative format: data URL or base64 */
  data?: string;
  mimeType?: string;
}

/** Thinking/reasoning content block */
export interface ThinkingBlock {
  type: "thinking";
  thinking?: string;
}

/** Union type for all content blocks */
export type ContentBlock =
  | TextBlock
  | ToolUseBlock
  | ToolCallBlock
  | ToolResultBlock
  | ImageBlock
  | ThinkingBlock;

/** Raw message from gateway (before normalization) */
export interface RawMessage {
  role: "user" | "assistant" | "system" | "toolResult";
  content: string | ContentBlock[];
  timestamp?: number;
  stopReason?: string;
  // Tool result fields (when role === "toolResult")
  toolCallId?: string;
  toolName?: string;
  isError?: boolean;
  details?: unknown;
  usage?: {
    input?: number;
    output?: number;
    totalTokens?: number;
  };
  /** OpenClaw metadata (e.g., compaction markers injected by gateway) */
  __openclaw?: {
    kind?: string;
    id?: string;
  };
}

/** Chat history response */
export interface ChatHistoryResult {
  sessionKey: string;
  sessionId?: string;
  messages: RawMessage[];
  thinkingLevel?: string;
}

/** Chat send response (immediate ack) */
export interface ChatSendResult {
  runId: string;
  status: "started" | "in_flight" | "ok" | "error";
  summary?: string;
}

/** Chat event from gateway (streaming) */
export interface ChatEvent {
  runId: string;
  sessionKey: string;
  seq: number;
  state: "delta" | "final" | "aborted" | "error";
  message?: RawMessage;
  errorMessage?: string;
  usage?: {
    input?: number;
    output?: number;
    totalTokens?: number;
  };
  stopReason?: string;
}

/** Agent event from gateway (includes tool events) */
export interface AgentEvent {
  runId: string;
  sessionKey?: string;
  stream: "lifecycle" | "assistant" | "tool" | "error" | "compaction";
  seq: number;
  ts: number;
  data?: {
    phase?: "start" | "update" | "result" | "end" | "error";
    name?: string;
    toolCallId?: string;
    args?: unknown;
    partialResult?: unknown;
    result?: unknown;
    isError?: boolean;
    meta?: string;
    text?: string;
    delta?: string;
  };
}

/** Active chat run state */
export interface ChatRun {
  runId: string;
  sessionKey: string;
  startedAt: number;
  status: "pending" | "streaming" | "complete" | "error" | "aborted";
  /** Accumulated text content during streaming */
  content: string;
  /** Tool calls accumulated during streaming */
  toolCalls: ToolCall[];
  /** Position where we last appended a new text block (for continuation detection) */
  lastBlockStart?: number;
  /** Final message once complete */
  message?: Message;
  /** Error message if failed */
  error?: string;
}

/** Parsed content from raw message */
export interface ParsedContent {
  text: string;
  toolCalls: ToolCall[];
  images: MessageImage[];
}

/**
 * Parse raw message content into text, tool calls, and images
 * Also calculates insertedAtContentLength for proper interleaved rendering
 */
export function parseMessageContent(content: string | ContentBlock[]): ParsedContent {
  if (typeof content === "string") {
    return { text: content, toolCalls: [], images: [] };
  }

  const textParts: string[] = [];
  const toolCalls: ToolCall[] = [];
  const images: MessageImage[] = [];
  let currentTextLength = 0;

  for (const block of content) {
    switch (block.type) {
      case "text": {
        textParts.push(block.text);
        currentTextLength += block.text.length;
        break;
      }

      case "image": {
        // Handle different image formats
        if (block.source?.type === "base64" && block.source.data) {
          // Anthropic format: { type: "base64", media_type: "image/png", data: "..." }
          images.push({
            url: `data:${block.source.media_type};base64,${block.source.data}`,
            alt: "Image",
          });
        } else if (block.data) {
          // Alternative format: { data: "base64...", mimeType: "image/png" }
          const url = block.data.startsWith("data:")
            ? block.data
            : `data:${block.mimeType || "image/png"};base64,${block.data}`;
          images.push({ url, alt: "Image" });
        }
        break;
      }

      case "tool_use": {
        toolCalls.push({
          id: block.id,
          name: block.name,
          args: block.input,
          status: "running",
          startedAt: Date.now(),
          insertedAtContentLength: currentTextLength,
        });
        break;
      }

      case "toolCall": {
        // OpenClaw history format uses "toolCall" with "arguments"
        toolCalls.push({
          id: block.id,
          name: block.name,
          args: block.arguments,
          status: "pending",
          insertedAtContentLength: currentTextLength,
        });
        break;
      }

      case "tool_result": {
        // Find matching tool call and update its result
        const existing = toolCalls.find((tc) => tc.id === block.id);
        if (existing) {
          existing.result = block.content;
          existing.status = "complete";
          existing.completedAt = Date.now();
        }
        break;
      }

      case "thinking":
        // Ignore thinking blocks for now
        break;
    }
  }

  return {
    text: textParts.join("\n"),
    toolCalls,
    images,
  };
}

/**
 * Convert raw message to normalized Message with tool calls.
 * Note: Only call with user/assistant/system roles - skip toolResult messages.
 */
export function normalizeMessage(raw: RawMessage, id: string): Message {
  const parsed = parseMessageContent(raw.content);
  // Filter role - toolResult should not be passed here (they're merged into assistant messages)
  const role = raw.role === "toolResult" ? "assistant" : raw.role;
  const msg: Message = {
    id,
    role,
    content: parsed.text,
    images: parsed.images.length > 0 ? parsed.images : undefined,
    toolCalls: parsed.toolCalls.length > 0 ? parsed.toolCalls : undefined,
    timestamp: raw.timestamp ?? Date.now(),
    isStreaming: false,
  };

  // Carry through structured compaction markers from gateway
  if (raw.__openclaw?.kind === "compaction") {
    msg.kind = "compaction";
  }

  return msg;
}

/**
 * Merge tool calls from new content into existing tool calls
 * (updates status, results, adds new ones)
 */
export function mergeToolCalls(existing: ToolCall[], incoming: ToolCall[]): ToolCall[] {
  const merged = new Map<string, ToolCall>();

  // Add existing first
  for (const tc of existing) {
    merged.set(tc.id, { ...tc });
  }

  // Merge/update with incoming
  for (const tc of incoming) {
    const prev = merged.get(tc.id);
    if (prev) {
      // Update existing - take latest status and result
      merged.set(tc.id, {
        ...prev,
        ...tc,
        // Keep earlier startedAt
        startedAt: prev.startedAt ?? tc.startedAt,
      });
    } else {
      // New tool call
      merged.set(tc.id, tc);
    }
  }

  return Array.from(merged.values());
}
