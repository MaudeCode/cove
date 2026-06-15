import { describe, expect, mock, test } from "bun:test";
import type { ContentBlock, RawMessage } from "../../../src/types/chat";

const messageDetection = await import("../../../src/lib/message-detection");
const toolUtils = await import("../../../src/lib/tool-utils");
mock.module("@/lib/message-detection", () => messageDetection);
mock.module("@/lib/tool-utils", () => toolUtils);

const { mergeToolCalls, normalizeMessage, parseMessageContent } =
  await import("../../../src/types/chat");

describe("chat content parsing", () => {
  test("parses mixed content blocks into text, images, thinking, and interleaved tool calls", () => {
    const content: ContentBlock[] = [
      { type: "text", text: "First paragraph" },
      { type: "text", text: "Second paragraph" },
      {
        type: "tool_use",
        id: "tool-1",
        name: "read",
        input: { path: "README.md" },
      },
      {
        type: "tool_result",
        id: "tool-1",
        content: [{ type: "text", text: "file body" }],
      },
      {
        type: "toolCall",
        id: "tool-2",
        name: "exec",
        arguments: { command: "bun test" },
      },
      {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: "abc123",
        },
      },
      { type: "image", data: "def456", mimeType: "image/jpeg" },
      { type: "thinking", thinking: "  reasoned step 1  " },
      { type: "thinking", thinking: "reasoned step 2" },
    ];

    const parsed = parseMessageContent(content);

    expect(parsed.text).toBe("First paragraph\nSecond paragraph");
    expect(parsed.images).toEqual([
      { url: "data:image/png;base64,abc123", alt: "Image" },
      { url: "data:image/jpeg;base64,def456", alt: "Image" },
    ]);
    expect(parsed.thinking).toBe("reasoned step 1\n\nreasoned step 2");
    expect(parsed.toolCalls).toHaveLength(2);
    expect(parsed.toolCalls[0]).toMatchObject({
      id: "tool-1",
      name: "read",
      args: { path: "README.md" },
      result: "file body",
      status: "complete",
      insertedAtContentLength: "First paragraph\nSecond paragraph".length,
    });
    expect(parsed.toolCalls[1]).toMatchObject({
      id: "tool-2",
      name: "exec",
      args: { command: "bun test" },
      status: "pending",
      insertedAtContentLength: "First paragraph\nSecond paragraph".length,
    });
  });

  test("preserves omitted image markers with byte counts", () => {
    expect(
      parseMessageContent([
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            omitted: true,
            bytes: 12345,
          },
        },
      ]).images,
    ).toEqual([{ url: "", alt: "Image omitted", omitted: true, bytes: 12345 }]);
  });

  test("preserves inline tool result error metadata before flattening display content", () => {
    const parsed = parseMessageContent([
      {
        type: "toolCall",
        id: "tool-1",
        name: "exec",
        arguments: { command: "bun test" },
      },
      {
        type: "tool_result",
        id: "tool-1",
        content: {
          status: "error",
          error: "command failed",
          content: [{ type: "text", text: "display output" }],
        },
      },
    ]);

    expect(parsed.toolCalls).toHaveLength(1);
    expect(parsed.toolCalls[0]).toMatchObject({
      id: "tool-1",
      name: "exec",
      result: {
        status: "error",
        error: "command failed",
        tool: "exec",
      },
      status: "error",
    });
  });
});

