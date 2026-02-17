/**
 * OutputModal
 *
 * Full-screen modal optimized for reading tool output.
 * Near-fullscreen with monospace font, copy support, and syntax highlighting.
 */

import { createPortal } from "preact/compat";
import { useEffect, useRef, useCallback, useState, useMemo } from "preact/hooks";
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
import { IconButton } from "@/components/ui/IconButton";
import { XIcon } from "@/components/ui/icons";
import { t } from "@/lib/i18n";
import { log } from "@/lib/logger";
import { sanitizeCodeHtml } from "@/lib/sanitize";

interface OutputModalProps {
  open: boolean;
  onClose: () => void;
  content: string;
  /** Pre-localized title */
  title: string;
  /** Language hint for syntax highlighting (auto-detects if not provided) */
  language?: string;
}

/** Map file extensions to Prism language */
const extToLang: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  json: "json",
  py: "python",
  rs: "rust",
  go: "go",
  yaml: "yaml",
  yml: "yaml",
  md: "markdown",
  css: "css",
  sql: "sql",
  toml: "toml",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  diff: "diff",
  patch: "diff",
};

/** Detect language from file path extension */
export function detectLanguageFromPath(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase();
  return ext ? extToLang[ext] || null : null;
}

/** Detect language from content */
export function detectLanguage(content: string): string | null {
  const trimmed = content.trim();

  // JSON detection
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // Not valid JSON
    }
  }

  // Shebang detection
  if (trimmed.startsWith("#!/")) {
    if (trimmed.includes("python")) return "python";
    if (trimmed.includes("node")) return "javascript";
    if (trimmed.includes("bash") || trimmed.includes("/sh")) return "bash";
    return "bash";
  }

  // YAML detection (common patterns)
  if (/^[\w-]+:\s/m.test(trimmed) && !trimmed.includes("{")) {
    return "yaml";
  }

  // Diff detection
  if (trimmed.startsWith("diff ") || (trimmed.startsWith("---") && trimmed.includes("+++"))) {
    return "diff";
  }

  return null;
}

export function OutputModal({ open, onClose, content, title, language }: OutputModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Syntax highlight content
  const highlightedContent = useMemo(() => {
    const lang = language || detectLanguage(content);
    if (!lang || !Prism.languages[lang]) return null;

    try {
      const highlighted = Prism.highlight(content, Prism.languages[lang], lang);
      return sanitizeCodeHtml(highlighted);
    } catch {
      return null;
    }
  }, [content, language]);

  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, handleKeyDown]);

  // Focus modal when opened
  useEffect(() => {
    if (open && modalRef.current) {
      modalRef.current.focus();
    }
  }, [open]);

  const handleCopy = async () => {
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : null;
    if (!clipboard?.writeText) {
      log.ui.warn("Clipboard API not available");
      return;
    }

    try {
      await clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      log.ui.warn("Failed to copy output to clipboard", error);
    }
  };

  if (!open) return null;

  const lines = content.split("\n");

  return createPortal(
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby="output-modal-title"
    >
      {/* Backdrop */}
      <div
        class="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        tabIndex={-1}
        class="relative w-full h-full max-w-[95vw] max-h-[90vh] flex flex-col bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-2xl focus:outline-none overflow-hidden"
      >
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-surface)]">
          <h2 id="output-modal-title" class="text-sm font-medium text-[var(--color-text-primary)]">
            {title}
            <span class="ml-2 text-xs text-[var(--color-text-muted)]">
              {t("toolOutput.lines", { count: lines.length })}
            </span>
          </h2>

          <div class="flex items-center gap-2">
            {/* Copy button */}
            <button
              type="button"
              onClick={handleCopy}
              class="text-xs px-2 py-1 rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {copied ? t("actions.copied") : t("actions.copy")}
            </button>

            {/* Close button */}
            <IconButton
              icon={<XIcon />}
              label={t("actions.close")}
              variant="ghost"
              size="sm"
              onClick={onClose}
            />
          </div>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-auto bg-[var(--color-bg-tertiary)]">
          {highlightedContent ? (
            <pre
              class="text-xs font-mono leading-relaxed p-4 whitespace-pre-wrap break-words"
              dangerouslySetInnerHTML={{ __html: highlightedContent }}
            />
          ) : (
            <pre class="text-xs font-mono leading-relaxed p-4 text-[var(--color-text-primary)] whitespace-pre-wrap break-words">
              {content}
            </pre>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
