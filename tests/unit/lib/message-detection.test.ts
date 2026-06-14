import { describe, expect, test } from "bun:test";
import {
  isCompactionSummary,
  isCronSummary,
  isHeartbeatMessage,
  isHeartbeatResponse,
  isSystemEvent,
  stripEnvelopeMetadata,
} from "../../../src/lib/message-detection";
import { groupMessages } from "../../../src/lib/message-grouping";
import type { Message } from "../../../src/types/messages";

function message(overrides: Partial<Message>): Message {
  return {
    id: "msg",
    role: "assistant",
    content: "",
    timestamp: 1,
    ...overrides,
  };
}

describe("message detection", () => {
  test("detects heartbeat prompts and responses", () => {
    expect(
      isHeartbeatMessage(
        message({
          role: "user",
          content: "If nothing needs attention, reply HEARTBEAT_OK.",
        }),
      ),
    ).toBe(true);
    expect(isHeartbeatResponse(message({ role: "assistant", content: " heartbeat_ok " }))).toBe(
      true,
    );
    expect(isHeartbeatResponse(message({ role: "user", content: "heartbeat_ok" }))).toBe(false);
  });

  test("detects cron summaries, system events, and compaction summaries", () => {
    expect(isCronSummary(message({ role: "assistant", content: "[cron] job finished" }))).toBe(
      true,
    );
    expect(
      isSystemEvent(message({ role: "user", content: "Pre-compaction memory flush requested" })),
    ).toBe(true);
    expect(isCompactionSummary(message({ role: "user", content: "<summary>Old chat" }))).toBe(true);
  });

  test("strips legacy and fenced gateway envelopes", () => {
    expect(stripEnvelopeMetadata("[WebChat 2026-02-12T23:11Z] hello")).toBe("hello");
    expect(
      stripEnvelopeMetadata(
        'Conversation info (untrusted metadata):\n```json\n{"source":{"nested":true}}\n```\n\nhello',
      ),
    ).toBe("hello");
  });

  test("strips fenced gateway envelopes that contain inline backtick fences", () => {
    expect(
      stripEnvelopeMetadata(
        'Conversation info (untrusted metadata):\n```json\n{"note":"inline ``` marker","id":"secret"}\n```\n\nhello',
      ),
    ).toBe("hello");
  });

  test("strips standalone message id lines", () => {
    expect(stripEnvelopeMetadata("[message_id: a]\nhello\n  [message_id: b]  ")).toBe("hello");
  });

  test("strips fenced sender metadata envelopes", () => {
    expect(
      stripEnvelopeMetadata("```metadata\nsender: assistant\nmessage_id: msg_123\n```\n\nhello"),
    ).toBe("hello");
  });

  test("strips bare standalone message id lines", () => {
    expect(stripEnvelopeMetadata("message_id: msg_123\nhello\n  message-id: msg_456  ")).toBe(
      "hello",
    );
  });

  test("preserves ordinary fenced content and inline message id text", () => {
    const content =
      '```json\n{"message_id":"visible-data","sender":"fixture"}\n```\n\nUse message_id: visible-data here.';

    expect(stripEnvelopeMetadata(content)).toBe(content);
  });

  test("preserves visible yaml fences even when they mention sender metadata fields", () => {
    const content =
      "```yaml\nsender: assistant\nmessage_id: visible-id\nsummary: Visible response data\n```\n\nKeep this visible.";

    expect(stripEnvelopeMetadata(content)).toBe(content);
  });
});

describe("message grouping", () => {
  test("filters heartbeat and system events while preserving normal messages", () => {
    const normal = message({ id: "normal", content: "Visible" });

    expect(
      groupMessages([
        message({ id: "heartbeat-prompt", role: "user", content: "read heartbeat.md" }),
        message({ id: "heartbeat-response", role: "assistant", content: "heartbeat_ok" }),
        message({ id: "system", role: "user", content: "read heartbeat.md if it exists" }),
        normal,
      ]),
    ).toEqual([{ type: "message", message: normal }]);
  });

  test("groups cron and compaction messages", () => {
    const cron = message({ id: "cron", role: "assistant", content: "[cron] complete" });
    const compaction = message({ id: "compaction", role: "user", content: "<summary>Older" });

    expect(groupMessages([cron, compaction])).toEqual([
      { type: "cron", message: cron },
      { type: "compaction", messages: [compaction] },
    ]);
  });

  test("deduplicates regex compaction messages near structural markers", () => {
    const marker = message({ id: "marker", role: "user", content: "", kind: "compaction" });
    const summary = message({ id: "summary", role: "user", content: "<summary>Older" });
    const visible = message({ id: "visible", content: "Visible" });

    expect(groupMessages([marker, summary, visible])).toEqual([
      { type: "compaction", messages: [marker] },
      { type: "message", message: visible },
    ]);
  });
});
