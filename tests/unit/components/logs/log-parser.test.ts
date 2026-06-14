import { beforeEach, describe, expect, test } from "bun:test";
import {
  formatRawLog,
  parseLogLine,
  resetLineIdCounter,
} from "../../../../src/components/logs/log-parser";

describe("log parser", () => {
  beforeEach(() => {
    resetLineIdCounter();
  });

  test("assigns deterministic ids and resets the counter", () => {
    expect(parseLogLine("first").id).toBe(1);
    expect(parseLogLine("second").id).toBe(2);
    resetLineIdCounter();
    expect(parseLogLine("again").id).toBe(1);
  });

  test("parses standard JSON logs and flattens extra fields", () => {
    const parsed = parseLogLine(
      JSON.stringify({
        time: "2026-06-13T12:00:00Z",
        level: "warning",
        msg: "slow request",
        request: { id: "req_1", durationMs: 42 },
        tags: ["gateway", "ui"],
      }),
    );

    expect(parsed).toMatchObject({
      fields: {
        "request.durationMs": "42",
        "request.id": "req_1",
        tags: '["gateway","ui"]',
      },
      level: "warn",
      message: "slow request",
      timestamp: "2026-06-13T12:00:00Z",
    });
  });

  test("uses JSON timestamp variants and synthesizes readable messages from fields", () => {
    const parsed = parseLogLine(
      JSON.stringify({
        timestamp: "2026-06-13T12:00:02Z",
        lvl: "info",
        route: "/health",
        status: 200,
      }),
    );

    expect(parsed).toMatchObject({
      fields: {
        route: "/health",
        status: "200",
      },
      level: "info",
      timestamp: "2026-06-13T12:00:02Z",
    });
    expect(parsed.message).toContain("route=/health");
    expect(parsed.message).toContain("status=200");
  });

  test("falls back from empty msg to non-empty message fields", () => {
    expect(parseLogLine('{"level":"info","msg":"","message":"fallback text"}').message).toBe(
      "fallback text",
    );
  });

  test("parses tslog numbered args and nested JSON strings", () => {
    const parsed = parseLogLine(
      JSON.stringify({
        "0": '{"subsystem":"agent/embedded"}',
        "1": { run: { id: "run_1" }, count: 2 },
        "10": "final message",
        "2": "earlier message",
        _meta: { logLevelName: "ERROR" },
        ts: "2026-06-13T12:00:01Z",
      }),
    );

    expect(parsed.level).toBe("error");
    expect(parsed.timestamp).toBe("2026-06-13T12:00:01Z");
    expect(parsed.message).toBe("final message");
    expect(parsed.fields).toEqual({
      count: "2",
      "run.id": "run_1",
      subsystem: "agent/embedded",
    });
  });

  test("parses supported text log formats", () => {
    expect(parseLogLine("2026-06-13T12:00:00.000Z [gateway] warning issued")).toMatchObject({
      level: "warn",
      message: "[gateway] warning issued",
      timestamp: "2026-06-13T12:00:00.000Z",
    });
    expect(parseLogLine("[2026-06-13T12:00:00Z] INFO: booted")).toMatchObject({
      level: "info",
      message: "booted",
      timestamp: "2026-06-13T12:00:00Z",
    });
    expect(parseLogLine("2026-06-13T12:00:00Z ERR tunnel failed")).toMatchObject({
      level: "error",
      message: "tunnel failed",
      timestamp: "2026-06-13T12:00:00Z",
    });
    expect(parseLogLine("2026-06-13T12:00:00Z INF tunnel ready")).toMatchObject({
      level: "info",
      message: "tunnel ready",
      timestamp: "2026-06-13T12:00:00Z",
    });
    expect(parseLogLine("DEBUG trace enabled")).toMatchObject({
      level: "debug",
      message: "trace enabled",
    });
    expect(parseLogLine("2026-06-13T12:00:00Z WRN tunnel degraded")).toMatchObject({
      level: "warn",
      message: "tunnel degraded",
      timestamp: "2026-06-13T12:00:00Z",
    });
    expect(parseLogLine("2026-06-13T12:00:00Z DBG tunnel trace")).toMatchObject({
      level: "debug",
      message: "tunnel trace",
      timestamp: "2026-06-13T12:00:00Z",
    });
  });

  test("handles malformed and hostile JSON without non-string messages or prototype mutation", () => {
    const malformed = parseLogLine('{"level":"info",');
    expect(malformed.raw).toBe('{"level":"info",');
    expect(malformed.message).toBe('{"level":"info",');
    expect(malformed.fields).toBeUndefined();

    const hostile = parseLogLine(
      '{"level":"err","msg":{"nested":"object"},"constructor":{"prototype":{"polluted":true}},"__proto__":{"polluted":true}}',
    );
    expect(typeof hostile.message).toBe("string");
    expect(hostile.message).toContain("msg=");
    expect(hostile.level).toBe("error");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  test("keeps plain fallback text without inventing timestamp, level, or fields", () => {
    expect(parseLogLine("gateway ready")).toMatchObject({
      fields: undefined,
      level: undefined,
      message: "gateway ready",
      timestamp: undefined,
    });
  });

  test("formats raw JSON only when parsing succeeds", () => {
    expect(formatRawLog('{"b":2,"a":1}')).toBe('{\n  "b": 2,\n  "a": 1\n}');
    expect(formatRawLog('{"bad"')).toBe('{"bad"');
    expect(formatRawLog("plain text")).toBe("plain text");
  });
});
