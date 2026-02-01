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
import { Badge } from "@/components/ui/Badge";
import { Dropdown } from "@/components/ui/Dropdown";
import { Spinner } from "@/components/ui/Spinner";
import { Modal } from "@/components/ui/Modal";
import { IconButton } from "@/components/ui/IconButton";
import { Toggle } from "@/components/ui/Toggle";
import { FormField } from "@/components/ui/FormField";
import {
  RefreshCw,
  Search,
  Plus,
  Clock,
  Calendar,
  Play,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Zap,
  Timer,
} from "lucide-preact";
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
// Local State
// ============================================

const cronJobs = signal<CronJob[]>([]);
const cronStatus = signal<CronStatusResult | null>(null);
const isLoading = signal<boolean>(false);
const error = signal<string | null>(null);
const searchQuery = signal<string>("");
const statusFilter = signal<"all" | "enabled" | "disabled">("all");

// Selected job for detail/edit
const selectedJob = signal<CronJob | null>(null);
const selectedJobRuns = signal<CronRunLogEntry[]>([]);
const isLoadingRuns = signal<boolean>(false);

// Modal states
const isDeleting = signal<boolean>(false);
const isSaving = signal<boolean>(false);
const isRunning = signal<boolean>(false);
const showCreateModal = signal<boolean>(false);

// Edit form state
const editName = signal<string>("");
const editDescription = signal<string>("");
const editEnabled = signal<boolean>(true);
const editScheduleKind = signal<"cron" | "every" | "at">("cron");
const editScheduleExpr = signal<string>("");
const editScheduleTz = signal<string>("");
const editScheduleEveryMs = signal<string>("");
const editScheduleAtMs = signal<string>("");
const editSessionTarget = signal<"main" | "isolated">("main");
const editPayloadKind = signal<"systemEvent" | "agentTurn">("systemEvent");
const editPayloadText = signal<string>("");
const editPayloadMessage = signal<string>("");
const editPayloadModel = signal<string>("");

// ============================================
// Helpers
// ============================================

function formatSchedule(schedule: CronSchedule): string {
  switch (schedule.kind) {
    case "cron":
      return schedule.expr + (schedule.tz ? ` (${schedule.tz})` : "");
    case "every": {
      const ms = schedule.everyMs;
      if (ms >= 86400000) return `Every ${Math.round(ms / 86400000)}d`;
      if (ms >= 3600000) return `Every ${Math.round(ms / 3600000)}h`;
      if (ms >= 60000) return `Every ${Math.round(ms / 60000)}m`;
      return `Every ${Math.round(ms / 1000)}s`;
    }
    case "at":
      return `Once at ${formatTimestamp(schedule.atMs)}`;
  }
}

function formatNextRun(job: CronJob): string {
  if (!job.enabled) return "—";
  if (job.state.runningAtMs) return t("cron.running");
  if (!job.state.nextRunAtMs) return "—";
  return formatTimestamp(job.state.nextRunAtMs, { relative: true });
}

function formatLastRun(job: CronJob): string {
  if (!job.state.lastRunAtMs) return "—";
  return formatTimestamp(job.state.lastRunAtMs, { relative: true });
}

function getStatusBadge(job: CronJob): {
  variant: "success" | "error" | "warning" | "default";
  label: string;
} {
  if (!job.enabled) return { variant: "default", label: t("cron.disabled") };
  if (job.state.runningAtMs) return { variant: "warning", label: t("cron.running") };
  if (job.state.lastStatus === "error") return { variant: "error", label: t("cron.lastFailed") };
  if (job.state.lastStatus === "ok") return { variant: "success", label: t("cron.lastOk") };
  return { variant: "default", label: t("cron.pending") };
}

// ============================================
// Computed
// ============================================

