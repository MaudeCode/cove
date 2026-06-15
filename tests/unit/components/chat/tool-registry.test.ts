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
  isFailedToolCall,
  isRunningToolCall,
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
    expect(getToolItemVerb(toolCall({ name: "web_search", status: "running" }), true)).toBe(
      "Searching",
    );
    expect(getToolItemVerb(toolCall({ name: "web_search", status: "error" }))).toBe(
      "Failed to search",
    );
    expect(getToolGroupPhrase("search", 1, false, true)).toBe("failed to search");
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
    expect(getToolItemVerb(toolCall({ name: "Heartbeat", status: "running" }), true)).toBe("Using");
  });

  test("requires a live turn before pending or running tools use active labels", () => {
    const pendingCommand = toolCall({
      args: { commandPreview: "git status -sb" },
      name: "exec",
      status: "pending",
    });
    const runningCommand = toolCall({
      args: { commandPreview: "git status -sb" },
      name: "exec",
      status: "running",
    });

    expect(isRunningToolCall(pendingCommand)).toBe(false);
    expect(isRunningToolCall(runningCommand)).toBe(false);
    expect(isRunningToolCall(pendingCommand, true)).toBe(true);
    expect(isRunningToolCall(runningCommand, true)).toBe(true);
    expect(getToolItemVerb(pendingCommand)).toBe("Started");
    expect(getToolItemVerb(runningCommand)).toBe("Ran");
    expect(getToolItemVerb(runningCommand, true)).toBe("Running");
  });

  test("marks status and error-shaped results as failed", () => {
    expect(isFailedToolCall(toolCall({ name: "read", status: "error" }))).toBe(true);
    expect(
      isFailedToolCall(
        toolCall({
          name: "exec",
          result: { error: "permission denied" },
          status: "complete",
        }),
      ),
    ).toBe(true);
    expect(getToolItemVerb(toolCall({ name: "exec", status: "error" }))).toBe("Failed to run");
  });

  test("uses active wording for grouped non-command tools", () => {
    expect(getToolGroupPhrase("browser", 1, true)).toBe("using browser");
    expect(getToolGroupPhrase("cron", 2, true)).toBe("checking cron 2 times");
    expect(getToolGroupPhrase("gateway", 1, true)).toBe("calling gateway");
    expect(getToolGroupPhrase("media", 2, true)).toBe("handling 2 media items");
    expect(getToolGroupPhrase("message", 1, true)).toBe("sending a message");
    expect(getToolGroupPhrase("status", 2, true)).toBe("checking session status 2 times");

    expect(getToolGroupPhrase("browser", 1)).toBe("used browser");
    expect(getToolGroupPhrase("cron", 1)).toBe("checked cron");
  });
});
