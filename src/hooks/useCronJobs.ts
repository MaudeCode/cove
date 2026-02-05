/**
 * useCronJobs Hook
 *
 * State management and actions for the cron jobs view.
 * Extracted from CronView for maintainability.
 */

import { signal, computed, useComputed } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { t } from "@/lib/i18n";
import { send, isConnected } from "@/lib/gateway";
import { getErrorMessage } from "@/lib/session-utils";
import { isValidCronExpr } from "@/components/cron";
import type {
  CronJob,
  CronSchedule,
  CronPayload,
  CronStatusResult,
  CronListResult,
  CronRunLogEntry,
  CronRunsResult,
  UseCronJobsResult,
} from "@/types/cron";

// ============================================
// State Signals (module-level for persistence)
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

  if (statusResult.status === "fulfilled") {
    cronStatus.value = statusResult.value;
  }

  if (listResult.status === "fulfilled") {
    cronJobs.value = listResult.value.jobs ?? [];
  }

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
  editPayloadText.value = "";
  editPayloadMessage.value = "";
  editPayloadModel.value = "";
  formErrors.value = {};
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

function closeModal() {
  modalMode.value = null;
  selectedJob.value = null;
  selectedJobRuns.value = [];
  isDeleting.value = false;
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
  if (editSessionTarget.value === "main") {
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
// Hook
// ============================================

export function useCronJobs(): UseCronJobsResult {
  // Load on mount when connected
  useEffect(() => {
    if (isConnected.value) {
      loadCronJobs();
    }
  }, [isConnected.value]);

  // Check if form has changes (useComputed ensures reactivity)
  const hasFormChanges = useComputed(() => {
    const job = selectedJob.value;
    if (!job) return true; // Create mode - always allow save

    if (editName.value !== job.name) return true;
    if (editDescription.value !== (job.description ?? "")) return true;
    if (editEnabled.value !== job.enabled) return true;
    if (editScheduleKind.value !== job.schedule.kind) return true;
    if (editWakeMode.value !== job.wakeMode) return true;
    if (editSessionTarget.value !== job.sessionTarget) return true;

    if (job.schedule.kind === "cron" && editScheduleKind.value === "cron") {
      if (editScheduleExpr.value !== job.schedule.expr) return true;
      if (editScheduleTz.value !== (job.schedule.tz ?? "")) return true;
    } else if (job.schedule.kind === "every" && editScheduleKind.value === "every") {
      if (editScheduleEveryMs.value !== String(job.schedule.everyMs)) return true;
    } else if (job.schedule.kind === "at" && editScheduleKind.value === "at") {
      if (editScheduleAtMs.value !== String(job.schedule.atMs)) return true;
    }

    if (job.payload.kind === "systemEvent" && editSessionTarget.value === "main") {
      if (editPayloadText.value !== job.payload.text) return true;
    } else if (job.payload.kind === "agentTurn" && editSessionTarget.value === "isolated") {
      if (editPayloadMessage.value !== job.payload.message) return true;
      if (editPayloadModel.value !== (job.payload.model ?? "")) return true;
    }

    return false;
  });

  return {
    state: {
      cronJobs,
      cronStatus,
      isLoading,
      error,
      searchQuery,
      statusFilter,
    },
    modal: {
      modalMode,
      selectedJob,
      selectedJobRuns,
      isLoadingRuns,
      isDeleting,
      isSaving,
      isRunning,
    },
    form: {
      editName,
      editDescription,
      editEnabled,
      editScheduleKind,
      editScheduleExpr,
      editScheduleTz,
      editScheduleEveryMs,
      editScheduleAtMs,
      editWakeMode,
      editSessionTarget,
      editPayloadText,
      editPayloadMessage,
      editPayloadModel,
      formErrors,
    },
    computed: {
      filteredJobs,
      jobCounts,
      hasFormChanges,
    },
    actions: {
      loadCronJobs,
      openJobModal,
      closeModal,
      saveOrCreateJob,
      deleteJob,
      runJobNow,
      toggleJobEnabled,
    },
  };
}
