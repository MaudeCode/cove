/**
 * CronView
 *
 * Cron job management with table layout, create/edit modals.
 * Route: /cron
 */

import { signal, computed } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { t, formatTimestamp } from "@/lib/i18n";
import { send, isConnected } from "@/lib/gateway";
import { getErrorMessage } from "@/lib/session-utils";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { IconButton } from "@/components/ui/IconButton";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { CronJobRow, CronJobCard, CronJobModal, isValidCronExpr } from "@/components/cron";
import { RefreshCw, Search, Plus, Clock, CheckCircle, XCircle, Zap } from "lucide-preact";
import { ViewErrorBoundary } from "@/components/ui/ViewErrorBoundary";
import type {
  CronJob,
  CronSchedule,
  CronPayload,
  CronStatusResult,
  CronListResult,
  CronRunLogEntry,
  CronRunsResult,
} from "@/types/cron";
import type { RouteProps } from "@/types/routes";

// ============================================
// State
// ============================================

const cronJobs = signal<CronJob[]>([]);
const cronStatus = signal<CronStatusResult | null>(null);
const isLoading = signal<boolean>(false);
const error = signal<string | null>(null);
const searchQuery = signal<string>("");
const statusFilter = signal<"all" | "enabled" | "disabled">("all");

// Modal state
type ModalMode = "create" | "edit" | null;
const modalMode = signal<ModalMode>(null);
const selectedJob = signal<CronJob | null>(null);
const selectedJobRuns = signal<CronRunLogEntry[]>([]);
const isLoadingRuns = signal<boolean>(false);
const isDeleting = signal<boolean>(false);
const isSaving = signal<boolean>(false);
const isRunning = signal<boolean>(false);

// Form signals
const editName = signal<string>("");
const editDescription = signal<string>("");
const editEnabled = signal<boolean>(true);
const editScheduleKind = signal<"cron" | "every" | "at">("cron");
const editScheduleExpr = signal<string>("");
const editScheduleTz = signal<string>("");
const editScheduleEveryMs = signal<string>("");
const editScheduleAtMs = signal<string>("");
const editWakeMode = signal<"next-heartbeat" | "now">("next-heartbeat");
const editSessionTarget = signal<"main" | "isolated">("main");
const editPayloadKind = signal<"systemEvent" | "agentTurn">("systemEvent");
const editPayloadText = signal<string>("");
const editPayloadMessage = signal<string>("");
const editPayloadModel = signal<string>("");
const formErrors = signal<Record<string, string>>({});

// ============================================
// Computed
// ============================================

const filteredJobs = computed(() => {
  let result = cronJobs.value;

  if (statusFilter.value === "enabled") {
    result = result.filter((j) => j.enabled);
  } else if (statusFilter.value === "disabled") {
    result = result.filter((j) => !j.enabled);
  }

  const query = searchQuery.value.toLowerCase().trim();
  if (query) {
    result = result.filter((j) => {
      const name = j.name.toLowerCase();
      const desc = (j.description || "").toLowerCase();
      return name.includes(query) || desc.includes(query);
    });
  }

  return [...result].sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    const aNext = a.state.nextRunAtMs ?? Infinity;
    const bNext = b.state.nextRunAtMs ?? Infinity;
    return aNext - bNext;
  });
});

const jobCounts = computed(() => {
  const counts = { total: 0, enabled: 0, disabled: 0 };
  for (const job of cronJobs.value) {
    counts.total++;
    if (job.enabled) counts.enabled++;
    else counts.disabled++;
  }
  return counts;
});

// ============================================
// Actions
// ============================================

async function loadCronJobs(): Promise<void> {
  isLoading.value = true;
  error.value = null;

  const [statusResult, listResult] = await Promise.allSettled([
    send<CronStatusResult>("cron.status", {}),
    send<CronListResult>("cron.list", { includeDisabled: true }),
  ]);

  // Handle status result
  if (statusResult.status === "fulfilled") {
    cronStatus.value = statusResult.value;
  }

  // Handle list result
  if (listResult.status === "fulfilled") {
    cronJobs.value = listResult.value.jobs ?? [];
  }

  // Show error if both failed, or partial error if one failed
  const errors: string[] = [];
  if (statusResult.status === "rejected") {
    errors.push(`Status: ${getErrorMessage(statusResult.reason)}`);
  }
  if (listResult.status === "rejected") {
    errors.push(`Jobs: ${getErrorMessage(listResult.reason)}`);
  }
  if (errors.length > 0) {
    error.value = errors.join("; ");
  }

  isLoading.value = false;
}

