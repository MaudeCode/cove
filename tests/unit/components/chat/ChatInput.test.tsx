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
        onSend={(message, attachments) => {
          sends.push([message, attachments]);
        }}
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
        <ChatInput
          onSend={(message, attachments) => {
            sends.push([message, attachments]);
          }}
        />,
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

  test("does not send on Shift+Enter and sends on Ctrl+Enter or Cmd+Enter", () => {
    const sends: string[] = [];

    renderComponent(
      <ChatInput
        onSend={(message) => {
          sends.push(message);
        }}
      />,
    );

    const textbox = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.input(textbox, { target: { value: "multi line" } });
    fireEvent.keyDown(textbox, { key: "Enter", shiftKey: true });
    expect(sends).toEqual([]);

    fireEvent.keyDown(textbox, { key: "Enter", ctrlKey: true });
    expect(sends).toEqual(["multi line"]);

    fireEvent.input(textbox, { target: { value: "command send" } });
    fireEvent.keyDown(textbox, { key: "Enter", metaKey: true });
    expect(sends).toEqual(["multi line", "command send"]);
  });

  test("ignores Enter while IME composition is active", () => {
    const sends: string[] = [];

    renderComponent(
      <ChatInput
        onSend={(message) => {
          sends.push(message);
        }}
      />,
    );

    const textbox = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.input(textbox, { target: { value: "composing" } });

    fireEvent.keyDown(textbox, { key: "Enter", isComposing: true });
    fireEvent.keyDown(textbox, { key: "Enter", keyCode: 229 });

    expect(sends).toEqual([]);

    fireEvent.keyDown(textbox, { key: "Enter" });
    expect(sends).toEqual(["composing"]);
  });

  test("blocks duplicate sends while the first send is in flight", async () => {
    let resolveSend: (() => void) | undefined;
    const sends: string[] = [];

    renderComponent(
      <ChatInput
        onSend={(message) => {
          sends.push(message);
          return new Promise<void>((resolve) => {
            resolveSend = resolve;
          });
        }}
      />,
    );

    const textbox = screen.getByRole("textbox") as HTMLTextAreaElement;
    const sendButton = screen.getByRole("button", { name: "actions.send" });

    fireEvent.input(textbox, { target: { value: "one send" } });
    fireEvent.keyDown(textbox, { key: "Enter" });
    fireEvent.click(sendButton);
    fireEvent.keyDown(textbox, { key: "Enter", ctrlKey: true });

    expect(sends).toEqual(["one send"]);
    expect(textbox.value).toBe("one send");
    expect(sendButton).toHaveProperty("disabled", true);

    resolveSend?.();
    await waitFor(() => expect(textbox.value).toBe(""));
  });

  test("keeps a newer draft typed before an in-flight send resolves", async () => {
    let resolveSend: (() => void) | undefined;
    const sends: string[] = [];
    chat.chatDrafts.value = new Map([["session-next", ""]]);

    renderComponent(
      <ChatInput
        sessionKey="session-next"
        onSend={(message) => {
          sends.push(message);
          return new Promise<void>((resolve) => {
            resolveSend = resolve;
          });
        }}
      />,
    );

    const textbox = screen.getByRole("textbox") as HTMLTextAreaElement;

    fireEvent.input(textbox, { target: { value: "first send" } });
    fireEvent.keyDown(textbox, { key: "Enter" });
    fireEvent.input(textbox, { target: { value: "next draft" } });

    resolveSend?.();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "actions.send" })).toHaveProperty(
        "disabled",
        false,
      ),
    );
    expect(sends).toEqual(["first send"]);
    expect(textbox.value).toBe("next draft");
    expect(chat.chatDrafts.value.get("session-next")).toBe("next draft");
  });

  test("keeps a newer in-flight draft that only differs by whitespace", async () => {
    let resolveSend: (() => void) | undefined;
    chat.chatDrafts.value = new Map([["session-whitespace", ""]]);

    renderComponent(
      <ChatInput
        sessionKey="session-whitespace"
        onSend={() =>
          new Promise<void>((resolve) => {
            resolveSend = resolve;
          })
        }
      />,
    );

    const textbox = screen.getByRole("textbox") as HTMLTextAreaElement;

    fireEvent.input(textbox, { target: { value: "hello" } });
    fireEvent.keyDown(textbox, { key: "Enter" });
    fireEvent.input(textbox, { target: { value: " hello " } });

    resolveSend?.();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "actions.send" })).toHaveProperty(
        "disabled",
        false,
      ),
    );
    expect(textbox.value).toBe(" hello ");
    expect(chat.chatDrafts.value.get("session-whitespace")).toBe(" hello ");
  });

  test("keeps draft and attachment previews when send throws synchronously", async () => {
    const originalFileReader = globalThis.FileReader;
    let sendAttempts = 0;
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
      chat.chatDrafts.value = new Map([["session-error", ""]]);
      renderComponent(
        <ChatInput
          sessionKey="session-error"
          onSend={() => {
            sendAttempts += 1;
            throw new Error("send failed");
          }}
        />,
      );

      const textbox = screen.getByRole("textbox") as HTMLTextAreaElement;
      const container = document.querySelector('[data-tour="chat-input"]') as HTMLDivElement;
      const attachment = new File(["hello"], "notes.txt", { type: "text/plain" });

      fireEvent.input(textbox, { target: { value: "keep this" } });
      fireEvent.drop(container, { dataTransfer: { files: [attachment] } });
      await waitFor(() => expect(screen.getByText("TXT")).toBeTruthy());

      fireEvent.click(screen.getByRole("button", { name: "actions.send" }));

      expect(sendAttempts).toBe(1);
      expect(textbox.value).toBe("keep this");
      expect(chat.chatDrafts.value.get("session-error")).toBe("keep this");
      expect(screen.getByText("TXT")).toBeTruthy();
    } finally {
      globalThis.FileReader = originalFileReader;
    }
  });

  test("disables send and labels active-run sends by the selected default mode", () => {
    const sends: string[] = [];

    const rendered = renderComponent(
      <ChatInput
        disabled
        onSend={(message) => {
          sends.push(message);
        }}
      />,
    );

    const textbox = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.input(textbox, { target: { value: "blocked" } });
    fireEvent.click(screen.getByRole("button", { name: "actions.send" }));
    expect(sends).toEqual([]);
    expect(screen.getByRole("button", { name: "actions.send" })).toHaveProperty("disabled", true);

    rendered.rerender(
      <ChatInput
        isStreaming
        onSend={(message) => {
          sends.push(message);
        }}
      />,
    );
    fireEvent.input(screen.getByRole("textbox"), { target: { value: "queued" } });
    expect(screen.getByRole("button", { name: "actions.queue" })).toBeTruthy();

    rendered.rerender(
      <ChatInput
        isStreaming
        steerByDefault
        onSend={(message) => {
          sends.push(message);
        }}
      />,
    );
    fireEvent.input(screen.getByRole("textbox"), { target: { value: "steered" } });
    expect(screen.getByRole("button", { name: "actions.steer" })).toBeTruthy();
    expect(screen.getByText("chat.steerByDefaultActive")).toBeTruthy();
  });
});