describe("chat message normalization", () => {
  test("strips user envelope metadata and message ids", () => {
    const raw: RawMessage = {
      role: "user",
      content:
        'Conversation info (untrusted metadata):\n```json\n{"source":{"nested":true},"id":"m1"}\n```\n\n[message_id: abc]\nHello',
      timestamp: 10,
    };

    expect(normalizeMessage(raw, "msg-1")).toMatchObject({
      id: "msg-1",
      role: "user",
      content: "Hello",
      timestamp: 10,
      isStreaming: false,
    });
  });

  test("strips assistant envelope metadata without stripping visible message ids", () => {
    const raw: RawMessage = {
      role: "assistant",
      content:
        "```metadata\nsender: assistant\nmessage_id: msg_assistant\n```\n\nmessage_id: msg_line\nVisible response",
      timestamp: 20,
    };

    expect(normalizeMessage(raw, "msg-2")).toMatchObject({
      id: "msg-2",
      role: "assistant",
      content: "message_id: msg_line\nVisible response",
      timestamp: 20,
    });
  });

  test("preserves assistant bracketed message id lines as visible content", () => {
    const raw: RawMessage = {
      role: "assistant",
      content: "[message_id: visible-assistant-id]\nVisible response",
      timestamp: 25,
    };

    expect(normalizeMessage(raw, "msg-assistant-visible")).toMatchObject({
      id: "msg-assistant-visible",
      role: "assistant",
      content: "[message_id: visible-assistant-id]\nVisible response",
      timestamp: 25,
    });
  });

  test("strips system envelope metadata without changing the role", () => {
    const raw: RawMessage = {
      role: "system",
      content:
        'Conversation info (untrusted metadata):\n```json\n{"sender":"system","message_id":"msg_system"}\n```\n\nSystem note',
      timestamp: 30,
    };

    expect(normalizeMessage(raw, "msg-3")).toMatchObject({
      id: "msg-3",
      role: "system",
      content: "System note",
      timestamp: 30,
    });
  });

  test("preserves system standalone message id lines as visible content", () => {
    const raw: RawMessage = {
      role: "system",
      content: "message_id: visible-system-id\nSystem note",
      timestamp: 35,
    };

    expect(normalizeMessage(raw, "msg-system-visible")).toMatchObject({
      id: "msg-system-visible",
      role: "system",
      content: "message_id: visible-system-id\nSystem note",
      timestamp: 35,
    });
  });

  test("does not strip tool result payloads passed through normalization", () => {
    const raw: RawMessage = {
      role: "toolResult",
      toolCallId: "tool-1",
      content: "message_id: file-key\npayload",
    };

    expect(normalizeMessage(raw, "tool-msg")).toMatchObject({
      role: "assistant",
      content: "message_id: file-key\npayload",
    });
  });

  test("carries structured OpenClaw compaction and truncation metadata", () => {
    const raw: RawMessage = {
      role: "user",
      content: "<summary>Older messages</summary>",
      __openclaw: { kind: "compaction", truncated: true, reason: "oversized" },
    };

    expect(normalizeMessage(raw, "msg-1")).toMatchObject({
      kind: "compaction",
      historyTruncated: true,
      historyTruncationReason: "oversized",
    });
  });

  test("carries flattened OpenClaw compaction and truncation metadata", () => {
    const raw: RawMessage = {
      role: "user",
      content: "<summary>Older messages</summary>",
      "__openclaw.kind": "compaction",
      "__openclaw.truncated": true,
      "__openclaw.reason": "limit",
    };

    expect(normalizeMessage(raw, "msg-1")).toMatchObject({
      kind: "compaction",
      historyTruncated: true,
      historyTruncationReason: "limit",
    });
  });

  test("detects and strips chat history truncation suffixes", () => {
    const raw: RawMessage = {
      role: "assistant",
      content: "Visible response\n...(truncated)...",
    };

    expect(normalizeMessage(raw, "msg-1")).toMatchObject({
      content: "Visible response",
      historyTruncated: true,
    });
  });

  test("detects oversized chat history placeholders", () => {
    const raw: RawMessage = {
      role: "assistant",
      content: "[chat.history omitted: message too large]",
    };

    expect(normalizeMessage(raw, "msg-1")).toMatchObject({
      historyTruncated: true,
      historyTruncationReason: "oversized",
    });
  });
});

describe("tool call merging", () => {
  test("updates existing tool calls and keeps original startedAt", () => {
    expect(
      mergeToolCalls(
        [{ id: "tool-1", name: "read", status: "running", startedAt: 100 }],
        [
          {
            id: "tool-1",
            name: "read",
            status: "complete",
            startedAt: 200,
            completedAt: 300,
            result: "done",
          },
          { id: "tool-2", name: "exec", status: "pending" },
        ],
      ),
    ).toEqual([
      {
        id: "tool-1",
        name: "read",
        status: "complete",
        startedAt: 100,
        completedAt: 300,
        result: "done",
      },
      { id: "tool-2", name: "exec", status: "pending" },
    ]);
  });

  test("does not erase existing fields with undefined partial updates", () => {
    expect(
      mergeToolCalls(
        [
          {
            id: "tool-1",
            name: "read",
            args: { path: "README.md" },
            result: "old result",
            status: "complete",
          },
        ],
        [{ id: "tool-1", name: "read", args: undefined, result: undefined, status: "running" }],
      ),
    ).toEqual([
      {
        id: "tool-1",
        name: "read",
        args: { path: "README.md" },
        result: "old result",
        status: "running",
      },
    ]);
  });
});
