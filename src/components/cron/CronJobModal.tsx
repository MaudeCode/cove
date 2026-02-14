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
import { DeleteConfirmFooter, EditFooter } from "@/components/ui/ModalFooter";
import { CronJobForm } from "./CronJobForm";
import { formatSchedule, formatNextRun, formatLastRun, getJobStatusBadge } from "./cron-helpers";
import { Clock, Play, CheckCircle, XCircle } from "lucide-preact";
import type { CronJob, CronRunLogEntry } from "@/types/cron";

interface CronJobModalProps {
  mode: "create" | "edit" | null;
  job: CronJob | null;
  runs: CronRunLogEntry[];
  isLoadingRuns: boolean;
  isDeleting: boolean;
  isSaving: boolean;
  isRunning: boolean;
  /** Whether form has unsaved changes */
  hasChanges: boolean;
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
  editDeliveryAnnounce: Signal<boolean>;
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
  hasChanges,
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
  editDeliveryAnnounce,
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
        isDeleting ? (
          <DeleteConfirmFooter
            message={t("cron.confirmDelete")}
            onCancel={() => onSetDeleting(false)}
            onDelete={onDelete}
          />
        ) : (
          <EditFooter
            isEdit={isEdit && !!job}
            onDeleteClick={() => onSetDeleting(true)}
            onCancel={onClose}
            onSave={onSave}
            isSaving={isSaving}
            saveDisabled={!hasChanges}
            saveLabel={isEdit ? t("actions.save") : t("common.create")}
            extraContent={
              <div class="flex items-center justify-between sm:justify-start gap-2">
                <span class="text-sm text-[var(--color-text-secondary)]">
                  {editEnabled.value ? t("common.enabled") : t("common.disabled")}
                </span>
                <Toggle
                  checked={editEnabled.value}
                  onChange={(checked) => (editEnabled.value = checked)}
                />
              </div>
            }
          />
        )
      }
    >
      <div class="space-y-4 sm:space-y-6">
        {/* Status Summary (edit mode only) */}
        {isEdit && job && status && (
          <>
            <div class="flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:p-4 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
              <div class="flex items-center gap-3 flex-1 min-w-0">
                <div
                  class={`p-2 sm:p-3 rounded-xl flex-shrink-0 ${job.enabled ? "bg-[var(--color-success)]/10" : "bg-[var(--color-bg-tertiary)]"}`}
                >
                  <Clock
                    class={`w-5 h-5 sm:w-6 sm:h-6 ${job.enabled ? "text-[var(--color-success)]" : "text-[var(--color-text-muted)]"}`}
                  />
                </div>
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-1.5 mb-1">
                    <Badge variant={status.variant} size="sm">
                      {status.label}
                    </Badge>
                    <Badge variant={job.sessionTarget === "main" ? "success" : "default"} size="sm">
                      {job.sessionTarget}
                    </Badge>
                  </div>
                  <div class="text-xs sm:text-sm text-[var(--color-text-muted)] truncate">
                    {formatSchedule(job.schedule)}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                icon={<Play class="w-4 h-4" />}
                onClick={() => onRun(job)}
                disabled={isRunning}
                fullWidth
                class="sm:w-auto"
              >
                {t("cron.runNow")}
              </Button>
            </div>

            <div class="grid grid-cols-3 gap-2 sm:gap-4">
              <MiniStat value={formatNextRun(job)} label={t("common.nextRun")} />
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
          editDeliveryAnnounce={editDeliveryAnnounce}
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
                {runs.map((run) => (
                  <div
                    key={run.runAtMs}
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
