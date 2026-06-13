/** @jsxImportSource preact */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, renderComponent, screen } from "../../../helpers/dom";
import { installI18nMock } from "../../../helpers/i18n";
import {
  installChatSignalAliases,
  installUiComponentAliases,
} from "../../../helpers/module-aliases";
import type { AttachmentPayload } from "../../../../src/types/attachments";

installI18nMock({ t: (key: string) => key });
await installChatSignalAliases();
await installUiComponentAliases();

const attachmentPayloads: AttachmentPayload[] = [];
let clearAttachmentsCalls = 0;

const chat = await import("../../../../src/signals/chat");
mock.module("@/signals/chat", () => chat);
mock.module("@/hooks/useAttachments", () => ({
  compressImage: async () => ({ content: "data:image/png;base64,mock", size: 4 }),
  useAttachments: () => ({
    addFiles: async () => undefined,
    attachments: [],
    clearAttachments: () => {
      clearAttachmentsCalls += 1;
      attachmentPayloads.length = 0;
    },
    clearError: () => undefined,
    error: null,
    getPayloads: () => [...attachmentPayloads],
    handlePaste: async () => false,
    isProcessing: false,
    removeAttachment: () => undefined,
  }),
}));
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
mock.module("@/types/attachments", () => import("../../../../src/types/attachments"));
mock.module("../../../../src/components/chat/ModelPicker", () => ({
  ModelPicker: () => <div data-testid="model-picker" />,
}));
mock.module("../../../../src/components/chat/AttachmentPreview", () => ({
  AttachmentPreview: () => <div data-testid="attachment-preview" />,
}));

const utils = await import("../../../../src/lib/utils");
mock.module("@/lib/utils", () => utils);

const { ChatInput } = await import("../../../../src/components/chat/ChatInput");

describe("ChatInput", () => {
  beforeEach(() => {
    chat.chatDrafts.value = new Map();
    attachmentPayloads.length = 0;
    clearAttachmentsCalls = 0;
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
    expect(clearAttachmentsCalls).toBe(1);
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
