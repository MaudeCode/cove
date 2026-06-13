import { describe, expect, test } from "bun:test";
import {
  parseErrorResult,
  parseResult,
} from "../../../../../src/components/chat/tool-blocks/utils";

describe("tool block result parsing", () => {
  test("returns object results unchanged", () => {
    const result = { status: "ok", count: 2 };

    expect(parseResult<typeof result>(result)).toBe(result);
  });

  test("parses JSON string results", () => {
    expect(parseResult<{ status: string; count: number }>('{"status":"ok","count":2}')).toEqual({
      status: "ok",
      count: 2,
    });
  });

  test("returns null for invalid JSON and primitive non-string results", () => {
    expect(parseResult("not json")).toBeNull();
    expect(parseResult(123)).toBeNull();
  });

  test("parses structured error results", () => {
    expect(parseErrorResult('{"status":"error","error":"failed","tool":"exec"}')).toEqual({
      status: "error",
      error: "failed",
      tool: "exec",
    });
  });

  test("rejects malformed error results", () => {
    expect(parseErrorResult({ status: "error", error: 123, tool: "exec" })).toBeNull();
    expect(parseErrorResult({ status: "ok", error: "ignored" })).toBeNull();
    expect(parseErrorResult({ status: "error", error: "failed", tool: 123 })).toEqual({
      status: "error",
      error: "failed",
      tool: undefined,
    });
  });
});
