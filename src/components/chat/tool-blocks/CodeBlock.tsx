/**
 * CodeBlock
 *
 * Syntax-highlighted code block with expand/collapse and fullscreen modal.
 */

import { useRef, useState, useMemo } from "preact/hooks";
import Prism from "prismjs";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-json";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-python";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-go";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-diff";
import "prismjs/components/prism-css";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-toml";
import { MaximizeIcon } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/IconButton";
import { OutputModal, detectLanguage, detectLanguageFromPath } from "../OutputModal";
import { t } from "@/lib/i18n";
import { sanitizeCodeHtml } from "@/lib/sanitize";

export interface CodeBlockProps {
  content: unknown;
  maxLines?: number;
  error?: boolean;
  /** File path hint for syntax highlighting */
  filePath?: string;
}

export function CodeBlock({ content, maxLines = 30, error = false, filePath }: CodeBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showFull, setShowFull] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const handleCollapse = () => {
    setShowFull(false);
    // Scroll the code block back into view after collapsing
    requestAnimationFrame(() => {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  // Prepare content
  const isJson = typeof content === "object" && content !== null;
  const fullText = isJson ? JSON.stringify(content, null, 2) : String(content);
  const lines = fullText.split("\n");
  const truncated = lines.length > maxLines;
  const displayText = showFull || !truncated ? fullText : lines.slice(0, maxLines).join("\n");

  // Detect language: file path > JSON > content detection
  const language = isJson
    ? "json"
    : (filePath ? detectLanguageFromPath(filePath) : null) || detectLanguage(fullText);

  const highlightedContent = useMemo(() => {
    if (error || !language || !Prism.languages[language]) return null;
    try {
      const highlighted = Prism.highlight(displayText, Prism.languages[language], language);
      return sanitizeCodeHtml(highlighted);
    } catch {
      return null;
    }
  }, [displayText, language, error]);

  const baseClasses = `text-xs p-2 rounded-md overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap ${
    error
      ? "bg-[var(--color-error)]/10 text-[var(--color-error)]"
      : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]"
  }`;

  const toggleButtonClass =
    "block w-full text-left text-xs py-1 px-2 bg-[var(--color-bg-secondary)] rounded-b-md border-t border-[var(--color-border)] transition-colors";

  return (
    <>
      <div ref={containerRef} class="relative group">
        {/* Expand button - appears on hover/focus */}
        {(truncated || lines.length > 10) && (
          <IconButton
            icon={<MaximizeIcon />}
            label={t("toolOutput.expand")}
            variant="ghost"
            size="sm"
            showTooltip={false}
            onClick={() => setFullscreen(true)}
            class="!absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity z-10 bg-[var(--color-bg-surface)]/90 hover:bg-[var(--color-bg-secondary)]"
          />
        )}

        {/* Code content - highlighted or plain */}
        {highlightedContent ? (
          <pre
            class={`${baseClasses} ${showFull ? "" : "max-h-[300px]"}`}
            dangerouslySetInnerHTML={{ __html: highlightedContent }}
          />
        ) : (
          <pre class={`${baseClasses} ${showFull ? "" : "max-h-[300px]"}`}>{displayText}</pre>
        )}

        {/* Truncation indicator - clickable to expand inline */}
        {truncated && !showFull && (
          <button
            type="button"
            onClick={() => setShowFull(true)}
            class={`${toggleButtonClass} text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]`}
          >
            {t("toolOutput.moreLines", { count: lines.length - maxLines })}
          </button>
        )}

        {/* Collapse button when expanded inline */}
        {truncated && showFull && (
          <button
            type="button"
            onClick={handleCollapse}
            class={`${toggleButtonClass} text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]`}
          >
            {t("toolOutput.collapse")}
          </button>
        )}
      </div>

      {/* Fullscreen modal */}
      <OutputModal
        open={fullscreen}
        onClose={() => setFullscreen(false)}
        content={fullText}
        title={t("common.output")}
        language={language || undefined}
      />
    </>
  );
}
