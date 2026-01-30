/**
 * Chat Types
 *
 * Types for chat messages and streaming.
 */

import type { Message } from "./messages";

/** Content block in a message */
export interface ContentBlock {
  type: "text" | "tool_use" | "tool_result" | "image";
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  content?: unknown;
}

/** Raw message from gateway (before normalization) */
export interface RawMessage {
  role: "user" | "assistant" | "system";
  content: string | ContentBlock[];
  timestamp?: number;
  stopReason?: string;
  usage?: {
    input?: number;
    output?: number;
    totalTokens?: number;
  };
}

/** Chat history response */
export interface ChatHistoryResult {
  sessionKey: string;
  sessionId?: string;
  messages: RawMessage[];
  thinkingLevel?: string;
}

/** Chat send params */
export interface ChatSendParams {
  sessionKey: string;
  message: string;
  thinking?: string;
  idempotencyKey: string;
  timeoutMs?: number;
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

/** Active chat run state */
export interface ChatRun {
  runId: string;
  sessionKey: string;
  startedAt: number;
  status: "pending" | "streaming" | "complete" | "error" | "aborted";
  /** Accumulated content during streaming */
  content: string;
  /** Final message once complete */
  message?: Message;
  /** Error message if failed */
  error?: string;
}

/**
 * Normalize raw message content to string
 */
export function normalizeMessageContent(content: string | ContentBlock[]): string {
  if (typeof content === "string") {
    return content;
  }
  return content
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text)
    .join("\n");
}

/**
 * Convert raw message to normalized Message
 */
export function normalizeMessage(raw: RawMessage, id: string): Message {
  return {
    id,
    role: raw.role,
    content: normalizeMessageContent(raw.content),
    timestamp: raw.timestamp ?? Date.now(),
    isStreaming: false,
  };
}
