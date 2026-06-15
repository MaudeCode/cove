/** @jsxImportSource preact */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, renderComponent, screen, within } from "../../../helpers/dom";
import { installI18nMock } from "../../../helpers/i18n";
import { installChatSignalAliases } from "../../../helpers/module-aliases";
import type { Message } from "../../../../src/types/messages";

installI18nMock({
  t: (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
});
await installChatSignalAliases();

const chat = await import("../../../../src/signals/chat");
mock.module("@/signals/chat", () => chat);
mock.module("@/hooks/useAttachments", () => ({
  compressImage: async () => ({ content: "data:image/png;base64,new", size: 3 }),
}));
mock.module("@/types/attachments", () => ({
  isSupportedImage: (mimeType: string) => mimeType.startsWith("image/"),
}));
mock.module("@/components/ui/Modal", () => ({
  Modal: ({
    children,
    footer,
    open,
    title,
  }: {
    children: preact.ComponentChildren;
    footer?: preact.ComponentChildren;
    open: boolean;
    title?: string;
  }) =>
    open ? (
      <section role="dialog" aria-label={title}>
        {children}
        {footer}
      </section>
    ) : null,
}));
mock.module("@/components/ui/ModalFooter", () => ({
  ModalFooter: ({
    confirmDisabled,
    confirmLabel,
    onCancel,
    onConfirm,
  }: {
    confirmDisabled?: boolean;
    confirmLabel?: string;
    onCancel: () => void;
    onConfirm: () => void;
  }) => (
    <div>
      <button type="button" onClick={onCancel}>
        actions.cancel
      </button>
      <button type="button" disabled={confirmDisabled} onClick={onConfirm}>
        {confirmLabel}
      </button>
    </div>
  ),
}));
mock.module("@/components/ui/Button", () => ({
  Button: ({
    children,
    disabled,
    onClick,
  }: {
    children?: preact.ComponentChildren;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}));
mock.module("@/components/ui/icons", () => ({
  AlertIcon: () => <span />,
  ChevronDownIcon: () => <span />,
  EditIcon: () => <span />,
  ImageIcon: () => <span />,
  PlusIcon: () => <span />,
  RetryIcon: () => <span />,
  SteerIcon: () => <span />,
  TrashIcon: () => <span />,
  XIcon: () => <span />,
}));

const { QueuedMessages } = await import("../../../../src/components/chat/QueuedMessages");

function queuedMessage(overrides: Partial<Message>): Message {
  return {
    id: "queued-1",
    role: "user",
    content: "queued content",
    timestamp: 1000,
    isStreaming: false,
    status: "queued",
    ...overrides,
  };
}

describe("QueuedMessages", () => {
  beforeEach(() => {
    chat.messageQueue.value = [];
  });

  test("edits queued content, rebuilds image attachments, and removes queued messages", () => {
    chat.messageQueue.value = [
      queuedMessage({
        id: "queued-1",
        content: "original queued",
        images: [{ alt: "queued image", url: "data:image/png;base64,old" }],
        pendingAttachments: [
          {
            content: "data:image/png;base64,old",
            fileName: "queued.png",
            mimeType: "image/png",
            type: "image",
          },
          {
            content: "notes",
            fileName: "notes.txt",
            mimeType: "text/plain",
            type: "file",
          },
        ],
      }),
    ];

    renderComponent(<QueuedMessages />);

    expect(screen.getByText('chat.queuedMessages:{"count":1}')).toBeTruthy();
    fireEvent.click(screen.getByLabelText("common.edit"));

    const dialog = screen.getByRole("dialog", { name: "chat.editQueuedMessage" });
    expect(within(dialog).getByRole("img", { name: "queued image" })).toBeTruthy();
    fireEvent.click(within(dialog).getByLabelText("actions.remove"));

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: "updated queued" } });
    fireEvent.click(screen.getByRole("button", { name: "actions.save" }));

    expect(chat.messageQueue.value[0]?.content).toBe("updated queued");
    expect(chat.messageQueue.value[0]?.images).toEqual([]);
    expect(chat.messageQueue.value[0]?.pendingAttachments).toEqual([
      {
        content: "notes",
        fileName: "notes.txt",
        mimeType: "text/plain",
        type: "file",
      },
    ]);

    fireEvent.click(screen.getByLabelText("actions.remove"));
    expect(chat.messageQueue.value).toEqual([]);
  });

  test("offers explicit steering for queued messages", () => {
    const steered: string[] = [];
    chat.messageQueue.value = [queuedMessage({ id: "queued-steer", sessionKey: "session-1" })];

    renderComponent(<QueuedMessages onSteer={(messageId) => steered.push(messageId)} />);

    fireEvent.click(screen.getByLabelText("actions.steer"));

    expect(steered).toEqual(["queued-steer"]);
    expect(chat.messageQueue.value).toHaveLength(1);
  });

  test("hides steering for queued messages that cannot be steered", () => {
    chat.messageQueue.value = [queuedMessage({ id: "queued-steer", sessionKey: "session-1" })];

    renderComponent(<QueuedMessages onSteer={() => undefined} canSteer={() => false} />);

    expect(screen.queryByLabelText("actions.steer")).toBeNull();
    expect(screen.getByLabelText("common.edit")).toBeTruthy();
  });

  test("shows pending tool-call state for steered queue messages", () => {
    chat.messageQueue.value = [
      queuedMessage({
        id: "queued-steered",
        queueKind: "steered",
        pendingRunId: "run-active",
        status: "sent",
      }),
    ];

    renderComponent(<QueuedMessages onSteer={() => undefined} />);

    expect(screen.getByText("chat.steeredStatus")).toBeTruthy();
    expect(screen.getByText("chat.steerPendingStatus")).toBeTruthy();
    expect(screen.queryByLabelText("actions.steer")).toBeNull();
    expect(screen.queryByLabelText("common.edit")).toBeNull();
    expect(screen.getByLabelText("actions.remove")).toBeTruthy();
  });

  test("shows failed queue errors and exposes explicit retry", () => {
    const retried: string[] = [];
    chat.messageQueue.value = [
      queuedMessage({
        id: "queued-failed",
        content: "failed steer",
        error: "soft steer failed",
        status: "failed",
      }),
    ];

    renderComponent(<QueuedMessages onRetry={(messageId) => retried.push(messageId)} />);

    expect(screen.getByText("connection.messageFailedStatus")).toBeTruthy();
    expect(screen.getByText("soft steer failed")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("actions.retry"));

    expect(retried).toEqual(["queued-failed"]);
    expect(screen.getByLabelText("common.edit")).toBeTruthy();
    expect(screen.getByLabelText("actions.remove")).toBeTruthy();
  });
});
