/**
 * ExecApprovalModal
 *
 * Modal overlay for interactive shell command approval.
 * Displayed when exec.ask is enabled and a command needs user approval.
 */

import { useEffect, useState, useCallback } from "preact/hooks";
import { Terminal, Shield, Clock, Server, User, FolderOpen, AlertTriangle } from "lucide-preact";
import { t } from "@/lib/i18n";
import { Modal } from "@/components/ui/Modal";
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
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

/**
 * Metadata row component for consistent styling
 */
function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Terminal;
  label: string;
  value?: string | null;
}) {
  if (!value) return null;

  return (
    <div class="flex items-start gap-3 py-2">
      <Icon
        class="w-4 h-4 text-[var(--color-text-muted)] mt-0.5 flex-shrink-0"
        aria-hidden="true"
      />
      <div class="flex-1 min-w-0">
        <span class="text-xs text-[var(--color-text-muted)] block">{label}</span>
        <span class="text-sm text-[var(--color-text-primary)] break-all">{value}</span>
      </div>
    </div>
  );
}

export function ExecApprovalModal() {
  const active = activeApproval.value;
  const count = pendingCount.value;
  const busy = execApprovalBusy.value;
  const error = execApprovalError.value;

  // Countdown timer state
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

  // Handle decision
  const handleDecision = useCallback(async (decision: ExecApprovalDecision) => {
    await handleExecApprovalDecision(decision);
  }, []);

  // Don't render if no active approval
  if (!active) return null;

  const request = active.request;
  const isExpired = remainingMs <= 0;
  const expiresText = isExpired
    ? t("exec.expired")
    : t("exec.expiresIn", { time: formatRemaining(remainingMs) });

  return (
    <Modal
      open={true}
      onClose={() => {}} // Can't dismiss without decision
      title={t("exec.approvalNeeded")}
      size="lg"
      hideCloseButton
      closeOnBackdrop={false}
      closeOnEscape={false}
      footer={
        <div class="flex flex-col gap-3">
          {/* Error message */}
          {error && (
            <div class="flex items-center gap-2 text-sm text-[var(--color-error)] bg-[var(--color-error)]/10 px-3 py-2 rounded-lg">
              <AlertTriangle class="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action buttons */}
          <div class="flex flex-wrap gap-2 justify-end">
            <Button
              variant="primary"
              onClick={() => handleDecision("allow-once")}
              disabled={busy || isExpired}
              loading={busy}
            >
              {t("exec.allowOnce")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleDecision("allow-always")}
              disabled={busy || isExpired}
            >
              {t("exec.allowAlways")}
            </Button>
            <Button
              variant="danger"
              onClick={() => handleDecision("deny")}
              disabled={busy || isExpired}
            >
              {t("exec.deny")}
            </Button>
          </div>
        </div>
      }
    >
      {/* Header info */}
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <Clock class="w-4 h-4 text-[var(--color-text-muted)]" />
          <span
            class={`text-sm ${isExpired ? "text-[var(--color-error)]" : "text-[var(--color-text-secondary)]"}`}
          >
            {expiresText}
          </span>
        </div>

        {count > 1 && <Badge variant="warning">{t("exec.pendingCount", { count })}</Badge>}
      </div>

      {/* Command display */}
      <div class="mb-4">
        <label class="text-xs text-[var(--color-text-muted)] mb-1 block">{t("exec.command")}</label>
        <div
          class="
            font-mono text-sm
            bg-[var(--color-bg-primary)]
            border border-[var(--color-border)]
            rounded-lg p-3
            overflow-x-auto
            whitespace-pre-wrap break-all
            text-[var(--color-text-primary)]
          "
        >
          {request.command}
        </div>
      </div>

      {/* Metadata */}
      <div class="border-t border-[var(--color-border)] pt-3 space-y-1">
        <MetaRow icon={Server} label={t("exec.host")} value={request.host} />
        <MetaRow icon={User} label={t("exec.agent")} value={request.agentId} />
        <MetaRow icon={Terminal} label={t("exec.session")} value={request.sessionKey} />
        <MetaRow icon={FolderOpen} label={t("exec.cwd")} value={request.cwd} />
        <MetaRow icon={Terminal} label={t("exec.resolved")} value={request.resolvedPath} />
        <MetaRow icon={Shield} label={t("exec.security")} value={request.security} />
        <MetaRow icon={Shield} label={t("exec.askMode")} value={request.ask} />
      </div>
    </Modal>
  );
}
