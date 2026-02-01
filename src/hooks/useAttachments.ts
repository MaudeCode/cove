/**
 * useAttachments Hook
 *
 * Manages file attachments for chat input.
 * Handles file selection, drag-drop, and clipboard paste.
 */

import { useSignal } from "@preact/signals";
import { useCallback, useEffect } from "preact/hooks";
import type { Attachment, AttachmentPayload } from "@/types/attachments";
import { isSupportedImage, MAX_FILE_SIZE } from "@/types/attachments";

let attachmentIdCounter = 0;

function generateAttachmentId(): string {
  return `attachment_${Date.now()}_${++attachmentIdCounter}`;
}

/**
 * Convert a File to an Attachment object
 */
async function fileToAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const content = reader.result as string;
      const isImage = isSupportedImage(file.type);

      resolve({
        id: generateAttachmentId(),
        type: isImage ? "image" : "file",
        mimeType: file.type || "application/octet-stream",
        fileName: file.name,
        content,
        size: file.size,
        previewUrl: isImage ? URL.createObjectURL(file) : undefined,
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
