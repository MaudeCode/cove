/** @jsxImportSource preact */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import { fireEvent, renderComponent, screen, waitFor } from "../../../helpers/dom";
import { installI18nMock } from "../../../helpers/i18n";
import { installUiComponentAliases } from "../../../helpers/module-aliases";
import { createSessionSignalsMock } from "../../../helpers/module-mocks";
import type { Message } from "../../../../src/types/messages";

(globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = "test";
const originalRequestAnimationFrame = globalThis.requestAnimationFrame;

await installUiComponentAliases();

installI18nMock();
mock.module("@/lib/logger", () => ({
  log: {
    chat: {
      debug: () => undefined,
    },
  },
}));
const sessions = signal([]);
const constants = await import("../../../../src/lib/constants");
const debouncedSignal = await import("../../../../src/lib/debounced-signal");
const messageGrouping = await import("../../../../src/lib/message-grouping");
const messageDetection = await import("../../../../src/lib/message-detection");
const storage = await import("../../../../src/lib/storage");
const utils = await import("../../../../src/lib/utils");

mock.module("@/lib/constants", () => constants);
mock.module("@/lib/debounced-signal", () => debouncedSignal);
mock.module("@/lib/message-grouping", () => messageGrouping);
mock.module("@/lib/message-detection", () => messageDetection);
mock.module("@/lib/storage", () => storage);
mock.module("@/lib/utils", () => ({
  ...utils,
  isAvatarUrl: (value?: string) => !!value?.startsWith("http"),
}));
mock.module("@/signals/sessions", () => createSessionSignalsMock({ sessions }));
mock.module("../../../../src/components/chat/SearchBar", () => ({
  SearchBar: () => <div data-testid="search-bar" />,
}));
mock.module("../../../../src/components/chat/ChatMessage", () => ({
  ChatMessage: ({ message, isStreaming }: { message: Message; isStreaming?: boolean }) => (
    <article data-testid={`chat-message-${message.id}`}>
      {message.role}:{message.content}
      {isStreaming ? ":streaming" : ""}
    </article>
  ),
}));
mock.module("../../../../src/components/chat/CollapsedMessage", () => ({
  CollapsedMessage: ({ messages }: { messages: Message[] }) => (
    <section data-testid="collapsed-cron">{messages[0]?.content}</section>
  ),
}));
mock.module("../../../../src/components/chat/CompactionDivider", () => ({
  CompactionDivider: ({
    active,
    messages,
    summary,
  }: {
    active?: boolean;
    messages?: Message[];
    summary?: string;
  }) => (
    <section data-testid={active ? "compaction-active" : "compaction-divider"}>
      {summary ?? messages?.[0]?.content ?? "active"}
    </section>
  ),
}));

const chat = await import("../../../../src/signals/chat");
mock.module("@/signals/chat", () => chat);
const { MessageList } = await import("../../../../src/components/chat/MessageList");
const scrollIntoViewCalls: Element[] = [];
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

function message(overrides: Partial<Message>): Message {
  return {
    id: "msg-1",
    role: "assistant",
    content: "",
    timestamp: 1000,
    isStreaming: false,
    ...overrides,
  };
}

describe("MessageList", () => {
  beforeEach(() => {
    (
      globalThis as { requestAnimationFrame?: (callback: FrameRequestCallback) => number }
    ).requestAnimationFrame = (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    };
    HTMLElement.prototype.scrollIntoView = function () {
      scrollIntoViewCalls.push(this);
    };
    scrollIntoViewCalls.length = 0;
    chat.searchQuery.value = "";
    chat.isSearchOpen.value = false;
    chat.scrollToMessageId.value = null;
    chat.isCompacting.value = false;
    chat.showCompletedCompaction.value = false;
    chat.lastCompactionSummary.value = undefined;
    chat.compactionInsertIndex.value = -1;
  });

  afterEach(() => {
    (
      globalThis as { requestAnimationFrame?: typeof originalRequestAnimationFrame }
    ).requestAnimationFrame = originalRequestAnimationFrame;
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  test("renders loading, error, and empty states", () => {
    const loaded = renderComponent(<MessageList messages={[]} isLoading />);
    expect(screen.getByRole("status").textContent).toBe("common.loading");

    loaded.rerender(<MessageList messages={[]} error="failed to load" />);
    expect(screen.getByText("failed to load")).toBeTruthy();

    loaded.rerender(<MessageList messages={[]} />);
    expect(screen.getByText("chat.emptyState.title")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Cove" })).toBeTruthy();
  });

  test("hides heartbeat messages, collapses cron, and renders compaction dividers", () => {
    renderComponent(
      <MessageList
        messages={[
          message({ id: "heartbeat", content: "heartbeat_ok" }),
          message({ id: "cron", content: "[cron] finished" }),
          message({ id: "compact", role: "user", kind: "compaction", content: "summary" }),
          message({ id: "normal", content: "visible" }),
        ]}
      />,
    );

    expect(screen.queryByTestId("chat-message-heartbeat")).toBeNull();
    expect(screen.getByTestId("collapsed-cron").textContent).toBe("[cron] finished");
    expect(screen.getByTestId("compaction-divider").textContent).toBe("summary");
    expect(screen.getByTestId("chat-message-normal").textContent).toContain("visible");
  });

  test("renders active, completed, and streaming placeholders", () => {
    chat.showCompletedCompaction.value = true;
    chat.lastCompactionSummary.value = "completed summary";
    chat.compactionInsertIndex.value = 1;
    chat.isCompacting.value = true;

    renderComponent(
      <MessageList
        messages={[message({ id: "normal", content: "visible" })]}
        isStreaming
        streamingContent="streaming text"
      />,
    );

    expect(screen.queryByText("completed summary")).toBeNull();
    expect(screen.getByTestId("compaction-active")).toBeTruthy();
    expect(screen.getByTestId("chat-message-streaming").textContent).toContain(
      "streaming text:streaming",
    );

    chat.isCompacting.value = false;
    renderComponent(<MessageList messages={[message({ id: "normal", content: "visible" })]} />);
    expect(screen.getByText("completed summary")).toBeTruthy();
  });

  test("search keyboard target closes search and scrolls to the message", async () => {
    chat.isSearchOpen.value = true;
    chat.searchQuery.value = "visible";

    renderComponent(<MessageList messages={[message({ id: "normal", content: "visible" })]} />);

    const target = screen.getByRole("button");
    fireEvent.keyDown(target, { key: "Enter" });

    expect(chat.searchQuery.value).toBe("");
    expect(chat.isSearchOpen.value).toBe(false);
    await waitFor(() => expect(scrollIntoViewCalls).toHaveLength(1));
    expect(scrollIntoViewCalls[0]?.getAttribute("data-message-id")).toBe("normal");
  });

  test("search click target closes search", () => {
    chat.isSearchOpen.value = true;
    chat.searchQuery.value = "clickable";

    renderComponent(<MessageList messages={[message({ id: "second", content: "clickable" })]} />);

    fireEvent.click(screen.getByRole("button"));

    expect(chat.searchQuery.value).toBe("");
    expect(chat.isSearchOpen.value).toBe(false);
  });
});
