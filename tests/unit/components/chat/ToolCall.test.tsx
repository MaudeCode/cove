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
  parseErrorResult: () => null,
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

    fireEvent.click(screen.getByRole("button", { name: /web_search/ }));

    expect(screen.getByTestId("search-input")).toBeTruthy();
    expect(screen.getByTestId("web_search-result")).toBeTruthy();
  });
});
