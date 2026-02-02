/**
 * ExecApprovalCard
 *
 * Inline approval card for exec commands, styled like ToolCall.
 * Appears above the chat input when approval is needed.
 */

import { useState, useEffect } from "preact/hooks";
import { Terminal, Clock, ChevronDown, ChevronUp } from "lucide-preact";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  activeApproval,
  pendingCount,
  execApprovalBusy,
  execApprovalError,
  handleExecApprovalDecision,
} from "@/signals/exec";
import type { ExecApprovalDecision } from "@/types/exec";

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

export function ExecApprovalCard() {
  const active = activeApproval.value;
  const count = pendingCount.value;
  const busy = execApprovalBusy.value;
  const error = execApprovalError.value;

  const [expanded, setExpanded] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);

  // Update countdown every second
  useEffect(() => {
    if (!active) return;

    const update = () => {
      setRemainingMs(active.expiresAtMs - Date.now());
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [active]);

  // Don't render if no active approval
  if (!active) return null;

  const request = active.request;
  const isExpired = remainingMs <= 0;

  const handleDecision = async (decision: ExecApprovalDecision) => {
    await handleExecApprovalDecision(decision);
  };

  return (
    <div class="px-4 py-2 border-t border-[var(--color-border)] bg-[var(--color-bg-surface)]">
      <div class="max-w-3xl mx-auto">
        {/* Main card */}
        <div class="rounded-lg border border-[var(--color-warning)]/50 bg-[var(--color-warning)]/5 overflow-hidden">
          {/* Compact header row */}
          <div class="flex items-center gap-2 px-3 py-2">
            {/* Icon */}
            <Terminal class="w-4 h-4 text-[var(--color-warning)] flex-shrink-0" />

            {/* Label */}
            <span class="text-xs font-medium text-[var(--color-warning)]">
              {t("exec.approvalNeeded")}
            </span>

            {/* Command preview */}
            <code class="flex-1 text-xs text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] px-2 py-0.5 rounded truncate font-mono">
              {request.command}
            </code>

            {/* Timer */}
            <div class="flex items-center gap-1 text-xs text-[var(--color-text-muted)] flex-shrink-0">
              <Clock class="w-3 h-3" />
              <span class={isExpired ? "text-[var(--color-error)]" : ""}>
                {isExpired ? t("exec.expired") : formatRemaining(remainingMs)}
              </span>
            </div>

            {/* Queue count */}
            {count > 1 && (
              <Badge variant="warning" size="sm">
                +{count - 1}
              </Badge>
            )}

            {/* Expand toggle */}
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              class="p-1 hover:bg-[var(--color-bg-secondary)] rounded transition-colors"
              aria-label={expanded ? t("actions.collapse") : t("actions.expand")}
            >
              {expanded ? (
                <ChevronUp class="w-4 h-4 text-[var(--color-text-muted)]" />
              ) : (
                <ChevronDown class="w-4 h-4 text-[var(--color-text-muted)]" />
              )}
            </button>
          </div>

          {/* Expanded details */}
          {expanded && (
            <div class="px-3 py-2 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-xs space-y-1">
              {request.host && (
                <div class="flex gap-2">
                  <span class="text-[var(--color-text-muted)] w-16">Host</span>
                  <span class="text-[var(--color-text-primary)]">{request.host}</span>
                </div>
              )}
              {request.cwd && (
                <div class="flex gap-2">
                  <span class="text-[var(--color-text-muted)] w-16">CWD</span>
                  <span class="text-[var(--color-text-primary)] font-mono">{request.cwd}</span>
                </div>
              )}
              {request.agentId && (
                <div class="flex gap-2">
                  <span class="text-[var(--color-text-muted)] w-16">Agent</span>
                  <span class="text-[var(--color-text-primary)]">{request.agentId}</span>
                </div>
              )}
              {request.security && (
                <div class="flex gap-2">
                  <span class="text-[var(--color-text-muted)] w-16">Security</span>
                  <span class="text-[var(--color-text-primary)]">{request.security}</span>
                </div>
              )}
            </div>
          )}

          {/* Error message */}
          {error && (
            <div class="px-3 py-2 text-xs text-[var(--color-error)] bg-[var(--color-error)]/10 border-t border-[var(--color-border)]">
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div class="flex items-center justify-end gap-2 px-3 py-2 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]">
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleDecision("deny")}
              disabled={busy || isExpired}
            >
              {t("exec.deny")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleDecision("allow-always")}
              disabled={busy || isExpired}
            >
              {t("exec.allowAlways")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleDecision("allow-once")}
              disabled={busy || isExpired}
              loading={busy}
            >
              {t("exec.allowOnce")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