async function loadJobRuns(jobId: string): Promise<void> {
  isLoadingRuns.value = true;
  try {
    const result = await send<CronRunsResult>("cron.runs", { jobId, limit: 20 });
    selectedJobRuns.value = result.entries ?? [];
  } catch {
    selectedJobRuns.value = [];
  } finally {
    isLoadingRuns.value = false;
  }
}

function openJobModal(mode: "create" | "edit", job?: CronJob) {
  if (mode === "edit" && job) {
    selectedJob.value = job;
    populateEditForm(job);
    loadJobRuns(job.id);
  } else {
    selectedJob.value = null;
    resetEditForm();
    selectedJobRuns.value = [];
  }
  modalMode.value = mode;
}

function populateEditForm(job: CronJob) {
  editName.value = job.name;
  editDescription.value = job.description ?? "";
  editEnabled.value = job.enabled;
  editScheduleKind.value = job.schedule.kind;
  if (job.schedule.kind === "cron") {
    editScheduleExpr.value = job.schedule.expr;
    editScheduleTz.value = job.schedule.tz ?? "";
  } else if (job.schedule.kind === "every") {
    editScheduleEveryMs.value = String(job.schedule.everyMs);
  } else if (job.schedule.kind === "at") {
    editScheduleAtMs.value = String(job.schedule.atMs);
  }
  editWakeMode.value = job.wakeMode;
  editSessionTarget.value = job.sessionTarget;
  editPayloadKind.value = job.payload.kind;
  if (job.payload.kind === "systemEvent") {
    editPayloadText.value = job.payload.text;
  } else {
    editPayloadMessage.value = job.payload.message;
    editPayloadModel.value = job.payload.model ?? "";
  }
  formErrors.value = {};
}

function resetEditForm() {
  editName.value = "";
  editDescription.value = "";
  editEnabled.value = true;
  editScheduleKind.value = "cron";
  editScheduleExpr.value = "";
  editScheduleTz.value = "";
  editScheduleEveryMs.value = "";
  editScheduleAtMs.value = "";
  editWakeMode.value = "next-heartbeat";
  editSessionTarget.value = "main";
  editPayloadKind.value = "systemEvent";
  editPayloadText.value = "";
  editPayloadMessage.value = "";
  editPayloadModel.value = "";
  formErrors.value = {};
}

function validateForm(): boolean {
  const errors: Record<string, string> = {};

  if (!editName.value.trim()) {
    errors.name = t("cron.validation.nameRequired");
  }

  if (editScheduleKind.value === "cron") {
    if (!editScheduleExpr.value.trim()) {
      errors.schedule = t("cron.validation.cronRequired");
    } else if (!isValidCronExpr(editScheduleExpr.value)) {
      errors.schedule = t("cron.validation.cronInvalid");
    }
  } else if (editScheduleKind.value === "every") {
    const ms = parseInt(editScheduleEveryMs.value, 10);
    if (!ms || ms < 1000) {
      errors.schedule = t("cron.validation.intervalMin");
    }
  } else if (editScheduleKind.value === "at") {
    const ms = parseInt(editScheduleAtMs.value, 10);
    if (!ms || ms < Date.now()) {
      errors.schedule = t("cron.validation.atFuture");
    }
  }

  if (editSessionTarget.value === "main") {
    if (!editPayloadText.value.trim()) {
      errors.payload = t("cron.validation.payloadRequired");
    }
  } else {
    if (!editPayloadMessage.value.trim()) {
      errors.payload = t("cron.validation.payloadRequired");
    }
  }

  formErrors.value = errors;
  return Object.keys(errors).length === 0;
}

function closeModal() {
  modalMode.value = null;
  selectedJob.value = null;
  selectedJobRuns.value = [];
  isDeleting.value = false;
}

function buildSchedule(): CronSchedule {
  switch (editScheduleKind.value) {
    case "cron":
      return {
        kind: "cron",
        expr: editScheduleExpr.value,
        ...(editScheduleTz.value ? { tz: editScheduleTz.value } : {}),
      };
    case "every":
      return {
        kind: "every",
        everyMs: parseInt(editScheduleEveryMs.value, 10) || 60000,
      };
    case "at":
      return {
        kind: "at",
        atMs: parseInt(editScheduleAtMs.value, 10) || Date.now(),
      };
  }
}

function buildPayload(): CronPayload {
  if (editPayloadKind.value === "systemEvent") {
    return { kind: "systemEvent", text: editPayloadText.value };
  }
  return {
    kind: "agentTurn",
    message: editPayloadMessage.value,
    ...(editPayloadModel.value ? { model: editPayloadModel.value } : {}),
  };
}

