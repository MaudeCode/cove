/**
 * CronJobModal
 *
 * Modal for creating/editing cron jobs with status summary and run history.
 */

import type { Signal } from "@preact/signals";
import { t, formatTimestamp } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/ui/Toggle";
import { MiniStat } from "@/components/ui/MiniStat";
import { CronJobForm } from "./CronJobForm";
import { formatSchedule, formatNextRun, formatLastRun, getJobStatusBadge } from "./cron-helpers";
import { Clock, Play, Trash2, CheckCircle, XCircle } from "lucide-preact";
import type { CronJob, CronRunLogEntry } from "@/types/cron";

interface CronJobModalProps {
  mode: "create" | "edit" | null;
  job: CronJob | null;
  runs: CronRunLogEntry[];
  isLoadingRuns: boolean;
  isDeleting: boolean;
  isSaving: boolean;
  isRunning: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  onRun: (job: CronJob) => void;
  onSetDeleting: (value: boolean) => void;
  // Form signals
  editName: Signal<string>;
  editDescription: Signal<string>;
  editEnabled: Signal<boolean>;
  editScheduleKind: Signal<"cron" | "every" | "at">;
  editScheduleExpr: Signal<string>;
  editScheduleTz: Signal<string>;
  editScheduleEveryMs: Signal<string>;
  editScheduleAtMs: Signal<string>;
  editSessionTarget: Signal<"main" | "isolated">;
  editWakeMode: Signal<"next-heartbeat" | "now">;
  editPayloadKind: Signal<"systemEvent" | "agentTurn">;
  editPayloadText: Signal<string>;
  editPayloadMessage: Signal<string>;
  editPayloadModel: Signal<string>;
  formErrors: Signal<Record<string, string>>;
}

export function CronJobModal({
  mode,
  job,
  runs,
  isLoadingRuns,
  isDeleting,
  isSaving,
  isRunning,
  onClose,
  onSave,
  onDelete,
  onRun,
  onSetDeleting,
  editName,
  editDescription,
  editEnabled,
  editScheduleKind,
  editScheduleExpr,
  editScheduleTz,
  editScheduleEveryMs,
  editScheduleAtMs,
  editSessionTarget,
  editWakeMode,
  editPayloadKind,
  editPayloadText,
  editPayloadMessage,
  editPayloadModel,
  formErrors,
}: CronJobModalProps) {
  if (!mode) return null;

  const isEdit = mode === "edit";
  const status = job ? getJobStatusBadge(job) : null;

  return (
    <Modal
      open={!!mode}
      onClose={onClose}
      title={isEdit && job ? job.name : t("cron.createJob")}
      size="xl"
      footer={
        <div class="flex items-center justify-between">
          <div>
            {isEdit &&
              job &&
              (isDeleting ? (
                <div class="flex items-center gap-2">
                  <span class="text-sm text-[var(--color-error)]">{t("cron.confirmDelete")}</span>
                  <Button size="sm" variant="ghost" onClick={() => onSetDeleting(false)}>
                    {t("actions.cancel")}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    icon={<Trash2 class="w-4 h-4" />}
                    onClick={onDelete}
                  >
                    {t("actions.delete")}
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 class="w-4 h-4" />}
                  onClick={() => onSetDeleting(true)}
                  class="text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
                >
                  {t("actions.delete")}
                </Button>
              ))}
          </div>
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <Toggle
                checked={editEnabled.value}
                onChange={(checked) => (editEnabled.value = checked)}
              />
              <span class="text-sm text-[var(--color-text-secondary)]">
                {editEnabled.value ? t("cron.enabled") : t("cron.disabled")}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <Button variant="secondary" onClick={onClose}>
                {t("actions.cancel")}
              </Button>
              <Button onClick={onSave} disabled={isSaving}>
                {isSaving ? (
                  <Spinner size="sm" />
                ) : isEdit ? (
                  t("actions.save")
                ) : (
                  t("actions.create")
                )}
              </Button>
            </div>
          </div>
        </div>
      }
    >
      <div class="space-y-6">
        {/* Status Summary (edit mode only) */}
        {isEdit && job && status && (
          <>
            <div class="flex items-center gap-4 p-4 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
              <div
                class={`p-3 rounded-xl ${job.enabled ? "bg-[var(--color-success)]/10" : "bg-[var(--color-bg-tertiary)]"}`}
              >
                <Clock
                  class={`w-6 h-6 ${job.enabled ? "text-[var(--color-success)]" : "text-[var(--color-text-muted)]"}`}
                />
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <Badge variant={status.variant} size="sm">
                    {status.label}
                  </Badge>
                  <Badge variant={job.sessionTarget === "main" ? "success" : "default"} size="sm">
                    {job.sessionTarget}
                  </Badge>
                </div>
                <div class="text-sm text-[var(--color-text-muted)]">
                  {formatSchedule(job.schedule)}
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                icon={<Play class="w-4 h-4" />}
                onClick={() => onRun(job)}
                disabled={isRunning}
              >
                {t("cron.runNow")}
              </Button>
            </div>

            <div class="grid grid-cols-3 gap-4">
              <MiniStat value={formatNextRun(job)} label={t("cron.nextRun")} />
              <MiniStat value={formatLastRun(job)} label={t("cron.lastRun")} />
              <MiniStat
                value={
                  job.state.lastDurationMs ? `${Math.round(job.state.lastDurationMs / 1000)}s` : "—"
                }
                label={t("cron.lastDuration")}
              />
            </div>
          </>
        )}

        {/* Edit Form */}
        <CronJobForm
          editName={editName}
          editDescription={editDescription}
          editScheduleKind={editScheduleKind}
          editScheduleExpr={editScheduleExpr}
          editScheduleTz={editScheduleTz}
          editScheduleEveryMs={editScheduleEveryMs}
          editScheduleAtMs={editScheduleAtMs}
          editSessionTarget={editSessionTarget}
          editWakeMode={editWakeMode}
          editPayloadKind={editPayloadKind}
          editPayloadText={editPayloadText}
          editPayloadMessage={editPayloadMessage}
          editPayloadModel={editPayloadModel}
          formErrors={formErrors}
        />

        {/* Recent Runs (edit mode only) */}
        {isEdit && (
          <div>
            <h4 class="text-sm font-medium mb-3">{t("cron.recentRuns")}</h4>
            {isLoadingRuns ? (
              <div class="flex justify-center py-4">
                <Spinner size="sm" />
              </div>
            ) : runs.length === 0 ? (
              <p class="text-sm text-[var(--color-text-muted)] text-center py-4">
                {t("cron.noRuns")}
              </p>
            ) : (
              <div class="space-y-2 max-h-48 overflow-y-auto">
                {runs.map((run, i) => (
                  <div
                    key={i}
                    class="flex items-center gap-3 p-2 rounded-lg bg-[var(--color-bg-secondary)] text-sm"
                  >
                    {run.status === "ok" ? (
                      <CheckCircle class="w-4 h-4 text-[var(--color-success)]" />
                    ) : run.status === "error" ? (
                      <XCircle class="w-4 h-4 text-[var(--color-error)]" />
                    ) : (
                      <Clock class="w-4 h-4 text-[var(--color-warning)]" />
                    )}
                    <span class="flex-1">{formatTimestamp(run.runAtMs)}</span>
                    {run.durationMs && (
                      <span class="text-[var(--color-text-muted)]">
                        {Math.round(run.durationMs / 1000)}s
                      </span>
                    )}
                    {run.error && (
                      <span
                        class="text-[var(--color-error)] truncate max-w-[200px]"
                        title={run.error}
                      >
                        {run.error}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
