/**
 * ToolCallList
 *
 * Compact list of tool calls with visual grouping.
 */

import type { ToolCall as ToolCallType } from "@/types/messages";
import { ToolCall } from "./ToolCall";

interface ToolCallListProps {
  toolCalls: ToolCallType[];
}

export function ToolCallList({ toolCalls }: ToolCallListProps) {
  if (toolCalls.length === 0) return null;

  const hasMultiple = toolCalls.length > 1;

  return (
    <div class="space-y-1.5" role="list" aria-label="Tool calls">
      {hasMultiple && (
        <div class="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">
          {toolCalls.length} tools
        </div>
      )}
      {toolCalls.map((toolCall) => (
        <ToolCall key={toolCall.id} toolCall={toolCall} />
      ))}
    </div>
  );
}
