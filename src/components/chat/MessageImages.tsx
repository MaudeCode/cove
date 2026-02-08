/**
 * MessageImages
 *
 * Displays images attached to a message.
 * Supports click to expand/zoom and download.
 */

import { useState, useRef, useEffect } from "preact/hooks";
import { X, Download } from "lucide-preact";
import type { MessageImage } from "@/types/messages";
import { t } from "@/lib/i18n";

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

  // Focus lightbox when opened for keyboard navigation
  useEffect(() => {
    if (expandedIndex !== null) {
      lightboxRef.current?.focus();
    }
  }, [expandedIndex]);

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
            <button
              type="button"
              onClick={() => setExpandedIndex(index)}
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
              aria-label={t("actions.download")}
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
          </div>
        ))}
      </div>

      {/* Lightbox modal */}
      {expandedIndex !== null && (
        <div
          ref={lightboxRef}
          role="dialog"
          aria-modal="true"
          aria-label={t("chat.imageViewer")}
          class="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4 outline-none"
          onClick={() => setExpandedIndex(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setExpandedIndex(null);
            if (e.key === "ArrowLeft")
              setExpandedIndex((expandedIndex - 1 + images.length) % images.length);
            if (e.key === "ArrowRight") setExpandedIndex((expandedIndex + 1) % images.length);
          }}
          tabIndex={0}
        >
          {/* Top-right controls: Download + Close */}
          <div class="absolute top-4 right-4 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => handleDownload(e, images[expandedIndex].url, expandedIndex)}
              aria-label={t("actions.download")}
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
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedIndex((expandedIndex - 1 + images.length) % images.length);
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
                  setExpandedIndex((expandedIndex + 1) % images.length);
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
            src={images[expandedIndex].url}
            alt={images[expandedIndex].alt || `Image ${expandedIndex + 1}`}
            class="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          />

          {/* Image counter */}
          {images.length > 1 && (
            <div class="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white text-sm">
              {expandedIndex + 1} / {images.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}
