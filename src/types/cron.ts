/**
 * Cron Job Types
 *
 * Matches OpenClaw gateway cron.* responses.
 */

// ============================================
// Schedule Types
// ============================================

export type CronScheduleAt = {
  kind: "at";
  atMs: number;
};

export type CronScheduleEvery = {
  kind: "every";
  everyMs: number;
  anchorMs?: number;
};

export type CronScheduleCron = {
  kind: "cron";
  expr: string;
  tz?: string;
  staggerMs?: number;
};

export type CronSchedule = CronScheduleAt | CronScheduleEvery | CronScheduleCron;

// ============================================
// Payload Types
// ============================================

export type CronPayloadSystemEvent = {
  kind: "systemEvent";
  text: string;
};

export type CronPayloadAgentTurn = {
  kind: "agentTurn";
  message: string;
  model?: string;
  thinking?: string;
  timeoutSeconds?: number;
  deliver?: boolean;
  channel?: string;
  to?: string;
  bestEffortDeliver?: boolean;
};

export type CronPayload = CronPayloadSystemEvent | CronPayloadAgentTurn;

// ============================================
// Job State
// ============================================

export interface CronJobState {
  nextRunAtMs?: number;
  runningAtMs?: number;
  lastRunAtMs?: number;
  lastStatus?: "ok" | "error" | "skipped";
  lastError?: string;
  lastDurationMs?: number;
}

// ============================================
// Job
// ============================================

export type CronSessionTarget = "main" | "isolated";
export type CronWakeMode = "next-heartbeat" | "now";

export type CronDeliveryMode = "none" | "announce";

export interface CronDelivery {
  mode: CronDeliveryMode;
  channel?: string;
  to?: string;
  bestEffort?: boolean;
}

export interface CronJob {
  id: string;
  agentId?: string;
  name: string;
  description?: string;
  enabled: boolean;
  deleteAfterRun?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: CronSchedule;
  sessionTarget: CronSessionTarget;
  wakeMode: CronWakeMode;
  payload: CronPayload;
  delivery?: CronDelivery;
  state: CronJobState;
}

// ============================================
// Run Log Entry
// ============================================

export interface CronRunLogEntry {
  jobId: string;
  runAtMs: number;
  status: "ok" | "error" | "skipped";
  error?: string;
  durationMs?: number;
}

// ============================================
// API Responses
// ============================================

export interface CronStatusResult {
  enabled: boolean;
  jobs: number;
  nextWakeAtMs?: number;
}

export interface CronListResult {
  jobs: CronJob[];
}

export interface CronRunsResult {
  entries: CronRunLogEntry[];
}

// ============================================
// Hook Types
// ============================================

import type { Signal, ReadonlySignal } from "@preact/signals";

export interface CronJobsState {
  cronJobs: Signal<CronJob[]>;
  cronStatus: Signal<CronStatusResult | null>;
  isLoading: Signal<boolean>;
  error: Signal<string | null>;
  searchQuery: Signal<string>;
  statusFilter: Signal<"all" | "enabled" | "disabled">;
}

export interface CronJobsModal {
  modalMode: Signal<"create" | "edit" | null>;
  selectedJob: Signal<CronJob | null>;
  selectedJobRuns: Signal<CronRunLogEntry[]>;
  isLoadingRuns: Signal<boolean>;
  isDeleting: Signal<boolean>;
  isSaving: Signal<boolean>;
  isRunning: Signal<boolean>;
}

export interface CronJobsForm {
  editName: Signal<string>;
  editDescription: Signal<string>;
  editEnabled: Signal<boolean>;
  editScheduleKind: Signal<"cron" | "every" | "at">;
  editScheduleExpr: Signal<string>;
  editScheduleTz: Signal<string>;
  editScheduleStaggerMs: Signal<string>;
  editScheduleEveryMs: Signal<string>;
  editScheduleAtMs: Signal<string>;
  editWakeMode: Signal<CronWakeMode>;
  editSessionTarget: Signal<CronSessionTarget>;
  editDeliveryAnnounce: Signal<boolean>;
  editPayloadText: Signal<string>;
  editPayloadMessage: Signal<string>;
  editPayloadModel: Signal<string>;
  formErrors: Signal<Record<string, string>>;
}

export interface CronJobsComputed {
  filteredJobs: ReadonlySignal<CronJob[]>;
  jobCounts: ReadonlySignal<{ total: number; enabled: number; disabled: number }>;
  hasFormChanges: ReadonlySignal<boolean>;
}

export interface CronJobsActions {
  loadCronJobs: () => Promise<void>;
  openJobModal: (mode: "create" | "edit", job?: CronJob) => void;
  closeModal: () => void;
  saveOrCreateJob: () => Promise<void>;
  deleteJob: () => Promise<void>;
  runJobNow: (job: CronJob) => Promise<void>;
  toggleJobEnabled: (job: CronJob) => Promise<void>;
}

export interface UseCronJobsResult {
  state: CronJobsState;
  modal: CronJobsModal;
  form: CronJobsForm;
  computed: CronJobsComputed;
  actions: CronJobsActions;
}
