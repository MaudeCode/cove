/** @jsxImportSource preact */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import { fireEvent, renderComponent, screen } from "../../../helpers/dom";
import { installI18nMock } from "../../../helpers/i18n";
import { installUiComponentAliases } from "../../../helpers/module-aliases";
import type { ToolCall as ToolCallType } from "../../../../src/types/messages";

installI18nMock({
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
});
await installUiComponentAliases();

const execApprovalBusy = signal(false);
const execApprovalError = signal<string | null>(null);
const resolvedApprovalIds = signal(new Map<string, string>());
const approvalDecisions: Array<{ approvalId: string; decision: string }> = [];

mock.module("@/signals/exec", () => ({
  execApprovalBusy,
  execApprovalError,
  handleExecApprovalDecisionDirect: async (approvalId: string, decision: string) => {
    approvalDecisions.push({ approvalId, decision });
  },
  initExecApproval: () => undefined,
  resolvedApprovalIds,
}));

mock.module("../../../../src/components/chat/tool-blocks", () => ({
  BrowserInputBlock: () => <div data-testid="browser-input" />,
  BrowserResultBlock: () => <div data-testid="browser-result" />,
  CodeBlock: ({ content }: { content: unknown }) => (
    <pre data-testid="code-block">{JSON.stringify(content)}</pre>
  ),
  CronInputBlock: () => <div data-testid="cron-input" />,
  CronResultBlock: () => <div data-testid="cron-result" />,
  EditDiffBlock: () => <div data-testid="edit-input" />,
  ExecCommandBlock: () => <div data-testid="exec-input" />,
  GatewayInputBlock: () => <div data-testid="gateway-input" />,
  GatewayResultBlock: () => <div data-testid="gateway-result" />,
  ImageInputBlock: () => <div data-testid="image-input" />,
  ImageResultBlock: () => <div data-testid="image-result" />,
  MemoryGetInputBlock: () => <div data-testid="memory-get-input" />,
  MemoryGetResultBlock: () => <div data-testid="memory-get-result" />,
  MemorySearchResultBlock: () => <div data-testid="memory-search-result" />,
  MessageInputBlock: () => <div data-testid="message-input" />,
  MessageResultBlock: () => <div data-testid="message-result" />,
  ReadInputBlock: () => <div data-testid="read-input" />,
  ResultBlock: ({ toolName }: { toolName?: string }) => <div data-testid={`${toolName}-result`} />,
  SearchInputBlock: () => <div data-testid="search-input" />,
  SessionStatusInputBlock: () => <div data-testid="session-status-input" />,
  SessionStatusResultBlock: () => <div data-testid="session-status-result" />,
  UrlInputBlock: () => <div data-testid="url-input" />,
  WebFetchResultBlock: () => <div data-testid="web-fetch-result" />,
  WebSearchResultBlock: () => <div data-testid="web-search-result" />,
  WriteInputBlock: () => <div data-testid="write-input" />,
  parseErrorResult: (result: unknown) => {
    if (!result || typeof result !== "object") return null;
    const record = result as Record<string, unknown>;
    return typeof record.error === "string" ? { error: record.error, tool: record.tool } : null;
  },
}));

const { ToolCall, clearExpandedToolCalls } =
  await import("../../../../src/components/chat/ToolCall");

function toolCall(overrides: Partial<ToolCallType>): ToolCallType {
  return {
    id: "tool-1",
    name: "read",
    status: "complete",
    args: {},
    ...overrides,
  };
}

