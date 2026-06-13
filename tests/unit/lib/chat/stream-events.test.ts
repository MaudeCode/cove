import { describe, expect, mock, test } from "bun:test";

(globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = "test";

mock.module("@/lib/streaming", () => import("../../../../src/lib/streaming"));

const { mergeAssistantStreamContent } = await import("../../../../src/lib/chat/stream-events");

describe("mergeAssistantStreamContent", () => {
  test("merges assistant stream deltas around tool boundaries", () => {
    expect(
      mergeAssistantStreamContent(
        { content: "Before", lastBlockStart: undefined },
        null,
        "\n\nAfter",
      ),
    ).toEqual({
      content: "Before\n\nAfter",
      lastBlockStart: undefined,
    });
  });

  test("uses accumulated text continuations and ignores stale shorter text", () => {
    expect(mergeAssistantStreamContent({ content: "Hel" }, "Hello", null)).toEqual({
      content: "Hello",
      lastBlockStart: undefined,
    });
    expect(mergeAssistantStreamContent({ content: "Hello" }, "Hel", null)).toEqual({
      content: "Hello",
      lastBlockStart: undefined,
    });
  });

  test("falls back to block-boundary detection for reset accumulated text without delta", () => {
    expect(mergeAssistantStreamContent({ content: "One" }, "Two", null)).toEqual({
      content: "One\n\nTwo",
      lastBlockStart: "One\n\n".length,
    });
  });
});