const filteredJobs = computed(() => {
  let result = cronJobs.value;

  // Filter by status
  if (statusFilter.value === "enabled") {
    result = result.filter((j) => j.enabled);
  } else if (statusFilter.value === "disabled") {
    result = result.filter((j) => !j.enabled);
  }

  // Filter by search
  const query = searchQuery.value.toLowerCase().trim();
  if (query) {
    result = result.filter((j) => {
      const name = j.name.toLowerCase();
      const desc = (j.description || "").toLowerCase();
      return name.includes(query) || desc.includes(query);
    });
  }

  // Sort: enabled first, then by next run
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

  try {
    const [statusResult, listResult] = await Promise.all([
      send<CronStatusResult>("cron.status", {}),
      send<CronListResult>("cron.list", { includeDisabled: true }),
    ]);
    cronStatus.value = statusResult;
    cronJobs.value = listResult.jobs ?? [];
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    isLoading.value = false;
  }
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

function openJobDetail(job: CronJob) {
  selectedJob.value = job;
  populateEditForm(job);
  loadJobRuns(job.id);
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
  editSessionTarget.value = job.sessionTarget;
  editPayloadKind.value = job.payload.kind;
  if (job.payload.kind === "systemEvent") {
    editPayloadText.value = job.payload.text;
  } else {
    editPayloadMessage.value = job.payload.message;
    editPayloadModel.value = job.payload.model ?? "";
  }
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
  editSessionTarget.value = "main";
  editPayloadKind.value = "systemEvent";
  editPayloadText.value = "";
  editPayloadMessage.value = "";
  editPayloadModel.value = "";
}

function closeJobDetail() {
  selectedJob.value = null;
  selectedJobRuns.value = [];
  isDeleting.value = false;
}

function openCreateModal() {
  resetEditForm();
  showCreateModal.value = true;
}

function closeCreateModal() {
  showCreateModal.value = false;
  resetEditForm();
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

async function saveJob(): Promise<void> {
  const job = selectedJob.value;
  if (!job) return;

  isSaving.value = true;
  try {
    const patch = {
      name: editName.value,
      description: editDescription.value || undefined,
      enabled: editEnabled.value,
      schedule: buildSchedule(),
      sessionTarget: editSessionTarget.value,
      payload: buildPayload(),
    };
    await send("cron.update", { jobId: job.id, patch });
    await loadCronJobs();
    closeJobDetail();
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    isSaving.value = false;
  }
}

async function createJob(): Promise<void> {
  isSaving.value = true;
  try {
    const job = {
      name: editName.value || "New Job",
      description: editDescription.value || undefined,
      enabled: editEnabled.value,
      schedule: buildSchedule(),
      sessionTarget: editSessionTarget.value,
      wakeMode: "next-heartbeat" as const,
      payload: buildPayload(),
    };
    await send("cron.add", { job });
    await loadCronJobs();
    closeCreateModal();
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
    closeJobDetail();
  } catch (err) {
    error.value = getErrorMessage(err);
  }
}

async function runJobNow(job: CronJob): Promise<void> {
  isRunning.value = true;
  try {
    await send("cron.run", { jobId: job.id, mode: "force" });
    // Reload to get updated state
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
// Components
// ============================================

const SCHEDULE_KIND_OPTIONS = [
  { value: "cron", label: t("cron.scheduleKind.cron") },
  { value: "every", label: t("cron.scheduleKind.every") },
  { value: "at", label: t("cron.scheduleKind.at") },
];

const SESSION_TARGET_OPTIONS = [
  { value: "main", label: t("cron.sessionTarget.main") },
  { value: "isolated", label: t("cron.sessionTarget.isolated") },
];

const PAYLOAD_KIND_OPTIONS = [
  { value: "systemEvent", label: t("cron.payloadKind.systemEvent") },
  { value: "agentTurn", label: t("cron.payloadKind.agentTurn") },
];

function StatCard({
  icon: Icon,
  label,
  value,
  active,
  onClick,
}: {
  icon: typeof Clock;
  label: string;
  value: number | string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      class={`
        flex items-center gap-3 p-4 rounded-xl text-left transition-all
        ${
          active
            ? "bg-[var(--color-accent)]/10 border-2 border-[var(--color-accent)]"
            : "bg-[var(--color-bg-secondary)] border-2 border-transparent hover:bg-[var(--color-bg-tertiary)]"
        }
      `}
    >
      <div
        class={`p-2 rounded-lg ${active ? "bg-[var(--color-accent)]/20" : "bg-[var(--color-bg-tertiary)]"}`}
      >
        <Icon
          class={`w-5 h-5 ${active ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"}`}
        />
      </div>
      <div>
        <div class="text-2xl font-bold">{value}</div>
        <div class="text-sm text-[var(--color-text-muted)]">{label}</div>
      </div>
    </button>
  );
}

function JobRow({ job }: { job: CronJob }) {
  const status = getStatusBadge(job);

  return (
    <tr
      class="group hover:bg-[var(--color-bg-hover)] cursor-pointer transition-colors"
      onClick={() => openJobDetail(job)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openJobDetail(job);
        }
      }}
      tabIndex={0}
    >
      {/* Name & Description */}
      <td class="py-3 px-4">
        <div class="flex items-center gap-3">
          <div
            class={`p-1.5 rounded-lg flex-shrink-0 ${
              job.enabled ? "bg-[var(--color-success)]/10" : "bg-[var(--color-bg-tertiary)]"
            }`}
          >
            <Clock
              class={`w-4 h-4 ${
                job.enabled ? "text-[var(--color-success)]" : "text-[var(--color-text-muted)]"
              }`}
            />
          </div>
          <div class="min-w-0 flex-1">
            <div class="font-medium truncate" title={job.name}>
              {job.name}
            </div>
            {job.description && (
              <div class="text-xs text-[var(--color-text-muted)] truncate" title={job.description}>
                {job.description}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Schedule */}
      <td class="py-3 px-4">
        <div class="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
          <Calendar class="w-3.5 h-3.5 flex-shrink-0" />
          <span class="truncate" title={formatSchedule(job.schedule)}>
            {formatSchedule(job.schedule)}
          </span>
        </div>
      </td>

      {/* Target */}
      <td class="py-3 px-4">
        <Badge variant={job.sessionTarget === "main" ? "success" : "default"} size="sm">
          {job.sessionTarget}
        </Badge>
      </td>

      {/* Next Run */}
      <td class="py-3 px-4 whitespace-nowrap">
        <div class="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
          <Timer class="w-3.5 h-3.5 flex-shrink-0" />
          <span>{formatNextRun(job)}</span>
        </div>
      </td>

      {/* Status */}
      <td class="py-3 px-4">
        <Badge variant={status.variant} size="sm">
          {status.label}
        </Badge>
      </td>

      {/* Actions */}
      <td class="py-3 px-4">
        <div class="flex items-center gap-1">
          <IconButton
            icon={<Play class="w-4 h-4" />}
            label={t("cron.runNow")}
            size="sm"
            variant="ghost"
            disabled={isRunning.value}
            onClick={(e) => {
              e.stopPropagation();
              runJobNow(job);
            }}
          />
          <IconButton
            icon={job.enabled ? <XCircle class="w-4 h-4" /> : <CheckCircle class="w-4 h-4" />}
            label={job.enabled ? t("cron.disable") : t("cron.enable")}
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              toggleJobEnabled(job);
            }}
            class={job.enabled ? "text-[var(--color-text-muted)]" : "text-[var(--color-success)]"}
          />
        </div>
      </td>
    </tr>
  );
}

function JobEditForm({ isCreate: _isCreate = false }: { isCreate?: boolean }) {
  return (
    <div class="space-y-5">
      {/* Basic Info */}
      <div class="grid grid-cols-2 gap-4">
        <FormField label={t("cron.form.name")}>
          <Input
            value={editName.value}
            onInput={(e) => (editName.value = (e.target as HTMLInputElement).value)}
            placeholder={t("cron.form.namePlaceholder")}
            fullWidth
          />
        </FormField>
        <FormField label={t("cron.form.enabled")}>
          <div class="pt-2">
            <Toggle
              checked={editEnabled.value}
              onChange={(checked) => (editEnabled.value = checked)}
              label={editEnabled.value ? t("cron.enabled") : t("cron.disabled")}
            />
          </div>
        </FormField>
      </div>

      <FormField label={t("cron.form.description")} hint={t("cron.form.descriptionHint")}>
        <Input
          value={editDescription.value}
          onInput={(e) => (editDescription.value = (e.target as HTMLInputElement).value)}
          placeholder={t("cron.form.descriptionPlaceholder")}
          fullWidth
        />
      </FormField>

      {/* Schedule */}
      <FormField label={t("cron.form.schedule")}>
        <div class="space-y-3">
          <Dropdown
            value={editScheduleKind.value}
            onChange={(val) => (editScheduleKind.value = val as "cron" | "every" | "at")}
            options={SCHEDULE_KIND_OPTIONS}
          />
          {editScheduleKind.value === "cron" && (
            <div class="grid grid-cols-2 gap-3">
              <Input
                value={editScheduleExpr.value}
                onInput={(e) => (editScheduleExpr.value = (e.target as HTMLInputElement).value)}
                placeholder="*/5 * * * *"
                fullWidth
              />
              <Input
                value={editScheduleTz.value}
                onInput={(e) => (editScheduleTz.value = (e.target as HTMLInputElement).value)}
                placeholder={t("cron.form.timezonePlaceholder")}
                fullWidth
              />
            </div>
          )}
          {editScheduleKind.value === "every" && (
            <Input
              type="number"
              value={editScheduleEveryMs.value}
              onInput={(e) => (editScheduleEveryMs.value = (e.target as HTMLInputElement).value)}
              placeholder={t("cron.form.intervalPlaceholder")}
              fullWidth
            />
          )}
          {editScheduleKind.value === "at" && (
            <Input
              type="number"
              value={editScheduleAtMs.value}
              onInput={(e) => (editScheduleAtMs.value = (e.target as HTMLInputElement).value)}
              placeholder={t("cron.form.timestampPlaceholder")}
              fullWidth
            />
          )}
        </div>
      </FormField>

      {/* Session Target */}
      <FormField label={t("cron.form.sessionTarget")} hint={t("cron.form.sessionTargetHint")}>
        <Dropdown
          value={editSessionTarget.value}
          onChange={(val) => (editSessionTarget.value = val as "main" | "isolated")}
          options={SESSION_TARGET_OPTIONS}
        />
      </FormField>

      {/* Payload */}
      <FormField label={t("cron.form.payload")}>
        <div class="space-y-3">
          <Dropdown
            value={editPayloadKind.value}
            onChange={(val) => (editPayloadKind.value = val as "systemEvent" | "agentTurn")}
            options={PAYLOAD_KIND_OPTIONS}
          />
          {editPayloadKind.value === "systemEvent" && (
            <Input
              value={editPayloadText.value}
              onInput={(e) => (editPayloadText.value = (e.target as HTMLInputElement).value)}
              placeholder={t("cron.form.systemEventPlaceholder")}
              fullWidth
            />
          )}
          {editPayloadKind.value === "agentTurn" && (
            <div class="space-y-3">
              <Input
                value={editPayloadMessage.value}
                onInput={(e) => (editPayloadMessage.value = (e.target as HTMLInputElement).value)}
                placeholder={t("cron.form.agentMessagePlaceholder")}
                fullWidth
              />
              <Input
                value={editPayloadModel.value}
                onInput={(e) => (editPayloadModel.value = (e.target as HTMLInputElement).value)}
                placeholder={t("cron.form.modelPlaceholder")}
                fullWidth
              />
            </div>
          )}
        </div>
      </FormField>
    </div>
  );
}

function JobDetailModal() {
  const job = selectedJob.value;
  if (!job) return null;

  const status = getStatusBadge(job);

  return (
    <Modal
      open={!!job}
      onClose={closeJobDetail}
      title={job.name}
      size="xl"
      footer={
        <div class="flex items-center justify-between">
          <div>
            {isDeleting.value ? (
              <div class="flex items-center gap-2">
                <span class="text-sm text-[var(--color-error)]">{t("cron.confirmDelete")}</span>
                <Button size="sm" variant="ghost" onClick={() => (isDeleting.value = false)}>
                  {t("actions.cancel")}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  icon={<Trash2 class="w-4 h-4" />}
                  onClick={deleteJob}
                >
                  {t("actions.delete")}
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 class="w-4 h-4" />}
                onClick={() => (isDeleting.value = true)}
                class="text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
              >
                {t("actions.delete")}
              </Button>
            )}
          </div>
          <div class="flex items-center gap-2">
            <Button variant="secondary" onClick={closeJobDetail}>
              {t("actions.cancel")}
            </Button>
            <Button onClick={saveJob} disabled={isSaving.value}>
              {isSaving.value ? <Spinner size="sm" /> : t("actions.save")}
            </Button>
          </div>
        </div>
      }
    >
      <div class="space-y-6">
        {/* Status Summary */}
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
            <div class="text-sm text-[var(--color-text-muted)]">{formatSchedule(job.schedule)}</div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            icon={<Play class="w-4 h-4" />}
            onClick={() => runJobNow(job)}
            disabled={isRunning.value}
          >
            {t("cron.runNow")}
          </Button>
        </div>

        {/* Stats */}
        <div class="grid grid-cols-3 gap-4">
          <div class="text-center p-4 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
            <div class="text-xl font-bold">{formatNextRun(job)}</div>
            <div class="text-sm text-[var(--color-text-muted)]">{t("cron.nextRun")}</div>
          </div>
          <div class="text-center p-4 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
            <div class="text-xl font-bold">{formatLastRun(job)}</div>
            <div class="text-sm text-[var(--color-text-muted)]">{t("cron.lastRun")}</div>
          </div>
          <div class="text-center p-4 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
            <div class="text-xl font-bold">
              {job.state.lastDurationMs ? `${Math.round(job.state.lastDurationMs / 1000)}s` : "—"}
            </div>
            <div class="text-sm text-[var(--color-text-muted)]">{t("cron.lastDuration")}</div>
          </div>
        </div>

        {/* Edit Form */}
        <JobEditForm />

        {/* Recent Runs */}
        <div>
          <h4 class="text-sm font-medium mb-3">{t("cron.recentRuns")}</h4>
          {isLoadingRuns.value ? (
            <div class="flex justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : selectedJobRuns.value.length === 0 ? (
            <p class="text-sm text-[var(--color-text-muted)] text-center py-4">
              {t("cron.noRuns")}
            </p>
          ) : (
            <div class="space-y-2 max-h-48 overflow-y-auto">
              {selectedJobRuns.value.map((run, i) => (
                <div
                  key={i}
                  class="flex items-center gap-3 p-2 rounded-lg bg-[var(--color-bg-secondary)] text-sm"
                >
                  {run.status === "ok" ? (
                    <CheckCircle class="w-4 h-4 text-[var(--color-success)]" />
                  ) : run.status === "error" ? (
                    <XCircle class="w-4 h-4 text-[var(--color-error)]" />
                  ) : (
                    <AlertCircle class="w-4 h-4 text-[var(--color-warning)]" />
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
      </div>
    </Modal>
  );
}

function CreateJobModal() {
  if (!showCreateModal.value) return null;

  return (
    <Modal
      open={showCreateModal.value}
      onClose={closeCreateModal}
      title={t("cron.createJob")}
      size="xl"
      footer={
        <div class="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={closeCreateModal}>
            {t("actions.cancel")}
          </Button>
          <Button onClick={createJob} disabled={isSaving.value}>
            {isSaving.value ? <Spinner size="sm" /> : t("actions.create")}
          </Button>
        </div>
      }
    >
      <JobEditForm isCreate />
    </Modal>
  );
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
    <div class="flex-1 overflow-y-auto p-6">
      <div class="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <h1 class="text-2xl font-bold">{t("cron.title")}</h1>
            <p class="text-[var(--color-text-muted)] mt-1">{t("cron.description")}</p>
          </div>
          <div class="flex items-center gap-3">
            {isConnected.value && !isLoading.value && cronJobs.value.length > 0 && (
              <div class="relative">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                <Input
                  type="text"
                  value={searchQuery.value}
                  onInput={(e) => (searchQuery.value = (e.target as HTMLInputElement).value)}
                  placeholder={t("cron.searchPlaceholder")}
                  class="pl-10 w-64"
                />
              </div>
            )}
            <Button
              icon={<Plus class="w-4 h-4" />}
              onClick={openCreateModal}
              disabled={!isConnected.value}
            >
              {t("cron.createJob")}
            </Button>
            <IconButton
              icon={<RefreshCw class={`w-4 h-4 ${isLoading.value ? "animate-spin" : ""}`} />}
              label={t("actions.refresh")}
              onClick={loadCronJobs}
              disabled={isLoading.value || !isConnected.value}
              variant="ghost"
            />
          </div>
        </div>

        {/* Stats Cards */}
        {isConnected.value && !isLoading.value && (
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          <div class="p-4 rounded-xl bg-[var(--color-error)]/10 text-[var(--color-error)]">
            {error.value}
          </div>
        )}

        {/* Loading / Connecting */}
        {(isLoading.value || !isConnected.value) && (
          <div class="flex justify-center py-16">
            <Spinner size="lg" label={!isConnected.value ? t("status.connecting") : undefined} />
          </div>
        )}

        {/* Jobs Table */}
        {isConnected.value && !isLoading.value && filteredJobs.value.length > 0 && (
          <Card padding="none">
            <div class="overflow-x-auto">
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
                    <JobRow key={job.id} job={job} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Empty state */}
        {isConnected.value && !isLoading.value && cronJobs.value.length === 0 && !error.value && (
          <Card>
            <div class="p-16 text-center">
              <Clock class="w-12 h-12 mx-auto mb-4 text-[var(--color-text-muted)] opacity-50" />
              <h3 class="text-lg font-medium mb-2">{t("cron.emptyTitle")}</h3>
              <p class="text-[var(--color-text-muted)] mb-4">{t("cron.emptyDescription")}</p>
              <Button icon={<Plus class="w-4 h-4" />} onClick={openCreateModal}>
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
                <p class="text-[var(--color-text-muted)] mb-4">{t("cron.noResultsDescription")}</p>
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

      {/* Modals */}
      <JobDetailModal />
      <CreateJobModal />
    </div>
  );
}
