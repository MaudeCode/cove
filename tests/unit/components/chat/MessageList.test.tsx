/** @jsxImportSource preact */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import { fireEvent, renderComponent, screen, waitFor } from "../../../helpers/dom";
import { installI18nMock } from "../../../helpers/i18n";
import { installUiComponentAliases } from "../../../helpers/module-aliases";
import { createSessionSignalsMock } from "../../../helpers/module-mocks";
import type { Message } from "../../../../src/types/messages";
import { CHAT_CONTENT_TOGGLE_EVENT } from "../../../../src/lib/chat-scroll";

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
const chatScroll = await import("../../../../src/lib/chat-scroll");
const debouncedSignal = await import("../../../../src/lib/debounced-signal");
const messageGrouping = await import("../../../../src/lib/message-grouping");
const messageDetection = await import("../../../../src/lib/message-detection");
const storage = await import("../../../../src/lib/storage");
const utils = await import("../../../../src/lib/utils");

mock.module("@/lib/constants", () => constants);
mock.module("@/lib/chat-scroll", () => chatScroll);
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
      {message.commentaryItems?.map((item) => `:${item.text}`).join("")}
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
const scrollToCalls: Array<{ behavior?: ScrollBehavior; top?: number }> = [];
const originalScrollTo = HTMLElement.prototype.scrollTo;
let animationFrameCallbacks: FrameRequestCallback[] = [];

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
    animationFrameCallbacks = [];
    (
      globalThis as { requestAnimationFrame?: (callback: FrameRequestCallback) => number }
    ).requestAnimationFrame = (callback: FrameRequestCallback) => {
      animationFrameCallbacks.push(callback);
      return animationFrameCallbacks.length;
    };
    HTMLElement.prototype.scrollIntoView = function () {
      scrollIntoViewCalls.push(this);
    };
    HTMLElement.prototype.scrollTo = function (options?: ScrollToOptions | number, y?: number) {
      const top = typeof options === "number" ? y : options?.top;
      const behavior = typeof options === "number" ? undefined : options?.behavior;
      scrollToCalls.push({ behavior, top });
      if (typeof top === "number") {
        this.scrollTop = top;
      }
    };
    scrollIntoViewCalls.length = 0;
    scrollToCalls.length = 0;
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
    HTMLElement.prototype.scrollTo = originalScrollTo;
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
        streamingCommentaryItems={[{ id: "commentary-1", text: "Inspecting the repository" }]}
      />,
    );

    expect(screen.queryByText("completed summary")).toBeNull();
    expect(screen.getByTestId("compaction-active")).toBeTruthy();
    expect(screen.getByTestId("chat-message-streaming").textContent).toContain("streaming text");
    expect(screen.getByTestId("chat-message-streaming").textContent).toContain(
      "Inspecting the repository",
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

  test("keeps the bottom anchored when expandable chat content opens at the bottom", async () => {
    renderComponent(<MessageList messages={[message({ id: "normal", content: "visible" })]} />);

    const list = screen.getByRole("list") as HTMLElement;
    setScrollMetrics(list, { clientHeight: 500, scrollHeight: 1000, scrollTop: 500 });
    flushAnimationFrames();
    scrollToCalls.length = 0;

    list.dispatchEvent(new window.CustomEvent(CHAT_CONTENT_TOGGLE_EVENT, { bubbles: true }));
    setScrollMetrics(list, { clientHeight: 500, scrollHeight: 1300, scrollTop: 500 });
    flushAnimationFrames();

    await waitFor(() => expect(scrollToCalls).toHaveLength(1));
    expect(scrollToCalls[0]).toEqual({ behavior: "auto", top: 1300 });
  });

  test("does not force-scroll expandable chat content when the user is scrolled up", () => {
    renderComponent(<MessageList messages={[message({ id: "normal", content: "visible" })]} />);

    const list = screen.getByRole("list") as HTMLElement;
    setScrollMetrics(list, { clientHeight: 500, scrollHeight: 1000, scrollTop: 250 });
    flushAnimationFrames();
    scrollToCalls.length = 0;

    list.dispatchEvent(new window.CustomEvent(CHAT_CONTENT_TOGGLE_EVENT, { bubbles: true }));

    expect(scrollToCalls).toHaveLength(0);
  });
});

function flushAnimationFrames(): void {
  const callbacks = animationFrameCallbacks;
  animationFrameCallbacks = [];
  for (const callback of callbacks) {
    callback(0);
  }
}

function setScrollMetrics(
  element: HTMLElement,
  metrics: { clientHeight: number; scrollHeight: number; scrollTop: number },
): void {
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: metrics.clientHeight,
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    value: metrics.scrollHeight,
  });
  element.scrollTop = metrics.scrollTop;
}
