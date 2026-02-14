/**
 * ToolCall
 *
 * Compact, inline tool call with expandable details.
 * Designed to feel native to chat, not like a separate UI element.
 *
 * When an exec tool requires approval, buttons are shown inline.
 */

import type { ComponentChildren } from "preact";
import { useRef, useState, useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import type { ToolCall as ToolCallType } from "@/types/messages";
import { ChevronDownIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { t } from "@/lib/i18n";
import {
  execApprovalBusy,
  execApprovalError,
  resolvedApprovalIds,
  handleExecApprovalDecisionDirect,
} from "@/signals/exec";

/**
 * Module-level set to persist expanded state across re-renders.
 * Using a plain Set (not a signal) since we use local signals for reactivity.
 * Limited to prevent unbounded growth.
 */
const expandedToolCallIds = new Set<string>();
const MAX_EXPANDED_TRACKED = 100;

/** Clear expanded state (called when switching sessions) */
export function clearExpandedToolCalls(): void {
  expandedToolCallIds.clear();
}
import {
  CodeBlock,
  ReadInputBlock,
  WriteInputBlock,
  ExecCommandBlock,
  EditDiffBlock,
  SearchInputBlock,
  UrlInputBlock,
  ImageInputBlock,
  MemoryGetInputBlock,
  BrowserInputBlock,
  CronInputBlock,
  ResultBlock,
  parseErrorResult,
} from "./tool-blocks";

interface ToolCallProps {
  toolCall: ToolCallType;
}

/** Type guard for approval-pending result */
interface ApprovalPendingDetails {
  status: "approval-pending";
  approvalId: string;
  approvalSlug?: string;
  expiresAtMs: number;
  command: string;
  cwd?: string;
}

interface ApprovalPendingResult {
  details: ApprovalPendingDetails;
  content?: unknown[];
}

function isApprovalPending(result: unknown): result is ApprovalPendingResult {
  if (!result || typeof result !== "object") return false;
  const r = result as Record<string, unknown>;
  if (!r.details || typeof r.details !== "object") return false;
  const d = r.details as Record<string, unknown>;
  return d.status === "approval-pending" && typeof d.approvalId === "string";
}

export function ToolCall({ toolCall }: ToolCallProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Check initial state from module-level Set (persists across re-renders)
  const approvalPending = isApprovalPending(toolCall.result);
  const initialExpanded = expandedToolCallIds.has(toolCall.id) || approvalPending;

  // Use local signal for reactivity
  const expanded = useSignal(initialExpanded);

  // Sync to module-level Set when expanded changes
  const toggleExpanded = () => {
    const wasExpanded = expanded.value;
    expanded.value = !expanded.value;
    if (expanded.value) {
      // Limit Set size to prevent unbounded growth
      if (expandedToolCallIds.size >= MAX_EXPANDED_TRACKED) {
        const oldest = expandedToolCallIds.values().next().value;
        if (oldest) expandedToolCallIds.delete(oldest);
      }
      expandedToolCallIds.add(toolCall.id);
    } else {
      expandedToolCallIds.delete(toolCall.id);
      // Scroll collapsed block into view after DOM updates
      if (wasExpanded && containerRef.current) {
        requestAnimationFrame(() => {
          containerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      }
    }
  };

  // Expand when approval becomes pending
  useEffect(() => {
    if (approvalPending && !expanded.value) {
      expanded.value = true;
      expandedToolCallIds.add(toolCall.id);
    }
  }, [approvalPending, toolCall.id]);

  const duration =
    toolCall.completedAt && toolCall.startedAt ? toolCall.completedAt - toolCall.startedAt : null;

  // Check if result is an error (even if status says "complete")
  const hasErrorResult =
    toolCall.result !== undefined && parseErrorResult(toolCall.result) !== null;
  const effectiveStatus = hasErrorResult ? "error" : toolCall.status;
  const statusConfig = getStatusConfig(effectiveStatus, approvalPending);

  return (
    <div
      ref={containerRef}
      class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden"
    >
      {/* Compact summary row */}
      <button
        type="button"
        onClick={toggleExpanded}
        class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--color-bg-secondary)] transition-colors"
        aria-expanded={expanded.value}
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
          open={expanded.value}
        />
      </button>

      {/* Expanded details */}
      {expanded.value && (
        <div class="px-3 py-2 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] space-y-3">
          {/* Arguments - special handling for specific tools */}
          {toolCall.args && Object.keys(toolCall.args).length > 0 && (
            <ToolSection label="Input" raw={toolCall.args}>
              <InputBlock toolCall={toolCall} />
            </ToolSection>
          )}

          {/* Approval UI */}
          {approvalPending && (
            <ExecApprovalButtons
              approvalId={(toolCall.result as ApprovalPendingResult).details.approvalId}
              expiresAtMs={(toolCall.result as ApprovalPendingResult).details.expiresAtMs}
            />
          )}

          {/* Result (hide when approval pending - the command output isn't ready yet) */}
          {toolCall.result !== undefined && !approvalPending && (
            <ToolSection label="Output" raw={toolCall.result}>
              <ResultBlock
                result={toolCall.result}
                error={toolCall.status === "error"}
                toolName={toolCall.name}
                filePath={
                  (toolCall.args?.path as string | undefined) ??
                  (toolCall.args?.file_path as string | undefined)
                }
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
// Input Block Dispatcher
// ============================================

function InputBlock({ toolCall }: { toolCall: ToolCallType }) {
  const name = toolCall.name.toLowerCase();
  const args = toolCall.args as Record<string, unknown>;

  if (name === "edit") {
    return <EditDiffBlock args={args} />;
  }
  if (name === "exec" && args.command) {
    return <ExecCommandBlock args={args} />;
  }
  if (name === "read") {
    return <ReadInputBlock args={args} />;
  }
  if (name === "write") {
    return <WriteInputBlock args={args} />;
  }
  if (toolCall.name === "web_search" || toolCall.name === "memory_search") {
    return <SearchInputBlock args={args} />;
  }
  if (toolCall.name === "web_fetch") {
    return <UrlInputBlock args={args} />;
  }
  if (toolCall.name === "memory_get") {
    return <MemoryGetInputBlock args={args} />;
  }
  if (toolCall.name === "image") {
    return <ImageInputBlock args={args} />;
  }
  if (toolCall.name === "browser") {
    return <BrowserInputBlock args={args} />;
  }
  if (toolCall.name === "cron") {
    return <CronInputBlock args={args} />;
  }

  return <CodeBlock content={args} />;
}

// ============================================
// Sub-components
// ============================================

interface ExecApprovalButtonsProps {
  approvalId: string;
  expiresAtMs: number;
}

function ExecApprovalButtons({ approvalId, expiresAtMs }: ExecApprovalButtonsProps) {
  const busy = execApprovalBusy.value;
  const error = execApprovalError.value;
  const alreadyResolved = resolvedApprovalIds.value.get(approvalId);
  const [timeLeft, setTimeLeft] = useState<number>(Math.max(0, expiresAtMs - Date.now()));
  const [localDecision, setLocalDecision] = useState<string | null>(null);
  const resolvedDecision = alreadyResolved ?? localDecision;

  // Countdown timer
  useEffect(() => {
    const updateTimer = () => {
      const remaining = Math.max(0, expiresAtMs - Date.now());
      setTimeLeft(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAtMs]);

  // Handle decision directly with the approvalId
  const handleDecision = async (decision: "allow-once" | "allow-always" | "deny") => {
    try {
      await handleExecApprovalDecisionDirect(approvalId, decision);
      setLocalDecision(decision);
    } catch {
      // Error is handled by the signal
    }
  };

  // Already resolved - show which decision was made
  if (resolvedDecision) {
    const isDenied = resolvedDecision === "deny";
    return (
      <div
        class={`text-xs italic ${isDenied ? "text-[var(--color-error)]" : "text-[var(--color-success)]"}`}
        role="status"
        aria-live="polite"
      >
        {isDenied ? t("exec.denied") : t("common.approved")}
      </div>
    );
  }

  const expired = timeLeft <= 0;

  // Show expired if time ran out
  if (expired) {
    return <div class="text-xs text-[var(--color-text-muted)] italic">{t("exec.expired")}</div>;
  }

  return (
    <div class="space-y-2" role="region" aria-label={t("exec.approvalNeeded")} aria-live="polite">
      {/* Status line with timer */}
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-[var(--color-warning)]">
          {t("exec.approvalNeeded")}
        </span>
        <span
          class="text-[10px] text-[var(--color-text-muted)]"
          aria-label={t("exec.expiresIn", { time: `${Math.ceil(timeLeft / 1000)}s` })}
        >
          {Math.ceil(timeLeft / 1000)}s
        </span>
      </div>

      {/* Error message */}
      {error && (
        <div class="text-xs text-[var(--color-error)]" role="alert">
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div class="flex gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() => handleDecision("allow-once")}
          disabled={busy}
        >
          {t("exec.allowOnce")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleDecision("allow-always")}
          disabled={busy}
        >
          {t("exec.allowAlways")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => handleDecision("deny")} disabled={busy}>
          {t("exec.deny")}
        </Button>
      </div>
    </div>
  );
}

interface ToolSectionProps {
  label: string;
  children: preact.ComponentChildren;
  /** Raw data for toggle view */
  raw?: unknown;
}

/** Format raw data as pretty JSON, handling string JSON gracefully */
function formatRawJson(raw: unknown): string {
  // If it's a string, try to parse it as JSON first
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // Not valid JSON, return as-is
      return raw;
    }
  }
  return JSON.stringify(raw, null, 2);
}

function ToolSection({ label, children, raw }: ToolSectionProps) {
  const showRaw = useSignal(false);

  return (
    <div>
      <div class="flex items-center gap-2 mb-1">
        <span class="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">
          {label}
        </span>
        {raw !== undefined && (
          <button
            type="button"
            onClick={() => (showRaw.value = !showRaw.value)}
            class="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            aria-pressed={showRaw.value}
          >
            {showRaw.value ? t("toolBlock.showFormatted") : t("toolBlock.showRaw")}
          </button>
        )}
      </div>
      {showRaw.value && raw !== undefined ? (
        <CodeBlock content={formatRawJson(raw)} filePath="raw.json" maxLines={30} />
      ) : (
        children
      )}
    </div>
  );
}

// ============================================
// Helpers
// ============================================

interface StatusConfig {
  icon: ComponentChildren;
  color: string;
}

function getStatusConfig(status: string, approvalPending = false): StatusConfig {
  // Approval pending takes precedence - show warning state
  if (approvalPending) {
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
