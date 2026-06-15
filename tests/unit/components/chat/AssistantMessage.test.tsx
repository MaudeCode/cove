/** @jsxImportSource preact */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { act } from "@testing-library/preact";
import { signal } from "@preact/signals";
import { fireEvent, renderComponent, screen } from "../../../helpers/dom";
import { installI18nMock } from "../../../helpers/i18n";
import { installUiComponentAliases } from "../../../helpers/module-aliases";
import { installFakeTimers } from "../../../helpers/timers";
import type { Message } from "../../../../src/types/messages";
import { CHAT_CONTENT_TOGGLE_EVENT } from "../../../../src/lib/chat-scroll";

installI18nMock();
await installUiComponentAliases();
mock.module("@/lib/logger", () => ({
  log: {
    chat: {
      debug: () => undefined,
    },
  },
}));
mock.module("@/lib/utils", () => ({
  isAvatarUrl: (value?: string) => !!value?.startsWith("http"),
}));

const mediaParse = await import("../../../../src/lib/media-parse");
const chatScroll = await import("../../../../src/lib/chat-scroll");
const execApprovalBusy = signal(false);
const execApprovalError = signal<string | null>(null);
const resolvedApprovalIds = signal(new Map<string, string>());

mock.module("@/lib/media-parse", () => mediaParse);
mock.module("@/lib/chat-scroll", () => chatScroll);
mock.module("../../../../src/components/chat/MessageContent", () => ({
  MessageContent: ({ content }: { content: string }) => (
    <span data-testid="message-content">{content}</span>
  ),
}));
mock.module("../../../../src/components/chat/MessageActions", () => ({
  MessageActions: () => <span data-testid="message-actions" />,
}));
mock.module("@/signals/exec", () => ({
  execApprovalBusy,
  execApprovalError,
  handleExecApprovalDecisionDirect: async () => undefined,
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
mock.module("../../../../src/components/chat/ThinkingBlock", () => ({
  ThinkingBlock: ({ content }: { content: string }) => (
    <section data-testid="thinking-block">{content}</section>
  ),
}));
mock.module("@/components/ui/BouncingDots", () => ({
  BouncingDots: () => <span data-testid="bouncing-dots" />,
}));
mock.module("../../../../src/components/chat/HistoryTruncationIndicator", () => ({
  HistoryTruncationIndicator: ({ reason }: { reason?: string }) => (
    <span aria-label={`truncated:${reason ?? ""}`}>truncated</span>
  ),
}));

const { AssistantMessage } = await import("../../../../src/components/chat/AssistantMessage");

function assistantMessage(overrides: Partial<Message>): Message {
  return {
    id: "assistant-1",
    role: "assistant",
    content: "",
    timestamp: 1000,
    isStreaming: false,
    ...overrides,
  };
}

function textContent(): string[] {
  return Array.from(document.querySelectorAll("[data-testid]")).map(
    (element) => element.textContent ?? "",
  );
}

describe("AssistantMessage", () => {
  beforeEach(() => {
    execApprovalBusy.value = false;
    execApprovalError.value = null;
    resolvedApprovalIds.value = new Map();
  });

  test("renders thinking and interleaves tool calls at insertion points", () => {
    renderComponent(
      <AssistantMessage
        message={assistantMessage({
          content: "Before tool after",
          thinking: "reasoning",
          toolCalls: [
            {
              id: "tool-1",
              name: "read",
              status: "complete",
              insertedAtContentLength: "Before".length,
            },
          ],
        })}
      />,
    );

    expect(screen.getByRole("button", { name: "Read file" })).toBeTruthy();
    expect(screen.queryAllByTestId("tool-call")).toHaveLength(0);
    expect(textContent().filter(Boolean)).toEqual(["reasoning", "Before", " tool after"]);
  });

  test("uses present tense and exact target for active single read tools", () => {
    const rendered = renderComponent(
      <AssistantMessage
        isStreaming
        message={assistantMessage({
          content: "",
          toolCalls: [
            {
              args: { path: "/repo/tests/unit/components/chat/AssistantMessage.test.tsx" },
              id: "tool-1",
              name: "read",
              status: "running",
            },
          ],
        })}
      />,
    );

    expect(screen.getByRole("button", { name: "Reading AssistantMessage.test.tsx" })).toBeTruthy();

    rendered.rerender(
      <AssistantMessage
        isStreaming
        message={assistantMessage({
          content: "",
          toolCalls: [
            {
              args: { path: "/repo/tests/unit/components/chat/AssistantMessage.test.tsx" },
              id: "tool-1",
              name: "read",
              status: "complete",
            },
          ],
        })}
      />,
    );

    expect(screen.getByRole("button", { name: "Read AssistantMessage.test.tsx" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reading AssistantMessage.test.tsx" })).toBeNull();
  });

  test("groups consecutive tool calls under one header", () => {
    let toggleEvents = 0;
    const handleToggle = () => toggleEvents++;
    document.addEventListener(CHAT_CONTENT_TOGGLE_EVENT, handleToggle);

    renderComponent(
      <AssistantMessage
        isStreaming
        message={assistantMessage({
          content: "Before after",
          toolCalls: [
            {
              args: { path: "/repo/tests/unit/components/chat/AssistantMessage.test.tsx" },
              id: "tool-1",
              name: "read",
              status: "complete",
              insertedAtContentLength: "Before".length,
            },
            {
              args: { commandPreview: "git status -sb" },
              id: "tool-2",
              name: "exec",
              status: "running",
              insertedAtContentLength: "Before".length,
            },
          ],
        })}
      />,
    );

    const groupHeader = screen.getByRole("button", { name: "Running git status -sb" });
    expect(groupHeader).toBeTruthy();
    expect(document.querySelectorAll("[data-tool-call-group]")).toHaveLength(1);
    expect(screen.queryAllByTestId("tool-call")).toHaveLength(0);
    expect(groupHeader.querySelector(".lucide-chevron-right")).toBeTruthy();
    expect(groupHeader.querySelector(".lucide-chevron-down")).toBeNull();

    fireEvent.click(groupHeader);
    expect(toggleEvents).toBe(1);
    expect(groupHeader.querySelector(".lucide-chevron-down")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Read AssistantMessage.test.tsx" })).toBeTruthy();
    const runningCommandButtons = screen.getAllByRole("button", { name: "Running git status -sb" });
    expect(runningCommandButtons).toHaveLength(2);
    expect(runningCommandButtons[0].querySelector(".tool-call-running-text")).toBeTruthy();
    const commandRow = runningCommandButtons[1];
    expect(commandRow).toBeTruthy();
    expect(commandRow.querySelector(".tool-call-running-text")).toBeNull();

    fireEvent.click(commandRow);
    expect(toggleEvents).toBe(2);
    expect(screen.getAllByRole("button", { name: "Running git status -sb" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Ran command/ })).toBeNull();
    expect(screen.getByTestId("code-block")).toBeTruthy();

    document.removeEventListener(CHAT_CONTENT_TOGGLE_EVENT, handleToggle);
  });

  test("opens grouped approval-pending exec calls so approval controls are visible", () => {
    renderComponent(
      <AssistantMessage
        message={assistantMessage({
          content: "",
          toolCalls: [
            {
              args: { path: "/repo/README.md" },
              id: "tool-1",
              name: "read",
              status: "complete",
            },
            {
              args: { command: "rm -rf build" },
              id: "tool-2",
              name: "exec",
              result: {
                details: {
                  approvalId: "approval-1",
                  command: "rm -rf build",
                  expiresAtMs: Date.now() + 30_000,
                  status: "approval-pending",
                },
              },
              status: "running",
            },
          ],
        })}
      />,
    );

    const groupHeader = screen.getByRole("button", {
      name: "Running a command, read 1 file",
    });
    expect(groupHeader.getAttribute("aria-expanded")).toBe("true");

    const approvalItem = screen.getByRole("button", { name: "Running rm -rf build" });
    expect(approvalItem.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("region", { name: "exec.approvalNeeded" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "exec.allowOnce" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "exec.allowAlways" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "exec.deny" })).toBeTruthy();
  });

  test("shows thinking while streaming with completed tools and no active tool", () => {
    renderComponent(
      <AssistantMessage
        isStreaming
        message={assistantMessage({
          content: "",
          toolCalls: [
            {
              args: { commandPreview: "git status -sb" },
              id: "tool-1",
              name: "exec",
              status: "complete",
            },
          ],
        })}
      />,
    );

    const groupHeader = screen.getByRole("button", { name: "Thinking..." });
    expect(groupHeader.querySelector(".tool-call-running-text")).toBeTruthy();
    expect(groupHeader.querySelector(".lucide-brain")).toBeTruthy();
    expect(groupHeader.querySelector(".lucide-square-terminal")).toBeNull();

    fireEvent.click(groupHeader);
    expect(screen.getByRole("button", { name: "Ran git status -sb" })).toBeTruthy();
  });

  test("keeps the most recently completed active tool visible briefly before thinking", async () => {
    const timers = installFakeTimers();

    try {
      const rendered = renderComponent(
        <AssistantMessage
          isStreaming
          message={assistantMessage({
            content: "",
            toolCalls: [
              {
                args: { commandPreview: "git status -sb" },
                id: "tool-1",
                name: "exec",
                status: "running",
              },
            ],
          })}
        />,
      );

      expect(screen.getByRole("button", { name: "Running git status -sb" })).toBeTruthy();

      rendered.rerender(
        <AssistantMessage
          isStreaming
          message={assistantMessage({
            content: "",
            toolCalls: [
              {
                args: { commandPreview: "git status -sb" },
                id: "tool-1",
                name: "exec",
                status: "complete",
              },
            ],
          })}
        />,
      );

      expect(screen.getByRole("button", { name: "Ran git status -sb" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Thinking..." })).toBeNull();

      await act(async () => {
        timers.advanceBy(1_999);
        await Promise.resolve();
      });
      expect(screen.getByRole("button", { name: "Ran git status -sb" })).toBeTruthy();

      await act(async () => {
        timers.advanceBy(1);
        await Promise.resolve();
      });
      expect(screen.getByRole("button", { name: "Thinking..." })).toBeTruthy();
    } finally {
      timers.uninstall();
    }
  });

  test("keeps the completed-tool linger timer through unrelated streaming rerenders", async () => {
    const timers = installFakeTimers();

    try {
      const rendered = renderComponent(
        <AssistantMessage
          isStreaming
          message={assistantMessage({
            content: "",
            toolCalls: [
              {
                args: { commandPreview: "git status -sb" },
                id: "tool-1",
                name: "exec",
                status: "running",
              },
            ],
          })}
        />,
      );

      rendered.rerender(
        <AssistantMessage
          isStreaming
          message={assistantMessage({
            content: "",
            toolCalls: [
              {
                args: { commandPreview: "git status -sb" },
                id: "tool-1",
                name: "exec",
                status: "complete",
              },
            ],
          })}
        />,
      );

      await act(async () => {
        timers.advanceBy(1_000);
        await Promise.resolve();
      });

      rendered.rerender(
        <AssistantMessage
          isStreaming
          message={assistantMessage({
            content: "partial response",
            toolCalls: [
              {
                args: { commandPreview: "git status -sb" },
                id: "tool-1",
                name: "exec",
                status: "complete",
              },
            ],
          })}
        />,
      );

      expect(screen.getByRole("button", { name: "Ran git status -sb" })).toBeTruthy();

      await act(async () => {
        timers.advanceBy(1_000);
        await Promise.resolve();
      });

      expect(screen.getByRole("button", { name: "Thinking..." })).toBeTruthy();
    } finally {
      timers.uninstall();
    }
  });

  test("keeps an expanded tool group open when a new consecutive tool is appended", () => {
    const rendered = renderComponent(
      <AssistantMessage
        isStreaming
        message={assistantMessage({
          content: "",
          toolCalls: [
            {
              args: { commandPreview: "git status -sb" },
              id: "tool-1",
              name: "exec",
              status: "running",
            },
          ],
        })}
      />,
    );

    const groupHeader = screen.getByRole("button", { name: "Running git status -sb" });
    fireEvent.click(groupHeader);
    expect(groupHeader.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByRole("button", { name: "Running git status -sb" })).toHaveLength(2);

    rendered.rerender(
      <AssistantMessage
        isStreaming
        message={assistantMessage({
          content: "",
          toolCalls: [
            {
              args: { commandPreview: "git status -sb" },
              id: "tool-1",
              name: "exec",
              status: "complete",
            },
            {
              args: { commandPreview: "bun test" },
              id: "tool-2",
              name: "exec",
              status: "running",
            },
          ],
        })}
      />,
    );

    const nextGroupHeader = screen.getAllByRole("button", { name: "Running bun test" })[0];
    expect(nextGroupHeader.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Ran git status -sb" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Running bun test" })).toHaveLength(2);
  });

  test("uses the active tool as the streaming header while expanded rows keep prior tools", () => {
    renderComponent(
      <AssistantMessage
        isStreaming
        message={assistantMessage({
          content: "",
          toolCalls: [
            {
              args: { path: "/repo/README.md" },
              id: "tool-1",
              name: "read",
              status: "complete",
            },
            {
              args: { commandPreview: "bun test" },
              id: "tool-2",
              name: "exec",
              status: "running",
            },
          ],
        })}
      />,
    );

    const groupHeader = screen.getByRole("button", { name: "Running bun test" });
    expect(groupHeader.querySelector(".tool-call-running-text")).toBeTruthy();

    fireEvent.click(groupHeader);
    expect(screen.getByRole("button", { name: "Read README.md" })).toBeTruthy();
    const activeToolButtons = screen.getAllByRole("button", { name: "Running bun test" });
    expect(activeToolButtons).toHaveLength(2);
    expect(activeToolButtons[0].querySelector(".tool-call-running-text")).toBeTruthy();
    expect(activeToolButtons[1].querySelector(".tool-call-running-text")).toBeNull();
  });

  test("uses a search icon for search tool groups", () => {
    renderComponent(
      <AssistantMessage
        message={assistantMessage({
          content: "",
          toolCalls: [
            {
              args: { query: "AssistantMessage" },
              id: "tool-1",
              name: "web_search",
              status: "complete",
            },
          ],
        })}
      />,
    );

    const groupHeader = screen.getByRole("button", { name: "Searched AssistantMessage" });
    expect(groupHeader.querySelector(".lucide-search")).toBeTruthy();
    expect(groupHeader.querySelector(".lucide-square-terminal")).toBeNull();
  });

  test("uses an edit icon for edit tool groups", () => {
    renderComponent(
      <AssistantMessage
        message={assistantMessage({
          content: "",
          toolCalls: [
            {
              args: { path: "/repo/src/components/chat/AssistantMessage.tsx" },
              id: "tool-1",
              name: "edit",
              status: "complete",
            },
          ],
        })}
      />,
    );

    const groupHeader = screen.getByRole("button", { name: "Edited AssistantMessage.tsx" });
    expect(groupHeader.querySelector(".lucide-pencil")).toBeTruthy();
    expect(groupHeader.querySelector(".lucide-square-terminal")).toBeNull();
  });

  test("keeps the terminal icon for command tool groups", () => {
    renderComponent(
      <AssistantMessage
        message={assistantMessage({
          content: "",
          toolCalls: [
            {
              args: { commandPreview: "git status -sb" },
              id: "tool-1",
              name: "exec",
              status: "complete",
            },
          ],
        })}
      />,
    );

    const groupHeader = screen.getByRole("button", { name: "Ran git status -sb" });
    expect(groupHeader.querySelector(".lucide-square-terminal")).toBeTruthy();
  });

  test("uses a wrench icon for unknown tool groups", () => {
    renderComponent(
      <AssistantMessage
        message={assistantMessage({
          content: "",
          toolCalls: [
            {
              args: { action: "respond", status: "HEARTBEAT_OK" },
              id: "tool-1",
              name: "Heartbeat",
              status: "complete",
            },
          ],
        })}
      />,
    );

    const groupHeader = screen.getByRole("button", { name: "Heartbeat respond" });
    expect(groupHeader.querySelector(".lucide-wrench")).toBeTruthy();
    expect(groupHeader.querySelector(".lucide-square-terminal")).toBeNull();
  });

  test("uses unknown tool names in group summaries instead of generic tool text", () => {
    renderComponent(
      <AssistantMessage
        message={assistantMessage({
          content: "",
          toolCalls: [
            {
              args: { commandPreview: "sed -n '1,220p' HEARTBEAT.md" },
              id: "tool-1",
              name: "exec",
              status: "complete",
            },
            {
              args: { action: "respond", status: "HEARTBEAT_OK" },
              id: "tool-2",
              name: "Heartbeat",
              status: "complete",
            },
          ],
        })}
      />,
    );

    expect(screen.getByRole("button", { name: "Ran a command, used Heartbeat" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /used a tool/i })).toBeNull();
  });

  test("bounds noisy mixed tool summaries with an other-tools count", () => {
    const toolCalls = [
      { args: { path: "README.md" }, id: "read-1", name: "read", status: "complete" },
      ...Array.from({ length: 8 }, (_, index) => ({
        args: { commandPreview: `command ${index + 1}` },
        id: `exec-${index}`,
        name: "exec",
        status: "complete",
      })),
      { args: { query: "one" }, id: "search-1", name: "web_search", status: "complete" },
      { args: { query: "two" }, id: "search-2", name: "web_search", status: "complete" },
      {
        args: { url: "https://example.com" },
        id: "fetch-1",
        name: "web_fetch",
        status: "complete",
      },
      { args: { job: "sync" }, id: "cron-1", name: "cron", status: "complete" },
      { args: { job: "sync" }, id: "cron-2", name: "cron", status: "complete" },
      { id: "status-1", name: "session_status", status: "complete" },
      { args: { action: "list_mcp_resources" }, id: "custom-1", name: "Codex", status: "complete" },
    ] as Message["toolCalls"];

    renderComponent(
      <AssistantMessage
        message={assistantMessage({
          content: "",
          toolCalls,
        })}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Read 1 file, ran 8 commands, used 7 other tools" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /searched 2 times/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /checked cron 2 times/ })).toBeNull();
  });

  test("keeps failed entries visible before collapsing noisy mixed tool summaries", () => {
    const toolCalls = [
      { args: { path: "README.md" }, id: "read-1", name: "read", status: "complete" },
      { args: { commandPreview: "bun test" }, id: "exec-1", name: "exec", status: "complete" },
      {
        args: { query: "AssistantMessage" },
        id: "search-1",
        name: "web_search",
        status: "complete",
      },
      {
        args: { url: "https://example.com" },
        id: "fetch-1",
        name: "web_fetch",
        status: "complete",
      },
      { args: { action: "list_mcp_resources" }, id: "custom-1", name: "Codex", status: "error" },
    ] as Message["toolCalls"];

    renderComponent(
      <AssistantMessage
        message={assistantMessage({
          content: "",
          toolCalls,
        })}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Failed Codex, read 1 file, used 3 other tools" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /used 4 other tools/ })).toBeNull();
  });

  test("uses present tense for live running commands and past tense after completion", () => {
    const rendered = renderComponent(
      <AssistantMessage
        isStreaming
        message={assistantMessage({
          content: "",
          toolCalls: [
            {
              args: { commandPreview: "git status -sb" },
              id: "tool-1",
              name: "exec",
              status: "running",
            },
          ],
        })}
      />,
    );

    expect(screen.getByRole("button", { name: "Running git status -sb" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ran git status -sb" })).toBeNull();

    rendered.rerender(
      <AssistantMessage
        message={assistantMessage({
          content: "",
          toolCalls: [
            {
              args: { commandPreview: "git status -sb" },
              id: "tool-1",
              name: "exec",
              status: "complete",
            },
          ],
        })}
      />,
    );

    expect(screen.getByRole("button", { name: "Ran git status -sb" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Running git status -sb" })).toBeNull();
  });

  test("does not render historical pending commands as actively running", () => {
    renderComponent(
      <AssistantMessage
        message={assistantMessage({
          content: "",
          toolCalls: [
            {
              args: { commandPreview: "git status -sb" },
              id: "tool-1",
              name: "exec",
              status: "pending",
            },
          ],
        })}
      />,
    );

    const groupHeader = screen.getByRole("button", { name: "Started git status -sb" });
    expect(groupHeader.querySelector(".tool-call-running-text")).toBeNull();
    expect(screen.queryByRole("button", { name: "Running git status -sb" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Thinking..." })).toBeNull();
  });

  test("shows failed tool state in the collapsed group header", () => {
    renderComponent(
      <AssistantMessage
        message={assistantMessage({
          content: "",
          toolCalls: [
            {
              args: { commandPreview: "git status -sb" },
              id: "tool-1",
              name: "exec",
              status: "error",
            },
          ],
        })}
      />,
    );

    const groupHeader = screen.getByRole("button", { name: "Failed to run git status -sb" });
    expect(groupHeader.querySelector(".tool-call-running-text")).toBeNull();
    expect(screen.queryByRole("button", { name: "Ran git status -sb" })).toBeNull();
  });

  test("keeps failed tool counts separate from successful tools in summaries", () => {
    renderComponent(
      <AssistantMessage
        message={assistantMessage({
          content: "",
          toolCalls: [
            {
              args: { commandPreview: "git status -sb" },
              id: "tool-1",
              name: "exec",
              status: "complete",
            },
            {
              args: { commandPreview: "bun test" },
              id: "tool-2",
              name: "exec",
              status: "error",
            },
          ],
        })}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Failed to run a command, ran a command" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ran 2 commands" })).toBeNull();
  });

  test("shimmers only the main header while the assistant turn is still streaming", () => {
    renderComponent(
      <AssistantMessage
        isStreaming
        message={assistantMessage({
          content: "",
          toolCalls: [
            {
              args: { commandPreview: "git status -sb" },
              id: "tool-1",
              name: "exec",
              status: "complete",
            },
          ],
        })}
      />,
    );

    const groupHeader = screen.getByRole("button", { name: "Thinking..." });
    const shimmerText = groupHeader.querySelector(".tool-call-running-text");
    expect(shimmerText).toBeTruthy();
    expect(shimmerText?.getAttribute("style")).toContain("--tool-call-shimmer-duration: 1.88s");

    fireEvent.click(groupHeader);
    expect(
      screen
        .getByRole("button", { name: "Ran git status -sb" })
        .querySelector(".tool-call-running-text"),
    ).toBeNull();
  });

  test("scales shimmer duration with the visible header text length", () => {
    const shortRendered = renderComponent(
      <AssistantMessage
        isStreaming
        message={assistantMessage({
          content: "",
          toolCalls: [
            {
              args: { commandPreview: "go" },
              id: "tool-1",
              name: "exec",
              status: "running",
            },
          ],
        })}
      />,
    );

    const shortText = screen
      .getByRole("button", { name: "Running go" })
      .querySelector(".tool-call-running-text");
    expect(shortText?.getAttribute("style")).toContain("--tool-call-shimmer-duration: 1.85s");

    shortRendered.rerender(
      <AssistantMessage
        isStreaming
        message={assistantMessage({
          content: "",
          toolCalls: [
            {
              args: {
                commandPreview:
                  "bun test --isolate tests/unit/components/chat/AssistantMessage.test.tsx tests/unit/styles/animations.test.ts",
              },
              id: "tool-1",
              name: "exec",
              status: "running",
            },
          ],
        })}
      />,
    );

    const longText = screen
      .getByRole("button", {
        name: /Running bun test --isolate tests\/unit\/components\/chat\/AssistantMessage\.test\.tsx/,
      })
      .querySelector(".tool-call-running-text");
    expect(longText?.getAttribute("style")).toContain("--tool-call-shimmer-duration: 4.50s");
  });

  test("renders content images, MEDIA images, local file notes, and truncation marker", () => {
    renderComponent(
      <AssistantMessage
        message={assistantMessage({
          content: [
            "Here is media",
            "MEDIA: https://example.com/chart.png",
            "MEDIA: /tmp/private.txt",
          ].join("\n"),
          images: [{ url: "data:image/png;base64,inline", alt: "inline image" }],
          historyTruncated: true,
          historyTruncationReason: "oversized",
        })}
      />,
    );

    expect(screen.getByText("Here is media")).toBeTruthy();
    expect(screen.getByRole("img", { name: "inline image" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Image 1" })).toBeTruthy();
    expect(screen.getByText("📎 File: /tmp/private.txt")).toBeTruthy();
    expect(screen.getByLabelText("truncated:oversized")).toBeTruthy();
  });

  test("renders one accessible thinking label for empty streaming messages", () => {
    renderComponent(<AssistantMessage message={assistantMessage({})} isStreaming />);

    const status = screen.getByRole("status", { name: "chat.thinking" });
    expect(status.textContent).toBe("chat.thinking");
    expect(status.querySelector(".lucide-brain")).toBeTruthy();
    expect(status.querySelector(".tool-call-running-text")?.textContent).toBe("chat.thinking");
    expect(status.querySelector(".cove-bouncing-text")).toBeNull();
    expect(document.querySelector("[data-testid='bouncing-dots']")).toBeNull();
  });

  test("does not append a dot-only streaming indicator after content", () => {
    renderComponent(
      <AssistantMessage message={assistantMessage({ content: "Partial answer" })} isStreaming />,
    );

    expect(screen.getByTestId("message-content").textContent).toBe("Partial answer");
    expect(screen.queryByRole("status", { name: "chat.thinking" })).toBeNull();
    expect(document.querySelector("[data-testid='bouncing-dots']")).toBeNull();
  });
});
