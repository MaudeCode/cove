/**
 * AttachmentPreview
 *
 * Shows preview of attachments before sending.
 * Supports images with thumbnails, files with icon.
 */

import { X, FileText, Image as ImageIcon } from "lucide-preact";
import type { Attachment } from "@/types/attachments";
import { Spinner } from "@/components/ui/Spinner";
import { Tooltip } from "@/components/ui/Tooltip";
import { t } from "@/lib/i18n";

interface AttachmentPreviewProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
  isProcessing?: boolean;
}

export function AttachmentPreview({ attachments, onRemove, isProcessing }: AttachmentPreviewProps) {
  if (attachments.length === 0 && !isProcessing) return null;

  return (
    <div class="flex flex-wrap gap-2 px-4 pb-2 items-center">
      {attachments.map((att) => (
        <AttachmentItem key={att.id} attachment={att} onRemove={() => onRemove(att.id)} />
      ))}
      {isProcessing && (
        <div
          class="
            w-16 h-16 rounded-lg
            border border-[var(--color-border)]
            bg-[var(--color-bg-secondary)]
            flex items-center justify-center
          "
        >
          <Spinner size="sm" />
        </div>
      )}
    </div>
  );
}

interface AttachmentItemProps {
  attachment: Attachment;
  onRemove: () => void;
}

function AttachmentItem({ attachment, onRemove }: AttachmentItemProps) {
  const isImage = attachment.type === "image";
  const sizeLabel = formatFileSize(attachment.size);

  return (
    <div class="relative group">
      <Tooltip content={`${attachment.fileName} (${sizeLabel})`} placement="top">
        <div
          class="
            relative w-16 h-16 rounded-lg overflow-hidden
            border border-[var(--color-border)]
            bg-[var(--color-bg-secondary)]
            flex items-center justify-center
          "
        >
          {isImage && attachment.previewUrl ? (
            <img
              src={attachment.previewUrl}
              alt={attachment.fileName}
              class="w-full h-full object-cover"
            />
          ) : (
            <div class="flex flex-col items-center gap-1 text-[var(--color-text-muted)]">
              {isImage ? <ImageIcon class="w-6 h-6" /> : <FileText class="w-6 h-6" />}
              <span class="text-[8px] truncate max-w-[56px] px-1">
                {getFileExtension(attachment.fileName)}
              </span>
            </div>
          )}
        </div>
      </Tooltip>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("actions.remove")}
        class="
          absolute -top-1.5 -right-1.5
          w-5 h-5 rounded-full
          bg-[var(--color-bg-surface)] border border-[var(--color-border)]
          flex items-center justify-center
          opacity-0 group-hover:opacity-100
          hover:bg-[var(--color-error)] hover:border-[var(--color-error)] hover:text-white
          transition-all cursor-pointer
        "
      >
        <X class="w-3 h-3" />
      </button>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toUpperCase();
  return ext || "FILE";
}
