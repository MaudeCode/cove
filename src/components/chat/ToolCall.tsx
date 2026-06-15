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
import { t, formatDuration } from "@/lib/i18n";
import {
  execApprovalBusy,
  execApprovalError,
  resolvedApprovalIds,
  handleExecApprovalDecisionDirect,
} from "@/signals/exec";
import {
  getToolInputBlockKind,
  getToolLabel,
  getToolPreview,
  getToolResultPreview,
  humanizeAction,
} from "./tool-registry";

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
  SessionStatusInputBlock,
  MessageInputBlock,
  GatewayInputBlock,
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

  const effectiveStatus = getEffectiveStatus(toolCall);
  const statusConfig = getStatusConfig(effectiveStatus, approvalPending);
  const summary = getToolCallSummary(toolCall);

  return (
    <div
      ref={containerRef}
      class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden"
      data-tool-name={toolCall.name}
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

        <div class="min-w-0 flex-1">
          <div class="flex min-w-0 items-center gap-2">
            {/* Tool name */}
            <span
              class="text-xs font-medium text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded flex-shrink-0"
              title={toolCall.name}
            >
              {summary.label}
            </span>

            {/* Brief summary */}
            {summary.preview && (
              <span
                class="text-xs text-[var(--color-text-secondary)] truncate min-w-0"
                title={summary.fullPreview ?? summary.preview}
              >
                {summary.preview}
              </span>
            )}
          </div>
          {summary.resultPreview && (
            <div
              class="mt-0.5 text-[11px] text-[var(--color-text-muted)] truncate"
              title={summary.resultPreview}
            >
              {summary.resultPreview}
            </div>
          )}
        </div>

        <span class="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded flex-shrink-0">
          {summary.statusLabel}
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
          <ToolCallDetails toolCall={toolCall} />
        </div>
      )}
    </div>
  );
}

export function ToolCallDetails({ toolCall }: ToolCallProps) {
  const approvalPending = isApprovalPending(toolCall.result);

  return (
    <>
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
    </>
  );
}

// ============================================
// Input Block Dispatcher
// ============================================

function InputBlock({ toolCall }: { toolCall: ToolCallType }) {
  const args = toolCall.args as Record<string, unknown>;

  switch (getToolInputBlockKind(toolCall.name, args)) {
    case "browser":
      return <BrowserInputBlock args={args} />;
    case "cron":
      return <CronInputBlock args={args} />;
    case "edit":
      return <EditDiffBlock args={args} />;
    case "exec":
      return <ExecCommandBlock args={args} />;
    case "gateway":
      return <GatewayInputBlock args={args} />;
    case "image":
      return <ImageInputBlock args={args} />;
    case "memory-get":
      return <MemoryGetInputBlock args={args} />;
    case "message":
      return <MessageInputBlock args={args} />;
    case "read":
      return <ReadInputBlock args={args} />;
    case "search":
      return <SearchInputBlock args={args} />;
    case "session-status":
      return <SessionStatusInputBlock args={args} />;
    case "url":
      return <UrlInputBlock args={args} />;
    case "write":
      return <WriteInputBlock args={args} />;
    case "code":
      return <CodeBlock content={args} />;
  }
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
interface SummaryOptions {
  approvalPending: boolean;
  effectiveStatus: string;
}

export interface ToolSummary {
  label: string;
  preview?: string;
  fullPreview?: string;
  resultPreview?: string;
  statusLabel: string;
}

export function getToolCallSummary(toolCall: ToolCallType): ToolSummary {
  return getToolSummary(toolCall, {
    approvalPending: isApprovalPending(toolCall.result),
    effectiveStatus: getEffectiveStatus(toolCall),
  });
}

function getToolSummary(toolCall: ToolCallType, options: SummaryOptions): ToolSummary {
  const args = toolCall.args || {};
  const label = getToolLabel(toolCall.name, args);
  const preview = getToolPreview(toolCall);
  const resultPreview = getToolResultPreview(toolCall);

  return {
    label,
    preview: preview ? truncateText(preview, 96) : undefined,
    fullPreview: preview,
    resultPreview: resultPreview ? truncateText(resultPreview, 120) : undefined,
    statusLabel: getStatusLabel(options.effectiveStatus, options.approvalPending, toolCall.result),
  };
}

function getEffectiveStatus(toolCall: ToolCallType): string {
  const hasErrorResult =
    toolCall.result !== undefined && parseErrorResult(toolCall.result) !== null;
  return hasErrorResult ? "error" : toolCall.status;
}

function getStatusLabel(status: string, approvalPending: boolean, result: unknown): string {
  if (approvalPending) return "Needs approval";
  if (parseErrorResult(result) !== null) return "Failed";

  switch (status) {
    case "pending":
      return "Pending";
    case "running":
      return "Running";
    case "complete":
      return result === undefined ? "Done" : "Result ready";
    case "error":
      return "Failed";
    default:
      return humanizeAction(status);
  }
}

function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}
