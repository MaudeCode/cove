/**
 * useAttachments Hook
 *
 * Manages file attachments for chat input.
 * Handles file selection, drag-drop, and clipboard paste.
 */

import { useSignal } from "@preact/signals";
import { useCallback, useEffect } from "preact/hooks";
import type { Attachment, AttachmentPayload } from "@/types/attachments";
import {
  isSupportedImage,
  MAX_FILE_SIZE,
  MAX_PAYLOAD_SIZE,
  MAX_IMAGE_DIMENSION,
} from "@/types/attachments";

let attachmentIdCounter = 0;

function generateAttachmentId(): string {
  return `attachment_${Date.now()}_${++attachmentIdCounter}`;
}

/**
 * Compress an image to fit within size limits
 */
async function compressImage(file: File): Promise<{ content: string; size: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Canvas not supported"));
      return;
    }

    img.onload = () => {
      // Calculate new dimensions (maintain aspect ratio)
      let { width, height } = img;

      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // Try different quality levels to fit within payload limit
      const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
      let quality = 0.9;
      let content = canvas.toDataURL(mimeType, quality);

      // For JPEG, reduce quality until it fits (PNG doesn't use quality param)
      if (mimeType === "image/jpeg") {
        while (content.length > MAX_PAYLOAD_SIZE && quality > 0.1) {
          quality -= 0.1;
          content = canvas.toDataURL(mimeType, quality);
        }
      }

      // If still too large (PNG or very complex image), resize more aggressively
      let scale = 1;
      while (content.length > MAX_PAYLOAD_SIZE && scale > 0.2) {
        scale -= 0.1;
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        content = canvas.toDataURL(mimeType, mimeType === "image/jpeg" ? 0.8 : undefined);
      }

      // Estimate actual byte size (base64 is ~4/3 of original)
      const base64Data = content.split(",")[1] || "";
      const byteSize = Math.round((base64Data.length * 3) / 4);

      URL.revokeObjectURL(img.src);
      resolve({ content, size: byteSize });
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Failed to load image"));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Convert a File to an Attachment object (with compression for images)
 */
async function fileToAttachment(file: File): Promise<Attachment> {
  const isImage = isSupportedImage(file.type);

  if (isImage) {
    // Compress image to fit within gateway limits
    const { content, size } = await compressImage(file);

    return {
      id: generateAttachmentId(),
      type: "image",
      mimeType: file.type === "image/png" ? "image/png" : "image/jpeg",
      fileName: file.name,
      content,
      size,
      previewUrl: content, // Use compressed version for preview
    };
  }

  // Non-image files: read as-is
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const content = reader.result as string;

      resolve({
        id: generateAttachmentId(),
        type: "file",
        mimeType: file.type || "application/octet-stream",
        fileName: file.name,
        content,
        size: file.size,
      });
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export interface UseAttachmentsResult {
  /** Current attachments */
  attachments: Attachment[];
  /** Add files (from input or drop) */
  addFiles: (files: FileList | File[]) => Promise<void>;
  /** Remove an attachment by ID */
  removeAttachment: (id: string) => void;
  /** Clear all attachments */
  clearAttachments: () => void;
  /** Get attachments as payloads for sending */
  getPayloads: () => AttachmentPayload[];
  /** Handle paste event (for clipboard images) */
  handlePaste: (e: ClipboardEvent) => Promise<boolean>;
  /** Error message if any */
  error: string | null;
  /** Clear error */
  clearError: () => void;
}

export function useAttachments(): UseAttachmentsResult {
  const attachments = useSignal<Attachment[]>([]);
  const error = useSignal<string | null>(null);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      for (const att of attachments.value) {
        if (att.previewUrl) {
          URL.revokeObjectURL(att.previewUrl);
        }
      }
    };
  }, []);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    error.value = null;

    for (const file of fileArray) {
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        error.value = `File "${file.name}" is too large (max 10MB)`;
        continue;
      }

      // Non-image files can't be compressed, check payload limit
      if (!isSupportedImage(file.type) && file.size > MAX_PAYLOAD_SIZE) {
        error.value = `File "${file.name}" is too large (max 400KB for non-images)`;
        continue;
      }

      try {
        const attachment = await fileToAttachment(file);
        attachments.value = [...attachments.value, attachment];
      } catch {
        error.value = `Failed to read "${file.name}"`;
      }
    }
  }, []);

  const removeAttachment = useCallback((id: string) => {
    const att = attachments.value.find((a) => a.id === id);
    if (att?.previewUrl) {
      URL.revokeObjectURL(att.previewUrl);
    }
    attachments.value = attachments.value.filter((a) => a.id !== id);
  }, []);

  const clearAttachments = useCallback(() => {
    for (const att of attachments.value) {
      if (att.previewUrl) {
        URL.revokeObjectURL(att.previewUrl);
      }
    }
    attachments.value = [];
  }, []);

  const getPayloads = useCallback((): AttachmentPayload[] => {
    return attachments.value.map((att) => ({
      type: att.type,
      mimeType: att.mimeType,
      fileName: att.fileName,
      content: att.content,
    }));
  }, []);

  const handlePaste = useCallback(async (e: ClipboardEvent): Promise<boolean> => {
    const items = e.clipboardData?.items;
    if (!items) return false;

    const imageItems: DataTransferItem[] = [];
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        imageItems.push(item);
      }
    }

    if (imageItems.length === 0) return false;

    // Prevent default paste behavior for images
    e.preventDefault();
    error.value = null;

    for (const item of imageItems) {
      const file = item.getAsFile();
      if (!file) continue;

      if (file.size > MAX_FILE_SIZE) {
        error.value = "Pasted image is too large (max 10MB)";
        continue;
      }

      try {
        const attachment = await fileToAttachment(file);
        attachments.value = [...attachments.value, attachment];
      } catch {
        error.value = "Failed to read pasted image";
      }
    }

    return true;
  }, []);

  const clearError = useCallback(() => {
    error.value = null;
  }, []);

  return {
    attachments: attachments.value,
    addFiles,
    removeAttachment,
    clearAttachments,
    getPayloads,
    handlePaste,
    error: error.value,
    clearError,
  };
}
