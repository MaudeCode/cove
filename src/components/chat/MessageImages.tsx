/**
 * MessageImages
 *
 * Displays images attached to a message.
 * Supports click to expand/zoom.
 */

import { useState } from "preact/hooks";
import { X } from "lucide-preact";
import type { MessageImage } from "@/types/messages";
import { t } from "@/lib/i18n";

interface MessageImagesProps {
  images: MessageImage[];
}

export function MessageImages({ images }: MessageImagesProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (images.length === 0) return null;

  return (
    <>
      {/* Image grid */}
      <div class="flex flex-wrap gap-2 mt-2">
        {images.map((image, index) => (
          <button
            key={index}
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
        ))}
      </div>

      {/* Lightbox modal */}
      {expandedIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("chat.imageViewer")}
          class="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpandedIndex(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setExpandedIndex(null);
            if (e.key === "ArrowLeft")
              setExpandedIndex((expandedIndex - 1 + images.length) % images.length);
            if (e.key === "ArrowRight") setExpandedIndex((expandedIndex + 1) % images.length);
          }}
          tabIndex={0}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setExpandedIndex(null)}
            aria-label={t("actions.close")}
            class="
              absolute top-4 right-4 p-2 rounded-full cursor-pointer
              bg-white/10 text-white hover:bg-white/20
              transition-colors
            "
          >
            <X class="w-6 h-6" />
          </button>

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
                class="
                  absolute left-4 p-3 rounded-full cursor-pointer
                  bg-white/10 text-white hover:bg-white/20
                  transition-colors text-2xl
                "
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
                class="
                  absolute right-4 p-3 rounded-full cursor-pointer
                  bg-white/10 text-white hover:bg-white/20
                  transition-colors text-2xl
                "
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
