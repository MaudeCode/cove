/**
 * Image tool blocks
 */

import { useState, useMemo } from "preact/hooks";
import { t } from "@/lib/i18n";
import { renderMarkdown } from "@/lib/markdown";
import { ToolInputContainer } from "./shared";

// ============================================
// Input Block
// ============================================

interface ImageInputBlockProps {
  args: Record<string, unknown>;
}

export function ImageInputBlock({ args }: ImageInputBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const image = args.image as string;
  const prompt = args.prompt as string | undefined;
  const isUrl = image?.startsWith("http");

  return (
    <div class="space-y-2">
      {/* Image thumbnail if URL */}
      {isUrl && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          class="rounded-md overflow-hidden bg-[var(--color-bg-tertiary)] p-2 cursor-pointer hover:bg-[var(--color-bg-secondary)] transition-colors"
          aria-label={t("toolInput.expandImage")}
        >
          <img
            src={image}
            alt={t("toolInput.inputImage")}
            class="max-h-[150px] max-w-full rounded object-contain"
            loading="lazy"
          />
        </button>
      )}
      {/* Image path if not URL */}
      {!isUrl && image && (
        <ToolInputContainer>
          <span class="sr-only">{t("toolInput.imagePath")}: </span>
          🖼️ {image}
        </ToolInputContainer>
      )}
      {/* Prompt */}
      {prompt && (
        <ToolInputContainer>
          <span class="sr-only">{t("toolInput.prompt")}: </span>💬 {prompt}
        </ToolInputContainer>
      )}

      {/* Lightbox */}
      {expanded && isUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("common.imageViewer")}
          class="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setExpanded(false)}
          onKeyDown={(e) => e.key === "Escape" && setExpanded(false)}
          tabIndex={0}
        >
          <button
            type="button"
            onClick={() => setExpanded(false)}
            class="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label={t("actions.close")}
          >
            ✕
          </button>
          <img
            src={image}
            alt={t("toolInput.expandedImage")}
            class="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ============================================
// Result Block
// ============================================

export function ImageResultBlock({ result }: { result: unknown }) {
  const text = typeof result === "string" ? result : String(result);

  // Render as markdown
  const html = useMemo(() => renderMarkdown(text), [text]);

  return (
    <div
      class="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed p-2 rounded-md bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] [&_strong]:text-[var(--color-text-primary)] [&_em]:text-[var(--color-text-secondary)]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
