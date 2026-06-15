import { describe, expect, test } from "bun:test";
import { extractToolResultContent } from "../../../src/lib/tool-utils";

describe("extractToolResultContent", () => {
  test("returns primitive tool results unchanged", () => {
    expect(extractToolResultContent("plain output")).toBe("plain output");
    expect(extractToolResultContent(null)).toBeNull();
  });

  test("extracts all-text blocks from direct content arrays", () => {
    expect(
      extractToolResultContent([
        { type: "text", text: "first" },
        { type: "text", text: "second" },
      ]),
    ).toBe("first\nsecond");
  });

  test("extracts all text blocks from streaming content envelopes", () => {
    expect(
      extractToolResultContent({
        content: [
          { type: "text", text: "stdout" },
          { type: "text", text: "stderr" },
        ],
        details: { exitCode: 0 },
      }),
    ).toBe("stdout\nstderr");
  });

  test("unwraps OpenClaw toolResult content blocks", () => {
    expect(
      extractToolResultContent([
        {
          type: "toolResult",
          content: [{ type: "text", text: "actual command output" }],
        },
      ]),
    ).toBe("actual command output");
    expect(
      extractToolResultContent({
        content: [
          {
            type: "toolResult",
            result: { content: [{ type: "text", text: "nested result output" }] },
          },
        ],
      }),
    ).toBe("nested result output");
  });

  test("extracts mixed content arrays as bounded display placeholders", () => {
    expect(
      extractToolResultContent([
        { type: "image", data: "abc", bytes: 123 },
        { type: "text", text: "caption" },
      ]),
    ).toBe("[image block: 123 bytes]\ncaption");
    expect(extractToolResultContent({ content: [{ type: "image", data: "abc" }] })).toBe(
      "[image block]",
    );
  });

  test("truncates very large extracted text blocks", () => {
    const text = "a".repeat(200_001);

    expect(extractToolResultContent([{ type: "text", text }])).toBe(
      `${"a".repeat(200_000)}\n[tool result truncated]`,
    );
  });
});
