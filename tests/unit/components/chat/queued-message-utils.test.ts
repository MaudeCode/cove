import { describe, expect, test } from "bun:test";
import { buildQueuedMessageAttachments } from "../../../../src/components/chat/queued-message-utils";
import type { AttachmentPayload } from "../../../../src/types/attachments";
import type { Message } from "../../../../src/types/messages";

function queuedMessage(pendingAttachments: AttachmentPayload[]): Message {
  return {
    id: "user_queued",
    role: "user",
    content: "queued",
    pendingAttachments,
    timestamp: 1000,
    isStreaming: false,
    status: "queued",
    sessionKey: "session-1",
  };
}

describe("queued message utilities", () => {
  test("preserves file attachments while rebuilding image attachments after edits", () => {
    const imageAttachment: AttachmentPayload = {
      type: "image",
      mimeType: "image/png",
      fileName: "old.png",
      content: "data:image/png;base64,old",
    };
    const fileAttachment: AttachmentPayload = {
      type: "file",
      mimeType: "text/plain",
      fileName: "notes.txt",
      content: "data:text/plain;base64,file",
    };

    expect(
      buildQueuedMessageAttachments(queuedMessage([imageAttachment, fileAttachment]), [
        { url: "data:image/webp;base64,new", alt: "new.webp" },
      ]),
    ).toEqual([
      fileAttachment,
      {
        type: "image",
        mimeType: "image/webp",
        fileName: "new.webp",
        content: "data:image/webp;base64,new",
      },
    ]);
  });
});
