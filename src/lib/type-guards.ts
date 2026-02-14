/**
 * Type Guards
 *
 * Runtime type validation utilities for external data.
 */

import type { ContentBlock, ChatEvent, AgentEvent, RawMessage } from "@/types/chat";

// ============================================
// Content Block Type Guards
// ============================================

export function isTextBlock(block: ContentBlock): block is ContentBlock & { type: "text" } {
  return block.type === "text" && (typeof block.text === "string" || block.text === undefined);
}

export function isToolUseBlock(block: ContentBlock): block is ContentBlock & { type: "tool_use" } {
  return (
    block.type === "tool_use" && typeof block.id === "string" && typeof block.name === "string"
  );
}

export function isToolCallBlock(block: ContentBlock): block is ContentBlock & { type: "toolCall" } {
  return (
    block.type === "toolCall" && typeof block.id === "string" && typeof block.name === "string"
  );
}

export function isToolResultBlock(
  block: ContentBlock,
): block is ContentBlock & { type: "tool_result" } {
  return block.type === "tool_result" && typeof block.id === "string";
}

export function isImageBlock(block: ContentBlock): block is ContentBlock & { type: "image" } {
  return (
    block.type === "image" && (block.source?.type === "base64" || typeof block.data === "string")
  );
}

export function isThinkingBlock(block: ContentBlock): block is ContentBlock & { type: "thinking" } {
  return block.type === "thinking";
}

// ============================================
// Chat Event Type Guards
// ============================================

export function isChatEvent(data: unknown): data is ChatEvent {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.runId === "string" &&
    typeof obj.sessionKey === "string" &&
    typeof obj.seq === "number" &&
    typeof obj.state === "string" &&
    ["delta", "final", "aborted", "error"].includes(obj.state as string)
  );
}

export function isAgentEvent(data: unknown): data is AgentEvent {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.runId === "string" &&
    typeof obj.stream === "string" &&
    ["lifecycle", "assistant", "tool", "error", "compaction", "thinking"].includes(
      obj.stream as string,
    ) &&
    typeof obj.seq === "number" &&
    typeof obj.ts === "number"
  );
}

// ============================================
// Raw Message Type Guards
// ============================================

export function isRawMessage(data: unknown): data is RawMessage {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.role === "string" &&
    ["user", "assistant", "system", "toolResult"].includes(obj.role as string) &&
    (typeof obj.content === "string" || Array.isArray(obj.content))
  );
}

export function isContentBlockArray(data: unknown): data is ContentBlock[] {
  if (!Array.isArray(data)) return false;
  return data.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).type === "string",
  );
}

// ============================================
// Generic Object Validation
// ============================================

/**
 * Safely access a nested property with type validation
 */
export function getNestedValue<T>(
  obj: unknown,
  path: string[],
  validator: (value: unknown) => value is T,
): T | undefined {
  let current: unknown = obj;

  for (const key of path) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return validator(current) ? current : undefined;
}

/**
 * Type guard for string values
 */
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

/**
 * Type guard for number values
 */
export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

/**
 * Type guard for boolean values
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/**
 * Type guard for non-null objects
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Type guard for arrays
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}
