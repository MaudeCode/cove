import type { AttachmentPayload } from "@/types/attachments";
import type { Message, MessageImage } from "@/types/messages";

/**
 * Convert attachment payloads to message images for local display.
 * Note: Only images are stored; OpenClaw drops non-image attachments.
 */
export function attachmentsToImages(attachments?: AttachmentPayload[]): MessageImage[] | undefined {
  if (!attachments || attachments.length === 0) return undefined;

  const images: MessageImage[] = [];
  for (const attachment of attachments) {
    if (attachment.type === "image") {
      images.push({
        url: attachment.content,
        alt: attachment.fileName,
      });
    }
  }

  return images.length > 0 ? images : undefined;
}

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
  return [...existingFiles, ...getSendableImages(images).map(imageToAttachmentPayload)];
}

export function getResendAttachments(message: Message): AttachmentPayload[] | undefined {
  if (message.pendingAttachments !== undefined) {
    return message.pendingAttachments.length > 0 ? message.pendingAttachments : undefined;
  }

  if (!message.images || message.images.length === 0) {
    return undefined;
  }

  const attachments = getSendableImages(message.images).map(imageToAttachmentPayload);
  return attachments.length > 0 ? attachments : undefined;
}

function getSendableImages(images: MessageImage[]): MessageImage[] {
  return images.filter((image) => !image.omitted && image.url.trim() !== "");
}

function getImageMimeType(url: string): string {
  const match = /^data:([^;,]+)/.exec(url);
  return match?.[1] || "image/png";
}
