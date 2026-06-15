import { describe, expect, test } from "bun:test";
import {
  getToolDefinition,
  getToolGroupPhrase,
  getToolGroupPriority,
  getToolIconKindForToolCalls,
  getToolInputBlockKind,
  getToolItemVerb,
  getToolPreview,
  getToolResultPreview,
  getToolResultBlockKind,
  isExecToolName,
} from "../../../../src/components/chat/tool-registry";
import type { ToolCall } from "../../../../src/types/messages";

function toolCall(overrides: Partial<ToolCall>): ToolCall {
  return {
    id: "tool-1",
    name: "read",
    status: "complete",
    args: {},
    ...overrides,
  };
}

describe("tool registry", () => {
  test("keeps tool metadata in one editable definition", () => {
    const definition = getToolDefinition("web_search");

    expect(definition.kind).toBe("search");
    expect(definition.icon).toBe("search");
    expect(definition.inputBlock).toBe("search");
    expect(definition.resultBlock).toBe("web-search");
    expect(definition.label({})).toBe("Web search");
    expect(getToolPreview(toolCall({ args: { query: "tool registry" }, name: "web_search" }))).toBe(
      "tool registry",
    );
    expect(
      getToolResultPreview(toolCall({ name: "web_search", result: { results: [1, 2] } })),
    ).toBe("2 results");
    expect(getToolGroupPriority("search")).toBeLessThan(getToolGroupPriority("fetch"));
    expect(getToolIconKindForToolCalls([toolCall({ name: "web_search" })])).toBe("search");
    expect(getToolGroupPhrase("search", 2, true)).toBe("searching 2 times");
    expect(getToolItemVerb(toolCall({ name: "web_search", status: "running" }))).toBe("Searching");
  });

  test("uses one definition for tool aliases", () => {
    expect(isExecToolName("Bash")).toBe(true);
    expect(getToolDefinition("Bash").kind).toBe("exec");
    expect(getToolInputBlockKind("Bash", { command: "echo ok" })).toBe("exec");
    expect(getToolInputBlockKind("Bash", { commandText: "echo ok" })).toBe("exec");
    expect(getToolInputBlockKind("Bash", { argv: ["/bin/zsh", "-lc", "echo ok"] })).toBe("exec");
    expect(getToolResultBlockKind("Bash")).toBe("code");
  });

  test("falls back to custom metadata for unknown tools", () => {
    const definition = getToolDefinition("Heartbeat");

    expect(definition.kind).toBe("custom");
    expect(definition.icon).toBe("custom");
    expect(definition.label({})).toBe("Heartbeat");
    expect(getToolInputBlockKind("Heartbeat", {})).toBe("code");
    expect(getToolResultBlockKind("Heartbeat")).toBe("code");
    expect(
      getToolPreview(
        toolCall({
          args: {
            action: "respond",
            requestId: "req_123",
          },
          name: "Heartbeat",
        }),
      ),
    ).toBe("respond");
    expect(getToolGroupPriority("custom:Heartbeat")).toBeGreaterThan(
      getToolGroupPriority("status"),
    );
    expect(getToolGroupPhrase("custom:Heartbeat", 1, false)).toBe("used Heartbeat");
    expect(getToolItemVerb(toolCall({ name: "Heartbeat", status: "running" }))).toBe("Using");
  });
});
