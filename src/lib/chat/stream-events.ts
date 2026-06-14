import { mergeDeltaText } from "@/lib/streaming";
import type { ChatRun } from "@/types/chat";

export interface AssistantStreamMergeResult {
  content: string;
  lastBlockStart?: number;
}

/**
 * Merge assistant stream event text into the current run.
 *
 * Mirrors the gateway's resolveMergedAssistantText behavior:
 * - accumulated text can replace the current content when it is a prefix continuation
 * - delta appends directly, including after tool boundary resets
 * - accumulated text falls back to block-boundary detection when no delta is present
 */
export function mergeAssistantStreamContent(
  run: Pick<ChatRun, "content" | "lastBlockStart">,
  text: string | null,
  delta: string | null,
): AssistantStreamMergeResult | null {
  const existing = run.content;

  if (!existing) {
    return { content: text ?? delta ?? "", lastBlockStart: run.lastBlockStart };
  }

  if (text && text.startsWith(existing)) {
    return { content: text, lastBlockStart: run.lastBlockStart };
  }

  if (text && existing.startsWith(text) && !delta) {
    return { content: existing, lastBlockStart: run.lastBlockStart };
  }

  if (delta) {
    return { content: existing + delta, lastBlockStart: run.lastBlockStart };
  }

  if (!text) {
    return null;
  }

  return mergeDeltaText(existing, text, run.lastBlockStart);
}
