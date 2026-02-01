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
