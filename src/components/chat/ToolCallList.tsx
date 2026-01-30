/**
 * ToolCallList
 *
 * List of tool calls in a message.
 */

import type { ToolCall as ToolCallType } from "@/types/messages";
import { ToolCall } from "./ToolCall";

interface ToolCallListProps {
  toolCalls: ToolCallType[];
}

export function ToolCallList({ toolCalls }: ToolCallListProps) {
  if (toolCalls.length === 0) return null;

  return (
    <div class="space-y-2" role="list" aria-label="Tool calls">
      {toolCalls.map((toolCall) => (
        <ToolCall key={toolCall.id} toolCall={toolCall} />
      ))}
    </div>
  );
}
