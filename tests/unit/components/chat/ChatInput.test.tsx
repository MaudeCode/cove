/** @jsxImportSource preact */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, renderComponent, screen, waitFor } from "../../../helpers/dom";
import { installI18nMock } from "../../../helpers/i18n";
import {
  installChatSignalAliases,
  installUiComponentAliases,
} from "../../../helpers/module-aliases";
import {
  isSupportedImage,
  MAX_FILE_SIZE,
  MAX_IMAGE_DIMENSION,
  MAX_PAYLOAD_SIZE,
  SUPPORTED_IMAGE_TYPES,
  type AttachmentPayload,
} from "../../../../src/types/attachments";

installI18nMock({ t: (key: string) => key });
await installChatSignalAliases();
await installUiComponentAliases();

const chat = await import("../../../../src/signals/chat");
mock.module("@/signals/chat", () => chat);
mock.module("@/types/attachments", () => ({
  isSupportedImage,
  MAX_FILE_SIZE,
  MAX_IMAGE_DIMENSION,
  MAX_PAYLOAD_SIZE,
  SUPPORTED_IMAGE_TYPES,
}));
const useAttachmentsModule = await import("../../../../src/hooks/useAttachments");
mock.module("@/hooks/useAttachments", () => useAttachmentsModule);
mock.module("@/components/ui/Tooltip", () => ({
  Tooltip: ({ children }: { children: preact.ComponentChildren }) => <>{children}</>,
}));
mock.module("@/components/ui/Modal", () => ({
  Modal: ({ children, open }: { children: preact.ComponentChildren; open: boolean }) =>
    open ? <section role="dialog">{children}</section> : null,
}));
mock.module("@/components/ui/ModalFooter", () => ({
  ModalFooter: () => <div />,
}));
mock.module("../../../../src/components/chat/ModelPicker", () => ({
  ModelPicker: () => <div data-testid="model-picker" />,
}));

const utils = await import("../../../../src/lib/utils");
mock.module("@/lib/utils", () => utils);

const { ChatInput } = await import("../../../../src/components/chat/ChatInput");

describe("ChatInput", () => {
  beforeEach(() => {
    chat.chatDrafts.value = new Map();
  });

  test("restores drafts, sends on Enter, and clears the saved draft", () => {
    const sends: Array<[string, AttachmentPayload[] | undefined]> = [];
    chat.chatDrafts.value = new Map([["session-a", "saved draft"]]);

    renderComponent(
      <ChatInput
        sessionKey="session-a"
        onSend={(message, attachments) => sends.push([message, attachments])}
      />,
    );

    const textbox = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textbox.value).toBe("saved draft");

    fireEvent.keyDown(textbox, { key: "Enter" });

    expect(sends).toEqual([["saved draft", undefined]]);
    expect(chat.chatDrafts.value.has("session-a")).toBe(false);
  });

  test("sends attachment payloads and clears previews after send", async () => {
    const originalFileReader = globalThis.FileReader;
    const sends: Array<[string, AttachmentPayload[] | undefined]> = [];
    globalThis.FileReader = class MockFileReader {
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;
      result: string | ArrayBuffer | null = null;

      readAsDataURL(readFile: File): void {
        this.result = `data:${readFile.type};base64,aGVsbG8=`;
        queueMicrotask(() => this.onload?.());
      }
    } as unknown as typeof FileReader;

    try {
      renderComponent(
        <ChatInput onSend={(message, attachments) => sends.push([message, attachments])} />,
      );

      const textbox = screen.getByRole("textbox") as HTMLTextAreaElement;
      const container = document.querySelector('[data-tour="chat-input"]') as HTMLDivElement;
      const attachment = new File(["hello"], "notes.txt", { type: "text/plain" });

      fireEvent.drop(container, { dataTransfer: { files: [attachment] } });

      await waitFor(() => expect(screen.getByText("TXT")).toBeTruthy());

      fireEvent.input(textbox, { target: { value: "with attachment" } });
      fireEvent.keyDown(textbox, { key: "Enter" });

      expect(sends).toEqual([
        [
          "with attachment",
          [
            {
              content: "data:text/plain;charset=utf-8;base64,aGVsbG8=",
              fileName: "notes.txt",
              mimeType: "text/plain;charset=utf-8",
              type: "file",
            },
          ],
        ],
      ]);
      await waitFor(() => expect(screen.queryByText("TXT")).toBeNull());
    } finally {
      globalThis.FileReader = originalFileReader;
    }
  });

  test("does not send on Shift+Enter and sends on Ctrl+Enter", () => {
    const sends: string[] = [];

    renderComponent(<ChatInput onSend={(message) => sends.push(message)} />);

    const textbox = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.input(textbox, { target: { value: "multi line" } });
    fireEvent.keyDown(textbox, { key: "Enter", shiftKey: true });
    expect(sends).toEqual([]);

    fireEvent.keyDown(textbox, { key: "Enter", ctrlKey: true });
    expect(sends).toEqual(["multi line"]);
  });

  test("disables send when disabled but still labels streaming sends as queued", () => {
    const sends: string[] = [];

    const rendered = renderComponent(
      <ChatInput disabled onSend={(message) => sends.push(message)} />,
    );

    const textbox = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.input(textbox, { target: { value: "blocked" } });
    fireEvent.click(screen.getByRole("button", { name: "actions.send" }));
    expect(sends).toEqual([]);
    expect(screen.getByRole("button", { name: "actions.send" })).toHaveProperty("disabled", true);

    rendered.rerender(<ChatInput isStreaming onSend={(message) => sends.push(message)} />);
    fireEvent.input(screen.getByRole("textbox"), { target: { value: "queued" } });
    expect(screen.getByRole("button", { name: "actions.queue" })).toBeTruthy();
  });
});
