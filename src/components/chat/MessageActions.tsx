/**
 * MessageActions
 *
 * Dropdown menu for message actions (copy, etc.)
 * Appears on hover in the top-right corner of messages.
 */

import { useState, useRef, useEffect } from "preact/hooks";
import { MoreVertical, Copy, FileText, Check } from "lucide-preact";
import { t } from "@/lib/i18n";

interface MessageActionsProps {
  /** Raw markdown content */
  content: string;
  /** Whether the menu should be visible (controlled by parent hover state) */
  visible?: boolean;
}

export function MessageActions({ content, visible = false }: MessageActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState<"formatted" | "raw" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Reset copied state after delay
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  /**
   * Copy formatted text (rendered, no markdown)
   */
  const copyFormatted = async () => {
    // Create a temporary element to render markdown as HTML, then extract text
    const temp = document.createElement("div");
    temp.innerHTML = content;
    // For plain text, just use the content directly since MessageContent renders it
    // The actual rendered text is what the user sees
    const text = content
      // Remove markdown formatting for "formatted" copy
      .replace(/\*\*(.+?)\*\*/g, "$1") // bold
      .replace(/\*(.+?)\*/g, "$1") // italic
      .replace(/__(.+?)__/g, "$1") // bold
      .replace(/_(.+?)_/g, "$1") // italic
      .replace(/~~(.+?)~~/g, "$1") // strikethrough
      .replace(/`(.+?)`/g, "$1") // inline code
      .replace(/^#{1,6}\s+/gm, "") // headers
      .replace(/^\s*[-*+]\s+/gm, "• ") // bullet lists
      .replace(/^\s*\d+\.\s+/gm, "") // numbered lists
      .replace(/\[(.+?)\]\(.+?\)/g, "$1") // links
      .replace(/!\[.*?\]\(.+?\)/g, "") // images
      .replace(/^>\s+/gm, "") // blockquotes
      .replace(/```[\s\S]*?```/g, (match) => {
        // Extract code from code blocks
        return match.replace(/```\w*\n?/, "").replace(/```$/, "");
      });

    await navigator.clipboard.writeText(text.trim());
    setCopied("formatted");
    setIsOpen(false);
  };

  /**
   * Copy raw markdown
   */
  const copyRaw = async () => {
    await navigator.clipboard.writeText(content);
    setCopied("raw");
    setIsOpen(false);
  };

  return (
    <div class="relative">
      {/* Trigger button - always rendered, visibility controlled by opacity */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t("actions.more")}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        class={`
          p-1 rounded
          text-[var(--color-text-muted)]
          hover:text-[var(--color-text-secondary)]
          hover:bg-[var(--color-bg-hover)]
          transition-all cursor-pointer
          ${isOpen ? "opacity-100 bg-[var(--color-bg-hover)]" : visible ? "opacity-100" : "opacity-0"}
        `}
      >
        <MoreVertical class="w-4 h-4" />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          class="
            absolute right-0 top-full mt-1 z-50
            min-w-[160px] py-1
            bg-[var(--color-bg-surface)]
            border border-[var(--color-border)]
            rounded-lg shadow-lg
          "
        >
          <button
            role="menuitem"
            onClick={copyFormatted}
            class="
              w-full px-3 py-2 text-left text-sm
              flex items-center gap-2
              text-[var(--color-text-primary)]
              hover:bg-[var(--color-bg-hover)]
              transition-colors cursor-pointer
            "
          >
            {copied === "formatted" ? (
              <Check class="w-4 h-4 text-[var(--color-success)]" />
            ) : (
              <Copy class="w-4 h-4 text-[var(--color-text-muted)]" />
            )}
            {copied === "formatted" ? t("actions.copied") : t("actions.copy")}
          </button>

          <button
            role="menuitem"
            onClick={copyRaw}
            class="
              w-full px-3 py-2 text-left text-sm
              flex items-center gap-2
              text-[var(--color-text-primary)]
              hover:bg-[var(--color-bg-hover)]
              transition-colors cursor-pointer
            "
          >
            {copied === "raw" ? (
              <Check class="w-4 h-4 text-[var(--color-success)]" />
            ) : (
              <FileText class="w-4 h-4 text-[var(--color-text-muted)]" />
            )}
            {copied === "raw" ? t("actions.copied") : t("chat.copyMarkdown")}
          </button>
        </div>
      )}
    </div>
  );
}
