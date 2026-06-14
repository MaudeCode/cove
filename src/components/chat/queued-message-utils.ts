import type { AttachmentPayload } from "@/types/attachments";
import type { Message, MessageImage } from "@/types/messages";

export function imageToAttachmentPayload(image: MessageImage): AttachmentPayload {
  return {
    type: "image",
    mimeType: getImageMimeType(image.url),
    fileName: image.alt || "image",
    content: image.url,
  };
}

export function buildQueuedMessageAttachments(
  message: Message,
  images: MessageImage[],
): AttachmentPayload[] {
  const existingFiles =
    message.pendingAttachments?.filter((attachment) => attachment.type !== "image") ?? [];
  return [...existingFiles, ...images.map(imageToAttachmentPayload)];
}

function getImageMimeType(url: string): string {
  const match = /^data:([^;,]+)/.exec(url);
  return match?.[1] || "image/png";
}
