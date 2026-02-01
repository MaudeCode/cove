/**
 * Attachment Types
 *
 * Types for file/image attachments in chat.
 */

export interface Attachment {
  /** Unique ID for this attachment */
  id: string;
  /** Attachment type */
  type: "image" | "file";
  /** MIME type */
  mimeType: string;
  /** Original filename */
  fileName: string;
  /** Base64 data URL (data:mime;base64,...) */
  content: string;
  /** File size in bytes */
  size: number;
  /** Preview URL for images (blob URL) */
  previewUrl?: string;
}

/** Attachment for sending to gateway */
export interface AttachmentPayload {
  type: "image" | "file";
  mimeType: string;
  fileName: string;
  content: string;
}

/** Supported image MIME types */
export const SUPPORTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

/** Max file size (10MB for input, but will be compressed) */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Max payload size for gateway (512KB) - images will be compressed to fit */
export const MAX_PAYLOAD_SIZE = 400 * 1024; // Leave headroom for base64 + message overhead

/** Max image dimension (will resize if larger) */
export const MAX_IMAGE_DIMENSION = 2048;

/** Check if MIME type is a supported image */
export function isSupportedImage(mimeType: string): boolean {
  return SUPPORTED_IMAGE_TYPES.includes(mimeType as (typeof SUPPORTED_IMAGE_TYPES)[number]);
}
