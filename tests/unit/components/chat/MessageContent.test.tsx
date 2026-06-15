/** @jsxImportSource preact */
import { afterEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import { fireEvent, renderComponent, screen, waitFor } from "../../../helpers/dom";
import { installI18nMock } from "../../../helpers/i18n";
import { installChatSignalAliases } from "../../../helpers/module-aliases";

installI18nMock({ t: (key: string) => key });
await installChatSignalAliases();

const debouncedSearchQuery = signal("");
const chat = await import("../../../../src/signals/chat");
mock.module("@/signals/chat", () => ({
  ...chat,
  debouncedSearchQuery,
}));
mock.module("@/components/ui/BouncingDots", () => ({
  BouncingDots: () => <span data-testid="bouncing-dots" />,
}));

const markdown = await import("../../../../src/lib/markdown");
const sanitize = await import("../../../../src/lib/sanitize");
mock.module("@/lib/markdown", () => markdown);
mock.module("@/lib/sanitize", () => sanitize);

const { MessageContent } = await import("../../../../src/components/chat/MessageContent");

const originalClipboard = navigator.clipboard;
const originalExecCommand = document.execCommand;
const originalNodeFilter = globalThis.NodeFilter;

afterEach(() => {
  debouncedSearchQuery.value = "";
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: originalClipboard,
  });
  document.execCommand = originalExecCommand;
  globalThis.NodeFilter = originalNodeFilter;
});

describe("MessageContent", () => {
  test("sanitizes rendered markdown and highlights search text outside code blocks", () => {
    globalThis.NodeFilter = window.NodeFilter;
    debouncedSearchQuery.value = "needle";

    renderComponent(
      <MessageContent
        content={[
          "A needle appears",
          "",
          "[bad](javascript:alert(1))",
          "",
          '<img src="x" onerror="alert(1)">',
          "",
          "```ts",
          "const needle = true",
          "```",
        ].join("\n")}
      />,
    );

    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText('<img src="x" onerror="alert(1)">')).toBeTruthy();
    expect(screen.getByText("bad").closest("a")?.getAttribute("href") ?? "").not.toContain(
      "javascript",
    );

    const marks = Array.from(document.querySelectorAll("mark"));
    expect(marks.map((mark) => mark.textContent)).toEqual(["needle"]);
    expect(document.querySelector("code mark")).toBeNull();
  });

  test("falls back to execCommand when clipboard write fails", async () => {
    const execCalls: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("clipboard denied");
        },
      },
    });
    document.execCommand = ((command: string) => {
      execCalls.push(command);
      expect((document.querySelector("textarea") as HTMLTextAreaElement | null)?.value.trim()).toBe(
        "const value = 1",
      );
      return true;
    }) as typeof document.execCommand;

    renderComponent(<MessageContent content={"```ts\nconst value = 1\n```"} />);

    fireEvent.click(screen.getByRole("button", { name: "actions.copy" }));

    await waitFor(() => expect(execCalls).toEqual(["copy"]));
    expect(screen.getByRole("button", { name: "actions.copied" })).toBeTruthy();
  });

  test("renders empty streaming content as one accessible thinking label", () => {
    renderComponent(<MessageContent content="" isStreaming />);

    const status = screen.getByRole("status", { name: "chat.thinking" });
    expect(status.textContent).toBe("chat.thinking");
    expect(status.querySelector(".lucide-brain")).toBeTruthy();
    expect(status.querySelector(".tool-call-running-text")?.textContent).toBe("chat.thinking");
    expect(status.querySelector(".cove-bouncing-text")).toBeNull();
    expect(document.querySelector("[data-testid='bouncing-dots']")).toBeNull();
  });
});
