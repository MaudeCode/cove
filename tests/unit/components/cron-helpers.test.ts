import { describe, expect, test } from "bun:test";
import { installI18nMock } from "../../helpers/i18n";
import type { CronJob } from "../../../src/types/cron";

installI18nMock({
  formatTimestamp: (timestamp: Date | number, options?: { relative?: boolean }) =>
    options?.relative ? `relative:${timestamp}` : `time:${timestamp}`,
  t: (key: string) => key,
});

const {
  datetimeLocalToMs,
  formatLastRun,
  formatNextRun,
  formatSchedule,
  getDeliveryStatusInfo,
  getJobStatusBadge,
  isValidCronExpr,
  msToDatetimeLocal,
  resolveAtMs,
} = await import("../../../src/components/cron/cron-helpers");

function cronJob(overrides: Partial<CronJob> = {}): CronJob {
  return {
    id: "job-1",
    name: "Daily summary",
    enabled: true,
    createdAtMs: 1,
    updatedAtMs: 2,
    schedule: { kind: "cron", expr: "0 9 * * *" },
    sessionTarget: "main",
    wakeMode: "next-heartbeat",
    payload: { kind: "systemEvent", text: "Run summary" },
    state: {},
    ...overrides,
  };
}

describe("cron helpers", () => {
  test("resolves one-shot schedule timestamps from current and legacy fields", () => {
    expect(resolveAtMs({ atMs: 123, at: "2026-01-05T10:00:00.000Z" })).toBe(123);
    expect(resolveAtMs({ at: "2026-01-05T10:00:00.000Z" })).toBe(
      Date.parse("2026-01-05T10:00:00.000Z"),
    );
    expect(resolveAtMs({ at: "not-a-date" })).toBeUndefined();
    expect(resolveAtMs({})).toBeUndefined();
  });

  test("formats datetime-local values and schedule summaries", () => {
    const ms = new Date(2026, 0, 5, 9, 7).getTime();

    expect(msToDatetimeLocal(ms)).toBe("2026-01-05T09:07");
    expect(datetimeLocalToMs("2026-01-05T09:07")).toBe(ms);
    expect(formatSchedule({ kind: "cron", expr: "*/5 * * * *", tz: "UTC", staggerMs: 250 })).toBe(
      "*/5 * * * * (UTC) +250ms",
    );
    expect(formatSchedule({ kind: "every", everyMs: 45_000 })).toBe("Every 45s");
    expect(formatSchedule({ kind: "every", everyMs: 300_000 })).toBe("Every 5m");
    expect(formatSchedule({ kind: "every", everyMs: 7_200_000 })).toBe("Every 2h");
    expect(formatSchedule({ kind: "every", everyMs: 172_800_000 })).toBe("Every 2d");
    expect(formatSchedule({ kind: "at", atMs: 456 })).toBe("Once at time:456");
    expect(formatSchedule({ kind: "at", at: "not-a-date" })).toBe("cron.noTimeSet");
  });

  test("formats run timing and job status badge priority", () => {
    expect(formatNextRun(cronJob({ enabled: false, state: { nextRunAtMs: 100 } }))).toBe("—");
    expect(formatNextRun(cronJob({ state: { runningAtMs: 200, nextRunAtMs: 300 } }))).toBe(
      "cron.running",
    );
    expect(formatNextRun(cronJob({ state: { nextRunAtMs: 300 } }))).toBe("relative:300");
    expect(formatLastRun(cronJob({ state: { lastRunAtMs: 400 } }))).toBe("relative:400");

    expect(getJobStatusBadge(cronJob({ enabled: false })).label).toBe("common.disabled");
    expect(getJobStatusBadge(cronJob({ state: { runningAtMs: 1 } })).label).toBe("cron.running");
    expect(getJobStatusBadge(cronJob({ state: { lastStatus: "error" } })).variant).toBe("error");
    expect(
      getJobStatusBadge(cronJob({ state: { lastRunStatus: "ok", lastStatus: "error" } })).variant,
    ).toBe("success");
    expect(getJobStatusBadge(cronJob({ state: { lastRunStatus: "skipped" } })).label).toBe(
      "common.pending",
    );
  });

  test("maps delivery statuses and validates the supported cron expression shape", () => {
    expect(getDeliveryStatusInfo("delivered")).toEqual({
      variant: "success",
      label: "cron.deliveryStatus.delivered",
    });
    expect(getDeliveryStatusInfo("not-delivered").variant).toBe("error");
    expect(getDeliveryStatusInfo("unknown").variant).toBe("warning");
    expect(getDeliveryStatusInfo("not-requested").variant).toBe("default");

    expect(isValidCronExpr("*/5 * * * *")).toBe(true);
    expect(isValidCronExpr("0 9 * * 1-5")).toBe(true);
    expect(isValidCronExpr("0 9 * * 1-5 2026")).toBe(true);
    expect(isValidCronExpr("* * * *")).toBe(false);
    expect(isValidCronExpr("daily at nine")).toBe(false);
    expect(isValidCronExpr("0 9 * * MON")).toBe(false);
  });
});
