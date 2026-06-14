import { afterEach, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import { signal } from "@preact/signals";
import { createQueryParamMock } from "../../helpers/module-mocks";
import { installStorageMocks } from "../../helpers/storage";
import type {
  CostUsageSummary,
  SessionUsageEntry,
  SessionsUsageResult,
  UsageTotals,
} from "../../../src/types/server-stats";

type SendCall = {
  method: string;
  params: unknown;
};

const sendCalls: SendCall[] = [];
const gatewayResponses: unknown[] = [];
const isConnected = signal(true);
let importCounter = 0;
let restoreStorage: (() => void) | undefined;
const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
const fixedNow = new Date("2026-06-13T12:00:00.000Z");

const storage = await import("../../../src/lib/storage");

mock.module("@/lib/gateway", () => ({
  isConnected,
  send: async (method: string, params?: unknown) => {
    sendCalls.push({ method, params });
    const response = gatewayResponses.shift();
    if (response instanceof Error) throw response;
    return response;
  },
}));
mock.module("@/lib/storage", () => storage);
mock.module("@/lib/i18n", () => ({
  formatTimestamp: (value: Date | number) =>
    `time:${value instanceof Date ? value.getTime() : value}`,
  t: (key: string) => key,
}));
mock.module("@/lib/logger", () => ({
  log: {
    usage: {
      warn: () => undefined,
    },
  },
}));
mock.module("@/lib/session-utils", () => ({
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));
mock.module("@/components/ui/Toast", () => ({
  toast: {
    error: () => undefined,
  },
}));
mock.module("@/hooks/useQueryParam", () => createQueryParamMock());

beforeEach(() => {
  setSystemTime(fixedNow);
  restoreStorage = installStorageMocks();
  sendCalls.length = 0;
  gatewayResponses.length = 0;
  isConnected.value = true;
  Date.prototype.getTimezoneOffset = originalGetTimezoneOffset;
});

afterEach(() => {
  restoreStorage?.();
  Date.prototype.getTimezoneOffset = originalGetTimezoneOffset;
  setSystemTime();
});

describe("usage view state", () => {
  test("loadUsage sends usage.cost and loads sessions usage for the same days", async () => {
    const usage = await importUsageState();
    gatewayResponses.push(costSummary(7), sessionsResult([]));

    await usage.loadUsage(7);
    await flushPromises();

    expect(sendCalls).toEqual([
      { method: "usage.cost", params: { days: 7 } },
      {
        method: "sessions.usage",
        params: {
          startDate: daysAgoDate(7),
          endDate: daysAgoDate(0),
          limit: 100,
          includeContextWeight: true,
          mode: "gateway",
        },
      },
    ]);
    expect(usage.usageDays.value).toBe(7);
    expect(usage.usageData.value?.days).toBe(7);
  });

  test("loadSessionsUsage sends date range, timezone mode, utcOffset, and caches results", async () => {
    const usage = await importUsageState();
    const result = sessionsResult([sessionEntry("alpha")]);
    Date.prototype.getTimezoneOffset = () => 330;
    usage.usageTimezoneMode.value = "specific";
    gatewayResponses.push(result);

    await usage.loadSessionsUsage(14);

    expect(sendCalls).toEqual([
      {
        method: "sessions.usage",
        params: {
          startDate: daysAgoDate(14),
          endDate: daysAgoDate(0),
          limit: 100,
          includeContextWeight: true,
          mode: "specific",
          utcOffset: "UTC-5:30",
        },
      },
    ]);
    expect(usage.sessionsUsage.value).toEqual(result);
    expect(storage.getSessionsUsageCache()).toEqual(result);

    usage.usageTimezoneMode.value = "utc";
    gatewayResponses.push(sessionsResult([]));
    await usage.loadSessionsUsage(7);
    expect(sendCalls.at(-1)).toEqual({
      method: "sessions.usage",
      params: {
        startDate: daysAgoDate(7),
        endDate: daysAgoDate(0),
        limit: 100,
        includeContextWeight: true,
        mode: "utc",
      },
    });
  });

  test("loading guards skip duplicate sessions requests and replay the latest usage days", async () => {
    const usage = await importUsageState();
    const usageRequest = deferred<CostUsageSummary>();
    gatewayResponses.push(usageRequest.promise, costSummary(7), sessionsResult([]));

    const firstUsageLoad = usage.loadUsage(30);
    await flushPromises();
    const queuedUsageLoad = usage.loadUsage(7);
    const duplicateQueuedUsageLoad = usage.loadUsage(7);
    await flushPromises();
    expect(sendCalls).toEqual([{ method: "usage.cost", params: { days: 30 } }]);
    expect(usage.usageDays.value).toBe(7);

    usageRequest.resolve(costSummary(30));
    await queuedUsageLoad;
    await duplicateQueuedUsageLoad;
    await firstUsageLoad;
    expect(sendCalls).toEqual([
      { method: "usage.cost", params: { days: 30 } },
      { method: "usage.cost", params: { days: 7 } },
      {
        method: "sessions.usage",
        params: {
          startDate: daysAgoDate(7),
          endDate: daysAgoDate(0),
          limit: 100,
          includeContextWeight: true,
          mode: "gateway",
        },
      },
    ]);
    expect(usage.usageData.value?.days).toBe(7);
  });

  test("in-flight loadUsage lets the latest A-to-B-to-A day selection win", async () => {
    const usage = await importUsageState();
    const usageRequest = deferred<CostUsageSummary>();
    const currentSessions = sessionsResult([sessionEntry("current")]);
    gatewayResponses.push(usageRequest.promise, currentSessions);

    const firstUsageLoad = usage.loadUsage(30);
    await flushPromises();
    const queuedUsageLoad = usage.loadUsage(7);
    const restoredUsageLoad = usage.loadUsage(30);
    await flushPromises();

    expect(usage.usageDays.value).toBe(30);
    usageRequest.resolve(costSummary(30));
    await firstUsageLoad;
    await queuedUsageLoad;
    await restoredUsageLoad;

    expect(sendCalls).toEqual([
      { method: "usage.cost", params: { days: 30 } },
      {
        method: "sessions.usage",
        params: {
          startDate: daysAgoDate(30),
          endDate: daysAgoDate(0),
          limit: 100,
          includeContextWeight: true,
          mode: "gateway",
        },
      },
    ]);
    expect(usage.usageData.value?.days).toBe(30);
    expect(usage.sessionsUsage.value).toBe(currentSessions);
  });

  test("loadUsage replays latest days while sessions usage is in flight", async () => {
    const usage = await importUsageState();
    const sessionsRequest = deferred<SessionsUsageResult>();
    const staleSessions = sessionsResult([sessionEntry("stale")]);
    const latestSessions = sessionsResult([sessionEntry("latest")]);
    gatewayResponses.push(costSummary(30), sessionsRequest.promise, costSummary(7), latestSessions);

    const firstUsageLoad = usage.loadUsage(30);
    await flushPromises();
    expect(sendCalls.map((call) => call.method)).toEqual(["usage.cost", "sessions.usage"]);

    const queuedUsageLoad = usage.loadUsage(7);
    await flushPromises();
    expect(usage.usageDays.value).toBe(7);

    sessionsRequest.resolve(staleSessions);
    await queuedUsageLoad;
    await firstUsageLoad;

    expect(sendCalls).toEqual([
      { method: "usage.cost", params: { days: 30 } },
      {
        method: "sessions.usage",
        params: {
          startDate: daysAgoDate(30),
          endDate: daysAgoDate(0),
          limit: 100,
          includeContextWeight: true,
          mode: "gateway",
        },
      },
      { method: "usage.cost", params: { days: 7 } },
      {
        method: "sessions.usage",
        params: {
          startDate: daysAgoDate(7),
          endDate: daysAgoDate(0),
          limit: 100,
          includeContextWeight: true,
          mode: "gateway",
        },
      },
    ]);
    expect(usage.usageData.value?.days).toBe(7);
    expect(usage.sessionsUsage.value).toBe(latestSessions);
    expect(storage.getSessionsUsageCache()).toEqual(latestSessions);
  });

  test("in-flight sessions usage lets the latest A-to-B-to-A request win", async () => {
    const usage = await importUsageState();
    const sessionsRequest = deferred<SessionsUsageResult>();
    const currentSessions = sessionsResult([sessionEntry("current")]);
    gatewayResponses.push(sessionsRequest.promise);

    const firstLoad = usage.loadSessionsUsage(30);
    await flushPromises();

    usage.usageTimezoneMode.value = "specific";
    Date.prototype.getTimezoneOffset = () => 330;
    const queuedLoad = usage.loadSessionsUsage(14);
    usage.usageTimezoneMode.value = "gateway";
    const restoredLoad = usage.loadSessionsUsage(30);
    await flushPromises();

    expect(usage.usageDays.value).toBe(30);
    sessionsRequest.resolve(currentSessions);
    await firstLoad;
    await queuedLoad;
    await restoredLoad;

    expect(sendCalls).toEqual([
      {
        method: "sessions.usage",
        params: {
          startDate: daysAgoDate(30),
          endDate: daysAgoDate(0),
          limit: 100,
          includeContextWeight: true,
          mode: "gateway",
        },
      },
    ]);
    expect(usage.sessionsUsage.value).toBe(currentSessions);
    expect(storage.getSessionsUsageCache()).toEqual(currentSessions);
  });

  test("standalone sessions loading guard replays the latest range and timezone mode", async () => {
    const usage = await importUsageState();
    const sessionsRequest = deferred<SessionsUsageResult>();
    gatewayResponses.push(sessionsRequest.promise, sessionsResult([]));

    const firstLoad = usage.loadSessionsUsage(30);
    await flushPromises();
    Date.prototype.getTimezoneOffset = () => 330;
    usage.usageTimezoneMode.value = "specific";
    const queuedLoad = usage.loadSessionsUsage(14);
    await flushPromises();

    expect(sendCalls).toEqual([
      {
        method: "sessions.usage",
        params: {
          startDate: daysAgoDate(30),
          endDate: daysAgoDate(0),
          limit: 100,
          includeContextWeight: true,
          mode: "gateway",
        },
      },
    ]);

    sessionsRequest.resolve(sessionsResult([]));
    await firstLoad;
    await queuedLoad;

    expect(sendCalls.at(-1)).toEqual({
      method: "sessions.usage",
      params: {
        startDate: daysAgoDate(14),
        endDate: daysAgoDate(0),
        limit: 100,
        includeContextWeight: true,
        mode: "specific",
        utcOffset: "UTC-5:30",
      },
    });
  });

  test("detail tab loaders fetch once per session and refetch after session changes", async () => {
    const usage = await importUsageState();
    gatewayResponses.push(
      {
        sessionId: "alpha",
        points: [{ timestamp: 1, ...totals(), cost: 0, cumulativeTokens: 10, cumulativeCost: 1 }],
      },
      {
        sessionId: "beta",
        points: [{ timestamp: 2, ...totals(), cost: 0, cumulativeTokens: 20, cumulativeCost: 2 }],
      },
      { logs: [] },
      { logs: [{ timestamp: 2, role: "assistant", content: "world", tokens: 4 }] },
    );

    await usage.loadSessionDetailTab("alpha", "timeline");
    await usage.loadSessionDetailTab("alpha", "timeline");
    await usage.loadSessionDetailTab("beta", "timeline");

    await usage.loadSessionDetailTab("alpha", "messages");
    await usage.loadSessionDetailTab("alpha", "messages");
    await usage.loadSessionDetailTab("beta", "messages");

    expect(sendCalls).toEqual([
      { method: "sessions.usage.timeseries", params: { key: "alpha" } },
      { method: "sessions.usage.timeseries", params: { key: "beta" } },
      { method: "sessions.usage.logs", params: { key: "alpha", limit: 100 } },
      { method: "sessions.usage.logs", params: { key: "beta", limit: 100 } },
    ]);
    expect(usage.sessionTimeseries.value?.sessionId).toBe("beta");
    expect(usage.sessionLogs.value[0]?.content).toBe("world");
  });

  test("detail tab loaders ignore stale in-flight responses and replay the latest session key", async () => {
    const usage = await importUsageState();
    const alphaTimeseries = deferred<unknown>();
    const alphaLogs = deferred<unknown>();
    gatewayResponses.push(
      alphaTimeseries.promise,
      {
        sessionId: "beta",
        points: [{ timestamp: 2, ...totals(), cost: 0, cumulativeTokens: 20, cumulativeCost: 2 }],
      },
      alphaLogs.promise,
      { logs: [{ timestamp: 2, role: "assistant", content: "world", tokens: 4 }] },
    );

    const firstTimeseriesLoad = usage.loadSessionDetailTab("alpha", "timeline");
    await flushPromises();
    const queuedTimeseriesLoad = usage.loadSessionDetailTab("beta", "timeline");
    await flushPromises();
    expect(sendCalls).toEqual([{ method: "sessions.usage.timeseries", params: { key: "alpha" } }]);

    alphaTimeseries.resolve({
      sessionId: "alpha",
      points: [{ timestamp: 1, ...totals(), cost: 0, cumulativeTokens: 10, cumulativeCost: 1 }],
    });
    await firstTimeseriesLoad;
    await queuedTimeseriesLoad;
    expect(sendCalls.filter((call) => call.method === "sessions.usage.timeseries")).toEqual([
      { method: "sessions.usage.timeseries", params: { key: "alpha" } },
      { method: "sessions.usage.timeseries", params: { key: "beta" } },
    ]);
    expect(usage.sessionTimeseries.value?.sessionId).toBe("beta");

    const firstLogsLoad = usage.loadSessionDetailTab("alpha", "messages");
    await flushPromises();
    const queuedLogsLoad = usage.loadSessionDetailTab("beta", "messages");
    await flushPromises();
    alphaLogs.resolve({ logs: [{ timestamp: 1, role: "user", content: "hello", tokens: 3 }] });
    await firstLogsLoad;
    await queuedLogsLoad;

    expect(sendCalls.filter((call) => call.method === "sessions.usage.logs")).toEqual([
      { method: "sessions.usage.logs", params: { key: "alpha", limit: 100 } },
      { method: "sessions.usage.logs", params: { key: "beta", limit: 100 } },
    ]);
    expect(usage.sessionLogs.value[0]?.content).toBe("world");
  });

  test("sort, pagination, and selected-session table helpers update state", async () => {
    const usage = await importUsageState();
    const alpha = sessionEntry("alpha");

    usage.sessionsPage.value = 2;
    usage.toggleSessionsSort("cost");
    expect(usage.sessionsSortBy.value).toBe("cost");
    expect(usage.sessionsSortDesc.value).toBe(true);
    expect(usage.sessionsPage.value).toBe(0);

    usage.sessionsPage.value = 1;
    usage.toggleSessionsSort("cost");
    expect(usage.sessionsSortDesc.value).toBe(false);
    expect(usage.sessionsPage.value).toBe(0);

    usage.toggleSelectedSession(alpha);
    expect(usage.selectedSession.value?.key).toBe("alpha");
    usage.toggleSelectedSession(alpha);
    expect(usage.selectedSession.value).toBeNull();
  });

  test("clearSessionDetail resets modal detail state and loaded detail keys", async () => {
    const usage = await importUsageState();
    const alpha = sessionEntry("alpha");
    gatewayResponses.push(
      { sessionId: "alpha", points: [] },
      { logs: [{ timestamp: 1, role: "user", content: "hello" }] },
      { sessionId: "alpha", points: [] },
    );
    usage.selectedSession.value = alpha;
    usage.detailTab.value = "messages";

    await usage.loadSessionTimeseries("alpha");
    await usage.loadSessionLogs("alpha");
    usage.clearSessionDetail();

    expect(usage.selectedSession.value).toBeNull();
    expect(usage.detailTab.value).toBe("overview");
    expect(usage.sessionTimeseries.value).toBeNull();
    expect(usage.sessionLogs.value).toEqual([]);

    await usage.loadSessionTimeseries("alpha");
    expect(sendCalls.filter((call) => call.method === "sessions.usage.timeseries")).toHaveLength(2);
  });

  test("failed session log switch does not poison the previous session cache key", async () => {
    const usage = await importUsageState();
    gatewayResponses.push(
      { logs: [{ timestamp: 1, role: "user", content: "hello" }] },
      new Error("logs unavailable"),
      { logs: [] },
    );

    await usage.loadSessionLogs("alpha");
    await usage.loadSessionLogs("beta");
    await usage.loadSessionLogs("alpha");

    expect(sendCalls).toEqual([
      { method: "sessions.usage.logs", params: { key: "alpha", limit: 100 } },
      { method: "sessions.usage.logs", params: { key: "beta", limit: 100 } },
      { method: "sessions.usage.logs", params: { key: "alpha", limit: 100 } },
    ]);
    expect(usage.sessionLogs.value).toEqual([]);
  });

  test("failed session timeseries switch does not poison the previous session cache key", async () => {
    const usage = await importUsageState();
    gatewayResponses.push({ sessionId: "alpha", points: [] }, new Error("timeseries unavailable"), {
      sessionId: "alpha",
      points: [],
    });

    await usage.loadSessionTimeseries("alpha");
    await usage.loadSessionTimeseries("beta");
    await usage.loadSessionTimeseries("alpha");

    expect(sendCalls).toEqual([
      { method: "sessions.usage.timeseries", params: { key: "alpha" } },
      { method: "sessions.usage.timeseries", params: { key: "beta" } },
      { method: "sessions.usage.timeseries", params: { key: "alpha" } },
    ]);
    expect(usage.sessionTimeseries.value?.sessionId).toBe("alpha");
  });
});

async function importUsageState() {
  // @ts-ignore Query suffix gives each test fresh module state.
  return import(`../../../src/views/usage/useUsageViewState.ts?unit=${importCounter++}`);
}

function totals(overrides: Partial<UsageTotals> = {}): UsageTotals {
  return {
    input: 1,
    output: 2,
    totalTokens: 3,
    cacheRead: 4,
    cacheWrite: 5,
    totalCost: 0.01,
    ...overrides,
  };
}

function costSummary(days: number): CostUsageSummary {
  return {
    days,
    totals: totals(),
    daily: [],
  };
}

function sessionEntry(key: string, overrides: Partial<SessionUsageEntry> = {}): SessionUsageEntry {
  return {
    key,
    label: key.toUpperCase(),
    model: "anthropic/claude-sonnet",
    updatedAt: 1,
    usage: totals(),
    ...overrides,
  };
}

function sessionsResult(sessions: SessionUsageEntry[]): SessionsUsageResult {
  return {
    sessions,
    totals: totals(),
    startDate: daysAgoDate(30),
    endDate: daysAgoDate(0),
  };
}

function daysAgoDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
