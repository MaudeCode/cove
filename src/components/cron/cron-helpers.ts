/**
 * Cron View Helpers
 *
 * Utility functions for formatting and validating cron jobs.
 */

import { t, formatTimestamp } from "@/lib/i18n";
import type { CronJob, CronSchedule } from "@/types/cron";

/**
 * Convert milliseconds to datetime-local input format.
 */
export function msToDatetimeLocal(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Convert datetime-local input value to milliseconds.
 */
export function datetimeLocalToMs(val: string): number {
  return new Date(val).getTime();
}

/**
 * Format a cron schedule for display.
 */
export function formatSchedule(schedule: CronSchedule): string {
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

/**
 * Format the next run time for a job.
 */
export function formatNextRun(job: CronJob): string {
  if (!job.enabled) return "—";
  if (job.state.runningAtMs) return t("cron.running");
  if (!job.state.nextRunAtMs) return "—";
  return formatTimestamp(job.state.nextRunAtMs, { relative: true });
}

/**
 * Format the last run time for a job.
 */
export function formatLastRun(job: CronJob): string {
  if (!job.state.lastRunAtMs) return "—";
  return formatTimestamp(job.state.lastRunAtMs, { relative: true });
}

/**
 * Get status badge properties for a job.
 */
export function getJobStatusBadge(job: CronJob): {
  variant: "success" | "error" | "warning" | "default";
  label: string;
} {
  if (!job.enabled) return { variant: "default", label: t("cron.disabled") };
  if (job.state.runningAtMs) return { variant: "warning", label: t("cron.running") };
  if (job.state.lastStatus === "error") return { variant: "error", label: t("cron.lastFailed") };
  if (job.state.lastStatus === "ok") return { variant: "success", label: t("cron.lastOk") };
  return { variant: "default", label: t("cron.pending") };
}

/**
 * Basic cron expression validation (5 or 6 fields).
 */
export function isValidCronExpr(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 6) return false;
  const fieldPattern = /^(\*|(\d+(-\d+)?(,\d+(-\d+)?)*)(\/\d+)?|\*\/\d+)$/;
  return parts.every((p) => fieldPattern.test(p));
}

/**
 * Preset intervals for the "every" schedule type.
 */
export const INTERVAL_PRESETS = [
  { ms: 60000, label: "1m" },
  { ms: 300000, label: "5m" },
  { ms: 600000, label: "10m" },
  { ms: 1800000, label: "30m" },
  { ms: 3600000, label: "1h" },
  { ms: 21600000, label: "6h" },
  { ms: 86400000, label: "24h" },
] as const;

/**
 * Example cron expressions for quick selection.
 */
export const CRON_EXAMPLES = [
  { expr: "*/5 * * * *", label: "Every 5 min" },
  { expr: "0 * * * *", label: "Hourly" },
  { expr: "0 8 * * *", label: "8am daily" },
  { expr: "0 9 * * 1-5", label: "9am weekdays" },
  { expr: "0 0 * * *", label: "Midnight" },
  { expr: "0 0 * * 0", label: "Weekly (Sun)" },
] as const;
