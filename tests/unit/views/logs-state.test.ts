import { beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import { createQueryParamMock } from "../../helpers/module-mocks";
import {
  formatRawLog,
  parseLogLine,
  resetLineIdCounter,
} from "../../../src/components/logs/log-parser";
import {
  formatLogTimestamp,
  levelColors,
  levelIcons,
} from "../../../src/components/logs/constants";

type SendCall = {
  method: string;
  params: unknown;
};

const sendCalls: SendCall[] = [];
const gatewayResponses: unknown[] = [];
const isConnected = signal(true);
let importCounter = 0;
type LogsStateModule = typeof import("../../../src/views/logs/useLogsViewState");

mock.module("@/lib/gateway", () => ({
  isConnected,
  send: async (method: string, params?: unknown) => {
    sendCalls.push({ method, params });
    const response = gatewayResponses.shift();
    if (response instanceof Error) throw response;
    return response;
  },
}));
mock.module("@/lib/i18n", () => ({
  t: (key: string) => key,
}));
mock.module("@/components/logs", () => ({
  formatLogTimestamp,
  formatRawLog,
  levelColors,
  levelIcons,
  parseLogLine,
  resetLineIdCounter,
}));
mock.module("@/hooks/useQueryParam", () => createQueryParamMock());
mock.module("@/hooks/useExpandableFromQueryParamSet", () => ({
  useExpandableFromQueryParamSet: () => undefined,
}));

beforeEach(() => {
  sendCalls.length = 0;
  gatewayResponses.length = 0;
  isConnected.value = true;
});

describe("logs view state", () => {
  test("fetchLogs resets, appends, sends cursors, and maintains level counts", async () => {
    const logs = await importLogsState();
    gatewayResponses.push(logsTail(["INFO booted", "ERROR failed"], { cursor: 42, reset: true }));

    await logs.fetchLogs(true);

    expect(sendCalls).toEqual([
      {
        method: "logs.tail",
        params: {
          cursor: undefined,
          limit: 500,
          maxBytes: 250000,
        },
      },
    ]);
    expect(logs.logFile.value).toBe("/var/log/openclaw.log");
    expect(logs.cursor.value).toBe(42);
    expect(logs.logLines.value.map((line) => [line.id, line.level, line.message])).toEqual([
      [1, "info", "booted"],
      [2, "error", "failed"],
    ]);
    expect(logs.levelCounts.value).toEqual({ debug: 0, info: 1, warn: 0, error: 1 });

    gatewayResponses.push(logsTail(["WARN later"], { cursor: 99 }));
    await logs.fetchLogs();

    expect(sendCalls.at(-1)).toEqual({
      method: "logs.tail",
      params: {
        cursor: 42,
        limit: 500,
        maxBytes: 250000,
      },
    });
    expect(logs.cursor.value).toBe(99);
    expect(logs.logLines.value.map((line) => [line.id, line.level, line.message])).toEqual([
      [1, "info", "booted"],
      [2, "error", "failed"],
      [3, "warn", "later"],
    ]);
    expect(logs.levelCounts.value).toEqual({ debug: 0, info: 1, warn: 1, error: 1 });
  });

  test("gateway reset responses restart parsed line ids without an explicit reset request", async () => {
    const logs = await importLogsState();
    gatewayResponses.push(logsTail(["INFO first"], { cursor: 1 }));
    await logs.fetchLogs(true);

    gatewayResponses.push(logsTail(["DEBUG restarted"], { cursor: 2, reset: true }));
    await logs.fetchLogs();

    expect(sendCalls.at(-1)).toEqual({
      method: "logs.tail",
      params: {
        cursor: 1,
        limit: 500,
        maxBytes: 250000,
      },
    });
    expect(logs.logLines.value.map((line) => [line.id, line.level, line.message])).toEqual([
      [1, "debug", "restarted"],
    ]);
  });

  test("append keeps only the latest 2000 parsed lines", async () => {
    const logs = await importLogsState();
    gatewayResponses.push(logsTail(numberedLines(1999, 0), { cursor: 1999, reset: true }));
    await logs.fetchLogs(true);

    gatewayResponses.push(logsTail(numberedLines(3, 1999), { cursor: 2002 }));
    await logs.fetchLogs();

    expect(logs.logLines.value).toHaveLength(2000);
    expect(logs.logLines.value[0]).toMatchObject({ id: 3, message: "line-2" });
    expect(logs.logLines.value.at(-1)).toMatchObject({ id: 2002, message: "line-2001" });
  });

  test("empty append updates cursor and file without rewriting existing lines", async () => {
    const logs = await importLogsState();
    gatewayResponses.push(logsTail(["INFO cached"], { cursor: 5, file: "/tmp/old.log" }));
    await logs.fetchLogs(true);
    const existingLines = logs.logLines.value;

    gatewayResponses.push(logsTail([], { cursor: 8, file: "/tmp/new.log" }));
    await logs.fetchLogs();

    expect(logs.cursor.value).toBe(8);
    expect(logs.logFile.value).toBe("/tmp/new.log");
    expect(logs.logLines.value).toBe(existingLines);
  });

  test("filters by selected levels and raw search text while counts include all lines", async () => {
    const logs = await importLogsState();
    gatewayResponses.push(
      logsTail([
        "INFO gateway ready",
        "WARN gateway slow",
        "ERROR database failed",
        "DEBUG gateway trace",
        "plain note for gateway",
      ]),
    );
    await logs.fetchLogs(true);

    logs.toggleLevel("warn");
    logs.toggleLevel("error");
    expect(logs.levelCounts.value).toEqual({ debug: 1, info: 1, warn: 1, error: 1 });
    expect(logs.filteredLines.value.map((line) => line.message)).toEqual([
      "gateway slow",
      "database failed",
    ]);

    logs.searchQuery.value = "gateway";
    expect(logs.filteredLines.value.map((line) => line.message)).toEqual(["gateway slow"]);

    logs.clearLevelFilters();
    expect(logs.filteredLines.value.map((line) => line.message)).toEqual([
      "gateway ready",
      "gateway slow",
      "gateway trace",
      "plain note for gateway",
    ]);

    logs.searchQuery.value = "ERROR database";
    expect(logs.filteredLines.value.map((line) => line.message)).toEqual(["database failed"]);
  });

  test("mobile detail state tracks the latest expanded log only on mobile", async () => {
    const logs = await importLogsState();
    gatewayResponses.push(logsTail(["INFO first", "ERROR second"]));
    await logs.fetchLogs(true);

    logs.isMobileViewport.value = false;
    logs.openMobileLogDetails(1);
    expect(logs.expandedLogs.value).toEqual(new Set([1]));
    expect(logs.mobileModalLogId.value).toBeNull();

    logs.isMobileViewport.value = true;
    logs.openMobileLogDetails(2);
    expect(logs.expandedLogs.value).toEqual(new Set([2]));
    expect(logs.mobileModalLogId.value).toBe(2);

    logs.closeMobileLogDetails();
    expect(logs.expandedLogs.value.size).toBe(0);
    expect(logs.mobileModalLogId.value).toBeNull();
  });

  test("clearLogs resets cursor and parser ids, and disconnected fetches are skipped", async () => {
    const logs = await importLogsState();
    gatewayResponses.push(logsTail(["INFO first"], { cursor: 3 }));
    await logs.fetchLogs(true);

    logs.clearLogs();
    expect(logs.logLines.value).toEqual([]);
    expect(logs.cursor.value).toBe(0);

    gatewayResponses.push(logsTail(["ERROR after clear"], { cursor: 4 }));
    await logs.fetchLogs(true);
    expect(logs.logLines.value.map((line) => [line.id, line.message])).toEqual([
      [1, "after clear"],
    ]);

    isConnected.value = false;
    await logs.fetchLogs();
    expect(sendCalls).toHaveLength(2);
  });

  test("failed fetch records an error without replacing existing lines", async () => {
    const logs = await importLogsState();
    gatewayResponses.push(logsTail(["INFO cached"], { cursor: 5 }));
    await logs.fetchLogs(true);

    gatewayResponses.push(new Error("tail unavailable"));
    await logs.fetchLogs();

    expect(logs.error.value).toBe("tail unavailable");
    expect(logs.isLoading.value).toBe(false);
    expect(logs.logLines.value.map((line) => line.message)).toEqual(["cached"]);
    expect(logs.cursor.value).toBe(5);
  });
});

async function importLogsState(): Promise<LogsStateModule> {
  // @ts-ignore Query suffix gives each test fresh module state.
  return import(`../../../src/views/logs/useLogsViewState.ts?unit=${importCounter++}`);
}

function logsTail(
  lines: string[],
  overrides: Partial<{ cursor: number; file: string; reset: boolean }> = {},
) {
  return {
    cursor: overrides.cursor ?? lines.length,
    file: overrides.file ?? "/var/log/openclaw.log",
    lines,
    reset: overrides.reset ?? false,
  };
}

function numberedLines(count: number, offset: number): string[] {
  return Array.from({ length: count }, (_, index) => `INFO line-${offset + index}`);
}
