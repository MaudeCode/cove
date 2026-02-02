/**
 * ToolCall
 *
 * Compact, inline tool call with expandable details.
 * Designed to feel native to chat, not like a separate UI element.
 *
 * For exec tools pending approval, shows inline approval buttons.
 */

import type { ComponentChildren } from "preact";
import { useState, useEffect } from "preact/hooks";
import { Clock } from "lucide-preact";
import type { ToolCall as ToolCallType } from "@/types/messages";
import { ChevronDownIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { JsonBlock } from "@/components/debug/JsonBlock";
import { t } from "@/lib/i18n";
import {
  execApprovalQueue,
  execApprovalBusy,
  execApprovalError,
  handleExecApprovalDecision,
} from "@/signals/exec";

interface ToolCallProps {
  toolCall: ToolCallType;
}

/**
 * Extract approval info from tool result if present
 */
function getApprovalInfo(result: unknown): { approvalId: string; expiresAtMs?: number } | null {
  if (!result || typeof result !== "object") return null;
  const details = (result as Record<string, unknown>).details;
  if (!details || typeof details !== "object") return null;
  const d = details as Record<string, unknown>;
  if (d.status !== "approval-pending") return null;
  const approvalId = d.approvalId ?? d.approvalSlug;
  if (typeof approvalId !== "string") return null;
  const expiresAtMs = typeof d.expiresAtMs === "number" ? d.expiresAtMs : undefined;
  return { approvalId, expiresAtMs };
}

/**
 * Format remaining time until expiration
 */
function formatRemaining(ms: number): string {
  const remaining = Math.max(0, ms);
  const totalSeconds = Math.floor(remaining / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}m ${totalSeconds % 60}s`;
}

export function ToolCall({ toolCall }: ToolCallProps) {
  // Always start collapsed - user can click to expand
  const [expanded, setExpanded] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);

  const duration =
    toolCall.completedAt && toolCall.startedAt ? toolCall.completedAt - toolCall.startedAt : null;

  // Check if this is an exec tool pending approval
  const approvalInfo = getApprovalInfo(toolCall.result);
  const pendingApproval = approvalInfo
    ? execApprovalQueue.value.find(
        (item) =>
          item.request.requestId === approvalInfo.approvalId ||
          item.request.requestId.startsWith(approvalInfo.approvalId),
      )
    : null;
  const isApprovalPending = !!pendingApproval;
  const busy = execApprovalBusy.value;
  const error = execApprovalError.value;

  // Update countdown for approval expiration
  useEffect(() => {
    if (!pendingApproval) return;

    const update = () => {
      setRemainingMs(pendingApproval.expiresAtMs - Date.now());
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [pendingApproval]);

  const statusConfig = getStatusConfig(toolCall.status, isApprovalPending);

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

        {/* Duration badge (only when not pending approval) */}
        {duration !== null && !isApprovalPending && (
          <span class="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded flex-shrink-0">
            {formatDuration(duration)}
          </span>
        )}

        {/* Approval timer (when pending) */}
        {isApprovalPending && (
          <span class="flex items-center gap-1 text-[10px] text-[var(--color-warning)] flex-shrink-0">
            <Clock class="w-3 h-3" />
            {remainingMs <= 0 ? t("exec.expired") : formatRemaining(remainingMs)}
          </span>
        )}

        {/* Expand chevron */}
        <ChevronDownIcon
          class="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0"
          open={expanded}
        />
      </button>

      {/* Approval action buttons (when pending) */}
      {isApprovalPending && (
        <div class="flex items-center justify-end gap-2 px-3 py-2 border-t border-[var(--color-border)] bg-[var(--color-warning)]/5">
          {error && <span class="text-xs text-[var(--color-error)] mr-auto">{error}</span>}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleExecApprovalDecision("deny")}
            disabled={busy || remainingMs <= 0}
          >
            {t("exec.deny")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleExecApprovalDecision("allow-always")}
            disabled={busy || remainingMs <= 0}
          >
            {t("exec.allowAlways")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleExecApprovalDecision("allow-once")}
            disabled={busy || remainingMs <= 0}
            loading={busy}
          >
            {t("exec.allowOnce")}
          </Button>
        </div>
      )}

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
          {toolCall.result !== undefined && !isApprovalPending && (
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
  // For JSON objects, use the syntax-highlighted JsonBlock
  if (typeof content === "object" && content !== null) {
    const json = JSON.stringify(content, null, 2);
    const lines = json.split("\n");
    const truncated = lines.length > maxLines;
    const displayText = truncated ? lines.slice(0, maxLines).join("\n") + "\n..." : json;

    if (error) {
      // Error styling takes precedence - use simple display
      return (
        <pre class="text-xs p-2 rounded-md overflow-x-auto font-mono leading-relaxed bg-[var(--color-error)]/10 text-[var(--color-error)] max-h-[300px]">
          {displayText}
        </pre>
      );
    }

    return <JsonBlock value={displayText} maxHeight="max-h-[300px]" />;
  }

  // For plain text content
  const text = String(content);
  const lines = text.split("\n");
  const truncated = lines.length > maxLines;
  const displayText = truncated ? lines.slice(0, maxLines).join("\n") + "\n..." : text;

  return (
    <pre
      class={`text-xs p-2 rounded-md overflow-x-auto font-mono leading-relaxed max-h-[300px] whitespace-pre-wrap ${
        error
          ? "bg-[var(--color-error)]/10 text-[var(--color-error)]"
          : "bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
      }`}
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

function getStatusConfig(status: string, isApprovalPending = false): StatusConfig {
  // Approval pending takes precedence
  if (isApprovalPending) {
    return { icon: "⏳", color: "text-[var(--color-warning)]" };
  }

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
