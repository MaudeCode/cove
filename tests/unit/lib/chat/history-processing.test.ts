import { describe, expect, mock, test } from "bun:test";

(globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = "test";

const constants = await import("../../../../src/lib/constants");
const toolUtils = await import("../../../../src/lib/tool-utils");

mock.module("@/lib/constants", () => constants);
mock.module("@/lib/tool-utils", () => toolUtils);
mock.module("@/types/chat", () => ({
  normalizeMessage: (
    raw: { content: unknown; role: "assistant"; timestamp?: number },
    id: string,
  ) => {
    const content = raw.content as Array<{
      arguments?: Record<string, unknown>;
      id: string;
      name: string;
      type: string;
    }>;
    return {
      id,
      role: raw.role,
      content: "",
      timestamp: raw.timestamp ?? 0,
      toolCalls: content
        .filter((block) => block.type === "toolCall")
        .map((block) => ({
          id: block.id,
          name: block.name,
          args: block.arguments,
          insertedAtContentLength: 0,
          status: "pending",
        })),
    };
  },
}));

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
});