describe("ToolCall", () => {
  beforeEach(() => {
    clearExpandedToolCalls();
    execApprovalBusy.value = false;
    execApprovalError.value = null;
    resolvedApprovalIds.value = new Map();
    approvalDecisions.length = 0;
  });

  test("expands approval-pending tool calls and sends approval decisions", () => {
    renderComponent(
      <ToolCall
        toolCall={toolCall({
          name: "exec",
          args: { command: "rm -rf build" },
          result: {
            details: {
              approvalId: "approval-1",
              command: "rm -rf build",
              expiresAtMs: Date.now() + 30_000,
              status: "approval-pending",
            },
          },
        })}
      />,
    );

    expect(document.querySelector("button[aria-expanded]")?.getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(screen.getByRole("region", { name: "exec.approvalNeeded" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "exec.allowOnce" }));
    expect(approvalDecisions).toEqual([{ approvalId: "approval-1", decision: "allow-once" }]);
  });

  test("routes specialized inputs and delegates results with the tool name", () => {
    renderComponent(
      <ToolCall
        toolCall={toolCall({
          args: { query: "cove tests" },
          name: "web_search",
          result: { results: [] },
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Web search/ }));

    expect(screen.getByTestId("search-input")).toBeTruthy();
    expect(screen.getByTestId("web_search-result")).toBeTruthy();
  });

  test("prefers commandPreview for collapsed exec display and keeps canonical input in raw details", () => {
    renderComponent(
      <ToolCall
        toolCall={toolCall({
          args: {
            command: '/bin/zsh -lc "bun run build -- --mode production"',
            commandPreview: "bun run build -- --mode production",
          },
          name: "exec",
        })}
      />,
    );

    const row = screen.getByRole("button", { name: /Exec/ });
    expect(row.textContent).toContain("bun run build -- --mode production");
    expect(row.textContent).not.toContain("/bin/zsh -lc");

    fireEvent.click(row);
    fireEvent.click(screen.getByRole("button", { name: "toolBlock.showRaw" }));

    expect(screen.getByTestId("code-block").textContent).toContain("/bin/zsh -lc");
    expect(screen.getByTestId("code-block").textContent).toContain("commandPreview");
  });

  test("unwraps simple shell carriers for preview-absent exec calls without mutating details", () => {
    renderComponent(
      <ToolCall
        toolCall={toolCall({
          args: {
            command: "/bin/bash -lc 'bun test tests/unit/components/chat/ToolCall.test.tsx'",
          },
          name: "exec",
        })}
      />,
    );

    const row = screen.getByRole("button", { name: /Exec/ });
    expect(row.textContent).toContain("bun test tests/unit/components/chat/ToolCall.test.tsx");
    expect(row.textContent).not.toContain("/bin/bash -lc");

    fireEvent.click(row);
    fireEvent.click(screen.getByRole("button", { name: "toolBlock.showRaw" }));
    expect(screen.getByTestId("code-block").textContent).toContain("/bin/bash -lc");
  });

  test("treats OpenClaw Bash tool calls as commands instead of previewing cwd", () => {
    renderComponent(
      <ToolCall
        toolCall={toolCall({
          args: {
            command: '/bin/zsh -lc "echo heartbeat"',
            cwd: "/Users/maudebot/agents/maude",
          },
          name: "Bash",
        })}
      />,
    );

    const row = screen.getByRole("button", { name: /Exec/ });
    expect(row.textContent).toContain("echo heartbeat");
    expect(row.textContent).not.toContain("/Users/maudebot/agents/maude");
  });

  test("keeps protocol identifiers and raw payloads out of collapsed fallback summaries", () => {
    renderComponent(
      <ToolCall
        toolCall={toolCall({
          args: {
            action: "rpc.call",
            canonicalCommand: "/bin/zsh -lc secret-debug-command",
            eventId: "evt_raw_123",
            payload: { method: "session.list", params: { raw: true } },
            rawPayload: "raw gateway frame",
            requestId: "req_456",
          },
          name: "gateway",
        })}
      />,
    );

    const row = screen.getByRole("button", { name: /Gateway Rpc call/ });
    expect(row.textContent).toContain("Gateway Rpc call");
    expect(row.textContent).not.toContain("evt_raw_123");
    expect(row.textContent).not.toContain("session.list");
    expect(row.textContent).not.toContain("req_456");
    expect(row.textContent).not.toContain("secret-debug-command");
    expect(row.textContent).not.toContain("raw gateway frame");
  });

  test("shows failure and result previews in the collapsed row", () => {
    renderComponent(
      <ToolCall
        toolCall={toolCall({
          args: { query: "cove release checks" },
          name: "web_search",
          result: { error: "network unavailable", tool: "web_search" },
          status: "complete",
        })}
      />,
    );

    const row = screen.getByRole("button", { name: /Web search/ });
    expect(row.textContent).toContain("cove release checks");
    expect(row.textContent).toContain("Failed");
    expect(row.textContent).toContain("Error: network unavailable");
  });
});
