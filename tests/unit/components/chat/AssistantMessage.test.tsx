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
mock.module("../../../../src/components/chat/MessageImages", () => ({
  MessageImages: ({ images }: { images: Array<{ alt?: string; url: string }> }) => (
    <div data-testid="message-images">
      {images.map((image) => image.alt || image.url).join("|")}
    </div>
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
    expect(screen.getByTestId("message-images").textContent).toBe("inline image|Image 1");
    expect(screen.getByText("📎 File: /tmp/private.txt")).toBeTruthy();
    expect(screen.getByLabelText("truncated:oversized")).toBeTruthy();
  });

  test("renders streaming indicators for empty streaming messages", () => {
    renderComponent(<AssistantMessage message={assistantMessage({})} isStreaming />);

    expect(screen.getByText("chat.thinking")).toBeTruthy();
    expect(screen.getAllByTestId("bouncing-dots")).toHaveLength(1);
  });
});