async function saveOrCreateJob(): Promise<void> {
  if (!validateForm()) return;

  isSaving.value = true;
  try {
    if (modalMode.value === "edit" && selectedJob.value) {
      const patch = {
        name: editName.value,
        description: editDescription.value || undefined,
        enabled: editEnabled.value,
        schedule: buildSchedule(),
        sessionTarget: editSessionTarget.value,
        wakeMode: editWakeMode.value,
        payload: buildPayload(),
      };
      await send("cron.update", { jobId: selectedJob.value.id, patch });
    } else {
      const job = {
        name: editName.value,
        description: editDescription.value || undefined,
        enabled: editEnabled.value,
        schedule: buildSchedule(),
        sessionTarget: editSessionTarget.value,
        wakeMode: editWakeMode.value,
        payload: buildPayload(),
      };
      await send("cron.add", { job });
    }
    await loadCronJobs();
    closeModal();
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    isSaving.value = false;
  }
}

async function deleteJob(): Promise<void> {
  const job = selectedJob.value;
  if (!job) return;

  try {
    await send("cron.remove", { jobId: job.id });
    cronJobs.value = cronJobs.value.filter((j) => j.id !== job.id);
    closeModal();
  } catch (err) {
    error.value = getErrorMessage(err);
  }
}

async function runJobNow(job: CronJob): Promise<void> {
  isRunning.value = true;
  try {
    await send("cron.run", { jobId: job.id, mode: "force" });
    await loadCronJobs();
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    isRunning.value = false;
  }
}

async function toggleJobEnabled(job: CronJob): Promise<void> {
  try {
    await send("cron.update", { jobId: job.id, patch: { enabled: !job.enabled } });
    cronJobs.value = cronJobs.value.map((j) =>
      j.id === job.id ? { ...j, enabled: !j.enabled } : j,
    );
  } catch (err) {
    error.value = getErrorMessage(err);
  }
}

// ============================================
// Main View
// ============================================

