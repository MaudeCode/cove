/** @jsxImportSource preact */
import { describe, expect, mock, test } from "bun:test";
import { renderComponent, screen } from "../../../helpers/dom";
import { installI18nMock } from "../../../helpers/i18n";
import type { Message } from "../../../../src/types/messages";

installI18nMock();
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

mock.module("@/lib/media-parse", () => mediaParse);
mock.module("../../../../src/components/chat/MessageContent", () => ({
  MessageContent: ({ content }: { content: string }) => (
    <span data-testid="message-content">{content}</span>
  ),
}));
mock.module("../../../../src/components/chat/MessageActions", () => ({
  MessageActions: () => <span data-testid="message-actions" />,
}));
mock.module("../../../../src/components/chat/ToolCall", () => ({
  ToolCall: ({ toolCall }: { toolCall: { name: string } }) => (
    <span data-testid="tool-call">{toolCall.name}</span>
  ),
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

    expect(textContent().filter(Boolean)).toEqual(["reasoning", "Before", "read", " tool after"]);
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
    expect(status.querySelector(".cove-shimmer-text")?.textContent).toBe("chat.thinking");
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
