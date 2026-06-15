/** @jsxImportSource preact */
import { describe, expect, mock, test } from "bun:test";
import { fireEvent, renderComponent, screen } from "../../../helpers/dom";
import { installI18nMock } from "../../../helpers/i18n";
import { CHAT_CONTENT_TOGGLE_EVENT } from "../../../../src/lib/chat-scroll";

installI18nMock({
  t: (key, values) => {
    if (key === "chat.thinkingBlock.secondShort") return `${values?.count}s`;
    if (key === "chat.thinkingBlock.thoughtFor") return `Thought for ${values?.duration}`;
    if (key === "chat.thinkingBlock.expandLabel") return "Expand thinking";
    if (key === "chat.thinkingBlock.collapseLabel") return "Collapse thinking";
    if (key === "common.thinking") return "Thinking";
    return key;
  },
});

const chatScroll = await import("../../../../src/lib/chat-scroll");
mock.module("@/lib/chat-scroll", () => chatScroll);
mock.module("../../../../src/components/chat/MessageContent", () => ({
  MessageContent: ({ content }: { content: string }) => (
    <div data-testid="thought-content">{content}</div>
  ),
}));

const { ThinkingBlock } = await import("../../../../src/components/chat/ThinkingBlock");

describe("ThinkingBlock", () => {
  test("renders as an inline collapsed activity row", () => {
    renderComponent(<ThinkingBlock content={"x".repeat(5_000)} />);

    const button = screen.getByRole("button", { name: "Expand thinking" });
    const root = document.querySelector(".thinking-block");

    expect(button.textContent).toBe("Thought for 10s");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(root?.tagName).toBe("DIV");
    expect(button.classList.contains("min-h-8") || button.className.includes(" py-")).toBe(true);
    expect(screen.queryByTestId("thought-content")).toBeNull();
  });

  test("expands readable thought content and emits a content-toggle event", () => {
    let toggleEvents = 0;
    const handleToggle = () => toggleEvents++;
    document.addEventListener(CHAT_CONTENT_TOGGLE_EVENT, handleToggle);

    try {
      renderComponent(<ThinkingBlock content="private reasoning" />);

      fireEvent.click(screen.getByRole("button", { name: "Expand thinking" }));

      expect(toggleEvents).toBe(1);
      expect(screen.getByRole("button", { name: "Collapse thinking" }).textContent).toBe(
        "Thinking",
      );
      expect(
        screen.getByRole("button", { name: "Collapse thinking" }).getAttribute("aria-expanded"),
      ).toBe("true");
      expect(screen.getByTestId("thought-content").textContent).toBe("private reasoning");
    } finally {
      document.removeEventListener(CHAT_CONTENT_TOGGLE_EVENT, handleToggle);
    }
  });
});