export function CronView(_props: RouteProps) {
  useEffect(() => {
    if (isConnected.value) {
      loadCronJobs();
    }
  }, [isConnected.value]);

  const counts = jobCounts.value;

  return (
    <ViewErrorBoundary viewName={t("nav.cron")}>
      <div class="flex-1 overflow-y-auto p-4 sm:p-6">
        <div class="max-w-5xl mx-auto space-y-4 sm:space-y-6">
          <PageHeader
            title={t("cron.title")}
            subtitle={t("cron.description")}
            actions={
              <>
                {isConnected.value && !isLoading.value && cronJobs.value.length > 0 && (
                  <div class="relative hidden sm:block">
                    <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                    <Input
                      type="text"
                      value={searchQuery.value}
                      onInput={(e) => (searchQuery.value = (e.target as HTMLInputElement).value)}
                      placeholder={t("cron.searchPlaceholder")}
                      aria-label={t("cron.searchPlaceholder")}
                      class="pl-10 w-64"
                    />
                  </div>
                )}
                <Button
                  icon={<Plus class="w-4 h-4" />}
                  onClick={() => openJobModal("create")}
                  disabled={!isConnected.value}
                >
                  <span class="hidden sm:inline">{t("cron.createJob")}</span>
                  <span class="sm:hidden">{t("actions.new")}</span>
                </Button>
                <IconButton
                  icon={<RefreshCw class={`w-4 h-4 ${isLoading.value ? "animate-spin" : ""}`} />}
                  label={t("actions.refresh")}
                  onClick={loadCronJobs}
                  disabled={isLoading.value || !isConnected.value}
                  variant="ghost"
                />
              </>
            }
          />

          {/* Mobile Search */}
          {isConnected.value && !isLoading.value && cronJobs.value.length > 0 && (
            <div class="relative sm:hidden">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
              <Input
                type="text"
                value={searchQuery.value}
                onInput={(e) => (searchQuery.value = (e.target as HTMLInputElement).value)}
                placeholder={t("cron.searchPlaceholder")}
                aria-label={t("cron.searchPlaceholder")}
                class="pl-10"
                fullWidth
              />
            </div>
          )}

          {/* Stats Cards */}
          {isConnected.value && !isLoading.value && (
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              <StatCard
                icon={Clock}
                label={t("cron.stats.total")}
                value={counts.total}
                active={statusFilter.value === "all"}
                onClick={() => (statusFilter.value = "all")}
              />
              <StatCard
                icon={CheckCircle}
                label={t("cron.stats.enabled")}
                value={counts.enabled}
                active={statusFilter.value === "enabled"}
                onClick={() => (statusFilter.value = "enabled")}
              />
              <StatCard
                icon={XCircle}
                label={t("cron.stats.disabled")}
                value={counts.disabled}
                active={statusFilter.value === "disabled"}
                onClick={() => (statusFilter.value = "disabled")}
              />
              <StatCard
                icon={Zap}
                label={t("cron.stats.nextWake")}
                value={
                  cronStatus.value?.nextWakeAtMs
                    ? formatTimestamp(cronStatus.value.nextWakeAtMs, { relative: true })
                    : "—"
                }
              />
            </div>
          )}

          {/* Error */}
          {error.value && (
            <div
              class="p-4 rounded-xl bg-[var(--color-error)]/10 text-[var(--color-error)]"
              role="alert"
            >
              {error.value}
            </div>
          )}

          {/* Loading / Connecting */}
          {(isLoading.value || !isConnected.value) && (
            <div class="flex justify-center py-16">
              <Spinner size="lg" label={!isConnected.value ? t("status.connecting") : undefined} />
            </div>
          )}

          {/* Jobs - Cards on mobile, Table on desktop */}
          {isConnected.value && !isLoading.value && filteredJobs.value.length > 0 && (
            <>
              {/* Mobile: Card list (tap to edit) */}
              <div class="md:hidden space-y-2">
                {filteredJobs.value.map((job) => (
                  <CronJobCard key={job.id} job={job} onEdit={openJobModal.bind(null, "edit")} />
                ))}
              </div>

              {/* Desktop: Table */}
              <Card padding="none" class="hidden md:block">
                <table class="w-full">
                  <thead>
                    <tr class="border-b border-[var(--color-border)] text-left text-sm text-[var(--color-text-muted)]">
                      <th class="py-3 px-4 font-medium">{t("cron.columns.job")}</th>
                      <th class="py-3 px-4 font-medium w-40">{t("cron.columns.schedule")}</th>
                      <th class="py-3 px-4 font-medium w-24">{t("cron.columns.target")}</th>
                      <th class="py-3 px-4 font-medium w-32">{t("cron.columns.nextRun")}</th>
                      <th class="py-3 px-4 font-medium w-24">{t("cron.columns.status")}</th>
                      <th class="py-3 px-4 font-medium w-20"></th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-[var(--color-border)]">
                    {filteredJobs.value.map((job) => (
                      <CronJobRow
                        key={job.id}
                        job={job}
                        onEdit={openJobModal.bind(null, "edit")}
                        onRun={runJobNow}
                        onToggleEnabled={toggleJobEnabled}
                        isRunning={isRunning.value}
                      />
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          )}

          {/* Empty state */}
          {isConnected.value && !isLoading.value && cronJobs.value.length === 0 && !error.value && (
            <Card>
              <div class="p-16 text-center">
                <Clock class="w-12 h-12 mx-auto mb-4 text-[var(--color-text-muted)] opacity-50" />
                <h3 class="text-lg font-medium mb-2">{t("cron.emptyTitle")}</h3>
                <p class="text-[var(--color-text-muted)] mb-4">{t("cron.emptyDescription")}</p>
                <Button icon={<Plus class="w-4 h-4" />} onClick={() => openJobModal("create")}>
                  {t("cron.createJob")}
                </Button>
              </div>
            </Card>
          )}

          {/* No results from filter */}
          {isConnected.value &&
            !isLoading.value &&
            cronJobs.value.length > 0 &&
            filteredJobs.value.length === 0 && (
              <Card>
                <div class="p-12 text-center">
                  <Search class="w-10 h-10 mx-auto mb-4 text-[var(--color-text-muted)] opacity-50" />
                  <h3 class="text-lg font-medium mb-2">{t("cron.noResults")}</h3>
                  <p class="text-[var(--color-text-muted)] mb-4">
                    {t("cron.noResultsDescription")}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      searchQuery.value = "";
                      statusFilter.value = "all";
                    }}
                  >
                    {t("cron.clearFilters")}
                  </Button>
                </div>
              </Card>
            )}

          {/* Footer count */}
          {isConnected.value && !isLoading.value && filteredJobs.value.length > 0 && (
            <p class="text-sm text-[var(--color-text-muted)] text-center">
              {filteredJobs.value.length === cronJobs.value.length
                ? t("cron.count", { count: cronJobs.value.length })
                : t("cron.filteredCount", {
                    filtered: filteredJobs.value.length,
                    total: cronJobs.value.length,
                  })}
            </p>
          )}
        </div>

        {/* Modal */}
        <CronJobModal
          mode={modalMode.value}
          job={selectedJob.value}
          runs={selectedJobRuns.value}
          isLoadingRuns={isLoadingRuns.value}
          isDeleting={isDeleting.value}
          isSaving={isSaving.value}
          isRunning={isRunning.value}
          onClose={closeModal}
          onSave={saveOrCreateJob}
          onDelete={deleteJob}
          onRun={runJobNow}
          onSetDeleting={(v) => (isDeleting.value = v)}
          editName={editName}
          editDescription={editDescription}
          editEnabled={editEnabled}
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
      </div>
    </ViewErrorBoundary>
  );
}
