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
  /** Canonical ISO-8601 string (gateway 2026.3+). */
  at?: string;
  /** Legacy numeric milliseconds (gateway <2026.3). */
  atMs?: number;
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
  fallbacks?: string[];
  thinking?: string;
  timeoutSeconds?: number;
  allowUnsafeExternalContent?: boolean;
  lightContext?: boolean;
  deliver?: boolean;
  channel?: string;
  to?: string;
  bestEffortDeliver?: boolean;
};

export type CronPayload = CronPayloadSystemEvent | CronPayloadAgentTurn;

// ============================================
// Job State
// ============================================

export type CronDeliveryStatus = "delivered" | "not-delivered" | "unknown" | "not-requested";

export interface CronJobState {
  nextRunAtMs?: number;
  runningAtMs?: number;
  lastRunAtMs?: number;
  lastStatus?: "ok" | "error" | "skipped";
  lastRunStatus?: "ok" | "error" | "skipped";
  lastError?: string;
  lastDurationMs?: number;
  lastDelivered?: boolean;
  lastDeliveryStatus?: CronDeliveryStatus;
  lastDeliveryError?: string;
  consecutiveErrors?: number;
  lastFailureAlertAtMs?: number;
  scheduleErrorCount?: number;
}

// ============================================
// Job
// ============================================

export type CronSessionTarget = "main" | "isolated";
export type CronWakeMode = "next-heartbeat" | "now";

export type CronDeliveryMode = "none" | "announce" | "webhook";

export interface CronFailureDestination {
  channel?: string;
  to?: string;
  accountId?: string;
  mode?: "announce" | "webhook";
}

export interface CronDelivery {
  mode: CronDeliveryMode;
  channel?: string;
  to?: string;
  bestEffort?: boolean;
  accountId?: string;
  failureDestination?: CronFailureDestination;
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
  failureAlert?: CronFailureAlert | false;
  state: CronJobState;
}

export interface CronFailureAlert {
  after?: number;
  channel?: string;
  to?: string;
  cooldownMs?: number;
  mode?: "announce" | "webhook";
  accountId?: string;
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
  delivered?: boolean;
  deliveryStatus?: CronDeliveryStatus;
  deliveryError?: string;
  model?: string;
  provider?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    cache_read_tokens?: number;
    cache_write_tokens?: number;
  };
  jobName?: string;
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
