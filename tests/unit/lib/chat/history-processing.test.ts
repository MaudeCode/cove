import { describe, expect, mock, test } from "bun:test";

(globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = "test";

const constants = await import("../../../../src/lib/constants");
const messageDetection = await import("../../../../src/lib/message-detection");
const toolUtils = await import("../../../../src/lib/tool-utils");
const typesChat = await import("../../../../src/types/chat");

mock.module("@/lib/constants", () => constants);
mock.module("@/lib/message-detection", () => messageDetection);
mock.module("@/lib/tool-utils", () => toolUtils);
mock.module("@/types/chat", () => typesChat);

const { normalizeHistoryMessages } = await import("../../../../src/lib/chat/history-processing");

describe("normalizeHistoryMessages", () => {
  test("attaches separate toolResult history messages to assistant tool calls", () => {
    const messages = normalizeHistoryMessages([
      {
        role: "assistant",
        content: [
          {
            type: "toolCall",
            id: "tool-1",
            name: "read",
            arguments: { path: "README.md" },
          },
        ],
        timestamp: 1000,
      },
      {
        role: "toolResult",
        toolCallId: "tool-1",
        content: [
          { type: "text", text: "first" },
          { type: "text", text: "second" },
        ],
        isError: false,
        timestamp: 1001,
      },
    ]);

    expect(messages).toHaveLength(1);
    expect(messages[0].toolCalls).toEqual([
      {
        id: "tool-1",
        name: "read",
        args: { path: "README.md" },
        status: "complete",
        insertedAtContentLength: 0,
        result: "first\nsecond",
        completedAt: expect.any(Number),
      },
    ]);
  });

  test("marks attached error tool results as errored", () => {
    const messages = normalizeHistoryMessages([
      {
        role: "assistant",
        content: [
          { type: "text", text: "before" },
          {
            type: "toolCall",
            id: "tool-error",
            name: "read",
            arguments: { path: "missing.md" },
          },
        ],
        timestamp: 1000,
      },
      {
        role: "toolResult",
        toolCallId: "tool-error",
        content: { tool: "read", error: "not found" } as never,
        isError: true,
        timestamp: 1001,
      },
    ]);

    expect(messages).toHaveLength(1);
    expect(messages[0].toolCalls?.[0]).toMatchObject({
      id: "tool-error",
      result: { tool: "read", error: "not found" },
      status: "error",
    });
  });

  test("merges same-turn assistant messages and adjusts later tool positions", () => {
    const messages = normalizeHistoryMessages([
      {
        role: "assistant",
        content: [{ type: "text", text: "first" }],
        timestamp: 1000,
      },
      {
        role: "assistant",
        content: [
          { type: "text", text: "second" },
          {
            type: "toolCall",
            id: "tool-2",
            name: "grep",
            arguments: { q: "needle" },
          },
        ],
        timestamp: 1000 + constants.SAME_TURN_THRESHOLD_MS - 1,
      },
    ]);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      content: "first\n\nsecond",
      timestamp: 1000 + constants.SAME_TURN_THRESHOLD_MS - 1,
    });
    expect(messages[0].toolCalls?.[0]).toMatchObject({
      id: "tool-2",
      insertedAtContentLength: "first\n\nsecond".length,
    });
  });

  test("preserves truncation metadata when merging same-turn history", () => {
    const messages = normalizeHistoryMessages([
      {
        role: "assistant",
        content: "first",
        timestamp: 1000,
      },
      {
        role: "assistant",
        content: "second\n...(truncated)...",
        timestamp: 1001,
      },
    ]);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      content: "first\n\nsecond",
      historyTruncated: true,
    });
  });

  test("preserves thinking and images from merged same-turn assistant messages", () => {
    const messages = normalizeHistoryMessages([
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "first thought" },
          { type: "text", text: "first" },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: "first-image",
            },
          },
        ],
        timestamp: 1000,
      },
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "second thought" },
          { type: "text", text: "second" },
          {
            type: "image",
            data: "data:image/webp;base64,second-image",
            mimeType: "image/webp",
          },
        ],
        timestamp: 1001,
      },
    ]);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      content: "first\n\nsecond",
      thinking: "first thought\n\nsecond thought",
      images: [
        { url: "data:image/png;base64,first-image", alt: "Image" },
        { url: "data:image/webp;base64,second-image", alt: "Image" },
      ],
    });
  });
});
