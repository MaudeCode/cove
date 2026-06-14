import { beforeAll, describe, expect, test } from "bun:test";

let mergeDeltaText: typeof import("../../../src/lib/streaming").mergeDeltaText;

beforeAll(async () => {
  (globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = "test";
  ({ mergeDeltaText } = await import("../../../src/lib/streaming"));
});

describe("mergeDeltaText", () => {
  test("uses first delta as content", () => {
    expect(mergeDeltaText("", "Hello")).toEqual({ content: "Hello" });
  });

  test("replaces simple accumulated continuations", () => {
    expect(mergeDeltaText("Hel", "Hello")).toEqual({ content: "Hello" });
  });

  test("appends a new block after tool output when delta text resets", () => {
    expect(mergeDeltaText("Before tool", "After tool")).toEqual({
      content: "Before tool\n\nAfter tool",
      lastBlockStart: "Before tool\n\n".length,
    });
  });

  test("continues the active post-tool block", () => {
    expect(mergeDeltaText("Before tool\n\nAf", "After tool", "Before tool\n\n".length)).toEqual({
      content: "Before tool\n\nAfter tool",
      lastBlockStart: "Before tool\n\n".length,
    });
  });

  test("ignores stale shorter deltas for the active post-tool block", () => {
    expect(mergeDeltaText("Before tool\n\nAfter", "Af", "Before tool\n\n".length)).toEqual({
      content: "Before tool\n\nAfter",
      lastBlockStart: "Before tool\n\n".length,
    });
  });

  test("starts another block when post-tool text resets again", () => {
    expect(mergeDeltaText("One\n\nTwo words", "Three", "One\n\n".length)).toEqual({
      content: "One\n\nTwo words\n\nThree",
      lastBlockStart: "One\n\nTwo words\n\n".length,
    });
  });
});
