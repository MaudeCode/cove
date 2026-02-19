/**
 * MessageImages
 *
 * Displays images attached to a message.
 * Supports click to expand/zoom and download.
 */

import { useState, useRef, useEffect } from "preact/hooks";
import { X, Download, ImageOff } from "lucide-preact";
import type { MessageImage } from "@/types/messages";
import { formatBytes, t } from "@/lib/i18n";

interface MessageImagesProps {
  images: MessageImage[];
}

/** Shared styles for lightbox control buttons */
const LIGHTBOX_BUTTON_CLASS = `
  p-2 rounded-full cursor-pointer
  bg-white/10 text-white hover:bg-white/20
  transition-colors
`;

/**
 * Downloads an image by fetching as blob and triggering download.
 */
async function downloadImage(url: string, filename: string) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch {
    // Fallback: open in new tab if download fails
    window.open(url, "_blank");
  }
}

/**
 * Extracts filename from URL or generates one.
 */
function getFilenameFromUrl(url: string, index: number): string {
  try {
    const pathname = new URL(url).pathname;
    const name = pathname.split("/").pop();
    if (name && /\.(png|jpe?g|gif|webp|svg)$/i.test(name)) {
      return name;
    }
  } catch {
    // Invalid URL, use fallback
  }
  return `image-${index + 1}.png`;
}

export function MessageImages({ images }: MessageImagesProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);

  const previewableImages = images.filter((image) => !image.omitted && !!image.url);
  const previewIndexByOriginal = new Map<number, number>();
  let previewIndex = 0;
  for (const [index, image] of images.entries()) {
    if (!image.omitted && image.url) {
      previewIndexByOriginal.set(index, previewIndex++);
    }
  }

  // Focus lightbox when opened for keyboard navigation
  useEffect(() => {
    if (expandedIndex !== null) {
      lightboxRef.current?.focus();
    }
  }, [expandedIndex]);

  // Close lightbox if image list changed and current index is no longer valid
  useEffect(() => {
    if (expandedIndex !== null && expandedIndex >= previewableImages.length) {
      setExpandedIndex(null);
    }
  }, [expandedIndex, previewableImages.length]);

  if (images.length === 0) return null;

  const handleDownload = (e: Event, url: string, index: number) => {
    e.stopPropagation();
    downloadImage(url, getFilenameFromUrl(url, index));
  };

  return (
    <>
      {/* Image grid */}
      <div class="flex flex-wrap gap-2 mt-2">
        {images.map((image, index) => (
          <div key={index} class="relative group">
            {image.omitted ? (
              <div
                class="
                  w-[200px] h-[140px] rounded-lg border border-dashed border-[var(--color-border)]
                  bg-[var(--color-bg-secondary)] px-3 py-2
                  flex flex-col items-center justify-center gap-2 text-center
                "
                title={
                  image.bytes != null
                    ? t("chat.omittedImage", { size: formatBytes(image.bytes) })
                    : t("chat.omittedImageNoSize")
                }
              >
                <ImageOff class="w-5 h-5 text-[var(--color-text-muted)]" aria-hidden="true" />
                <p class="text-xs text-[var(--color-text-secondary)] leading-tight">
                  {image.bytes != null
                    ? t("chat.omittedImage", { size: formatBytes(image.bytes) })
                    : t("chat.omittedImageNoSize")}
                </p>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const previewIdx = previewIndexByOriginal.get(index);
                    if (previewIdx !== undefined) setExpandedIndex(previewIdx);
                  }}
                  class="
                    relative rounded-lg overflow-hidden cursor-pointer
                    border border-[var(--color-border)]
                    hover:border-[var(--color-accent)] hover:shadow-md
                    transition-all
                  "
                >
                  <img
                    src={image.url}
                    alt={image.alt || `Image ${index + 1}`}
                    class="max-w-[200px] max-h-[200px] object-cover"
                    loading="lazy"
                  />
                </button>

                {/* Download button on hover */}
                <button
                  type="button"
                  onClick={(e) => handleDownload(e, image.url, index)}
                  aria-label={t("common.download")}
                  class="
                    absolute bottom-2 right-2 p-1.5 rounded-lg cursor-pointer
                    bg-black/60 text-white
                    opacity-0 group-hover:opacity-100
                    hover:bg-black/80
                    transition-all
                  "
                >
                  <Download class="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox modal */}
      {expandedIndex !== null && previewableImages.length > 0 && (
        <div
          ref={lightboxRef}
          role="dialog"
          aria-modal="true"
          aria-label={t("common.imageViewer")}
          class="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4 outline-none"
          onClick={() => setExpandedIndex(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setExpandedIndex(null);
            if (e.key === "ArrowLeft")
              setExpandedIndex(
                (expandedIndex - 1 + previewableImages.length) % previewableImages.length,
              );
            if (e.key === "ArrowRight")
              setExpandedIndex((expandedIndex + 1) % previewableImages.length);
          }}
          tabIndex={0}
        >
          {/* Top-right controls: Download + Close */}
          <div class="absolute top-4 right-4 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) =>
                handleDownload(e, previewableImages[expandedIndex].url, expandedIndex)
              }
              aria-label={t("common.download")}
              class={LIGHTBOX_BUTTON_CLASS}
            >
              <Download class="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={() => setExpandedIndex(null)}
              aria-label={t("actions.close")}
              class={LIGHTBOX_BUTTON_CLASS}
            >
              <X class="w-6 h-6" />
            </button>
          </div>

          {/* Navigation for multiple images */}
          {previewableImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedIndex(
                    (expandedIndex - 1 + previewableImages.length) % previewableImages.length,
                  );
                }}
                aria-label={t("actions.back")}
                class={`${LIGHTBOX_BUTTON_CLASS} absolute left-4 p-3 text-2xl`}
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedIndex((expandedIndex + 1) % previewableImages.length);
                }}
                aria-label={t("actions.next")}
                class={`${LIGHTBOX_BUTTON_CLASS} absolute right-4 p-3 text-2xl`}
              >
                ›
              </button>
            </>
          )}

          {/* Image - stop propagation to prevent closing when clicking on image */}
          <img
            src={previewableImages[expandedIndex].url}
            alt={previewableImages[expandedIndex].alt || `Image ${expandedIndex + 1}`}
            class="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          />

          {/* Image counter */}
          {previewableImages.length > 1 && (
            <div class="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white text-sm">
              {expandedIndex + 1} / {previewableImages.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}
