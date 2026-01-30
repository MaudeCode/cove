/**
 * ToolCall
 *
 * Single tool call with expandable details.
 */

import { useState } from "preact/hooks";
import type { ToolCall as ToolCallType } from "@/types/messages";
import { Badge, Button, Card, ChevronDownIcon } from "@/components/ui";

interface ToolCallProps {
  toolCall: ToolCallType;
}

export function ToolCall({ toolCall }: ToolCallProps) {
  const [expanded, setExpanded] = useState(false);

  const statusVariant: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
    pending: "warning",
    running: "info",
    complete: "success",
    error: "error",
  };

  const statusIcons: Record<string, string> = {
    pending: "⏳",
    running: "⚡",
    complete: "✓",
    error: "✗",
  };

  const duration =
    toolCall.completedAt && toolCall.startedAt ? toolCall.completedAt - toolCall.startedAt : null;

  return (
    <Card padding="none" variant="outlined" class="overflow-hidden">
      {/* Summary row - always visible */}
      <Button
        variant="ghost"
        onClick={() => setExpanded(!expanded)}
        fullWidth
        class="justify-start px-3 py-2 rounded-none"
        aria-expanded={expanded}
      >
        {/* Status indicator */}
        <Badge variant={statusVariant[toolCall.status] || "default"} size="sm" class="mr-2">
          {statusIcons[toolCall.status] || "?"}
        </Badge>

        {/* Tool name */}
        <span class="font-medium text-[var(--color-text-primary)]">
          {formatToolName(toolCall.name)}
        </span>

        {/* Brief summary */}
        <span class="text-[var(--color-text-muted)] truncate flex-1 ml-2 text-left">
          {getToolSummary(toolCall)}
        </span>

        {/* Duration */}
        {duration !== null && (
          <span class="text-xs text-[var(--color-text-muted)] flex-shrink-0 ml-2">
            {formatDuration(duration)}
          </span>
        )}

        {/* Expand icon */}
        <ChevronDownIcon class="w-4 h-4 ml-2 text-[var(--color-text-muted)]" open={expanded} />
      </Button>

      {/* Expanded details */}
      {expanded && (
        <div class="px-3 py-2 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          {/* Arguments */}
          {toolCall.args && Object.keys(toolCall.args).length > 0 && (
            <div class="mb-2">
              <div class="text-xs font-medium text-[var(--color-text-muted)] mb-1">Arguments</div>
              <pre class="text-xs p-2 rounded bg-[var(--color-bg-primary)] overflow-x-auto">
                {JSON.stringify(toolCall.args, null, 2)}
              </pre>
            </div>
          )}

          {/* Result */}
          {toolCall.result !== undefined && (
            <div>
              <div class="text-xs font-medium text-[var(--color-text-muted)] mb-1">Result</div>
              <pre class="text-xs p-2 rounded bg-[var(--color-bg-primary)] overflow-x-auto max-h-64">
                {typeof toolCall.result === "string"
                  ? toolCall.result
                  : JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}

          {/* Error */}
          {toolCall.status === "error" && !toolCall.result && (
            <div class="text-sm text-[var(--color-error)]">Tool call failed</div>
          )}
        </div>
      )}
    </Card>
  );
}

// ============================================
// Helpers
// ============================================

/**
 * Format tool name for display
 */
function formatToolName(name: string): string {
  // Convert snake_case or camelCase to Title Case
  return name
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Get brief summary of tool call
 */
function getToolSummary(toolCall: ToolCallType): string {
  const args = toolCall.args || {};

  // Common patterns
  if (args.path || args.file_path) {
    return String(args.path || args.file_path);
  }
  if (args.command) {
    const cmd = String(args.command);
    return cmd.length > 50 ? cmd.slice(0, 50) + "..." : cmd;
  }
  if (args.query) {
    const q = String(args.query);
    return q.length > 50 ? q.slice(0, 50) + "..." : q;
  }
  if (args.url) {
    return String(args.url);
  }

  // Fallback: show first string arg
  for (const value of Object.values(args)) {
    if (typeof value === "string" && value.length > 0) {
      return value.length > 50 ? value.slice(0, 50) + "..." : value;
    }
  }

  return "";
}

/**
 * Format duration in ms to human readable
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}
