/**
 * ToolCall
 *
 * Compact, inline tool call with expandable details.
 * Designed to feel native to chat, not like a separate UI element.
 */

import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import type { ToolCall as ToolCallType } from "@/types/messages";
import { ChevronDownIcon, Spinner } from "@/components/ui";

interface ToolCallProps {
  toolCall: ToolCallType;
}

export function ToolCall({ toolCall }: ToolCallProps) {
  // Always start collapsed - user can click to expand
  const [expanded, setExpanded] = useState(false);

  const duration =
    toolCall.completedAt && toolCall.startedAt ? toolCall.completedAt - toolCall.startedAt : null;

  const statusConfig = getStatusConfig(toolCall.status);

  return (
    <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden">
      {/* Compact summary row */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--color-bg-secondary)] transition-colors"
        aria-expanded={expanded}
      >
        {/* Status icon */}
        <span class={`text-sm flex-shrink-0 ${statusConfig.color}`}>{statusConfig.icon}</span>

        {/* Tool name */}
        <code class="text-xs font-medium text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded">
          {toolCall.name}
        </code>

        {/* Brief summary */}
        <span class="text-xs text-[var(--color-text-muted)] truncate flex-1">
          {getToolSummary(toolCall)}
        </span>

        {/* Duration badge */}
        {duration !== null && (
          <span class="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded flex-shrink-0">
            {formatDuration(duration)}
          </span>
        )}

        {/* Expand chevron */}
        <ChevronDownIcon
          class="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0"
          open={expanded}
        />
      </button>

      {/* Expanded details */}
      {expanded && (
        <div class="px-3 py-2 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] space-y-3">
          {/* Arguments */}
          {toolCall.args && Object.keys(toolCall.args).length > 0 && (
            <ToolSection label="Input">
              <CodeBlock content={toolCall.args} />
            </ToolSection>
          )}

          {/* Result */}
          {toolCall.result !== undefined && (
            <ToolSection label="Output">
              <CodeBlock
                content={toolCall.result}
                maxLines={20}
                error={toolCall.status === "error"}
              />
            </ToolSection>
          )}

          {/* Error without result */}
          {toolCall.status === "error" && !toolCall.result && (
            <div class="text-xs text-[var(--color-error)]">Tool execution failed</div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

interface ToolSectionProps {
  label: string;
  children: preact.ComponentChildren;
}

function ToolSection({ label, children }: ToolSectionProps) {
  return (
    <div>
      <div class="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1">
        {label}
      </div>
      {children}
    </div>
  );
}

interface CodeBlockProps {
  content: unknown;
  maxLines?: number;
  error?: boolean;
}

function CodeBlock({ content, maxLines = 30, error = false }: CodeBlockProps) {
  const text = typeof content === "string" ? content : JSON.stringify(content, null, 2);
  const lines = text.split("\n");
  const truncated = lines.length > maxLines;
  const displayText = truncated ? lines.slice(0, maxLines).join("\n") + "\n..." : text;

  return (
    <pre
      class={`text-xs p-2 rounded-md overflow-x-auto font-mono leading-relaxed ${
        error
          ? "bg-[var(--color-error)]/10 text-[var(--color-error)]"
          : "bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
      }`}
      style={{ maxHeight: "300px" }}
    >
      {displayText}
    </pre>
  );
}

// ============================================
// Helpers
// ============================================

interface StatusConfig {
  icon: ComponentChildren;
  color: string;
}

function getStatusConfig(status: string): StatusConfig {
  switch (status) {
    case "pending":
      return { icon: "○", color: "text-[var(--color-text-muted)]" };
    case "running":
      return {
        icon: <Spinner size="xs" class="text-[var(--color-accent)]" />,
        color: "",
      };
    case "complete":
      return { icon: "✓", color: "text-[var(--color-success)]" };
    case "error":
      return { icon: "✗", color: "text-[var(--color-error)]" };
    default:
      return { icon: "○", color: "text-[var(--color-text-muted)]" };
  }
}

/**
 * Get brief summary of tool call based on common arg patterns
 */
function getToolSummary(toolCall: ToolCallType): string {
  const args = toolCall.args || {};

  // File operations
  if (args.path || args.file_path) {
    return truncatePath(String(args.path || args.file_path));
  }

  // Shell commands
  if (args.command) {
    return truncateText(String(args.command), 60);
  }

  // Search/query
  if (args.query) {
    return truncateText(String(args.query), 60);
  }

  // URLs
  if (args.url) {
    return truncateUrl(String(args.url));
  }

  // Actions
  if (args.action) {
    return String(args.action);
  }

  // Fallback: first meaningful string arg
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === "string" && value.length > 0 && !key.startsWith("_")) {
      return truncateText(value, 50);
    }
  }

  return "";
}

function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

function truncatePath(path: string): string {
  // Show filename with partial path context
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 2) return path;
  return "…/" + parts.slice(-2).join("/");
}

function truncateUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 30 ? u.pathname.slice(0, 30) + "…" : u.pathname;
    return u.hostname + path;
  } catch {
    return truncateText(url, 50);
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}
