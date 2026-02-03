/**
 * JsonBlock
 *
 * Syntax-highlighted JSON display with copy button.
 */

import { signal } from "@preact/signals";
import Prism from "prismjs";
import "prismjs/components/prism-json";
import { t } from "@/lib/i18n";
import { sanitizeCodeHtml } from "@/lib/sanitize";
import { IconButton } from "@/components/ui/IconButton";
import { Copy, Check } from "lucide-preact";

// ============================================
// State
// ============================================

const copiedId = signal<string | null>(null);

// ============================================
// Helpers
// ============================================

let blockCounter = 0;

function generateId(): string {
  return `json-block-${++blockCounter}`;
}

async function copyToClipboard(text: string, id: string) {
  try {
    await navigator.clipboard.writeText(text);
    copiedId.value = id;
    setTimeout(() => {
      if (copiedId.value === id) {
        copiedId.value = null;
      }
    }, 2000);
  } catch {
    // Ignore clipboard errors
  }
}

function highlightJson(json: string): string {
  try {
    const highlighted = Prism.highlight(json, Prism.languages.json, "json");
    // Sanitize output to prevent XSS via malformed JSON strings
    return sanitizeCodeHtml(highlighted);
  } catch {
    // Fallback: escape any HTML in raw JSON
    return sanitizeCodeHtml(json);
  }
}

// ============================================
// Component
// ============================================

interface JsonBlockProps {
  /** JSON string to display */
  value: string;
  /** Maximum height (default: max-h-48) */
  maxHeight?: string;
  /** Optional ID for copy state tracking */
  id?: string;
}

export function JsonBlock({ value, maxHeight = "max-h-48", id }: JsonBlockProps) {
  const blockId = id ?? generateId();
  const isCopied = copiedId.value === blockId;
  const highlighted = highlightJson(value);

  return (
    <div class="relative group">
      <pre
        class={`text-xs font-mono bg-[var(--color-bg-tertiary)] p-3 rounded-lg overflow-x-auto ${maxHeight}`}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
      <IconButton
        icon={isCopied ? <Check size={14} /> : <Copy size={14} />}
        size="sm"
        variant="ghost"
        label={t("actions.copy")}
        class="absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity"
        onClick={() => copyToClipboard(value, blockId)}
      />
    </div>
  );
}
