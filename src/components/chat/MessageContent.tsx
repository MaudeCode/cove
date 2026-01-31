/**
 * MessageContent
 *
 * Renders markdown content with syntax highlighting.
 */

import { useMemo, useRef, useEffect } from "preact/hooks";
import { renderMarkdown } from "@/lib/markdown";
import { t } from "@/lib/i18n";

interface MessageContentProps {
  content: string;
  isStreaming?: boolean;
}

export function MessageContent({ content, isStreaming = false }: MessageContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Render markdown
  const html = useMemo(() => {
    if (!content) return "";
    return renderMarkdown(content);
  }, [content]);

  // Add copy buttons to code blocks after render
  useEffect(() => {
    if (!containerRef.current) return;

    const codeBlocks = containerRef.current.querySelectorAll("pre.code-block");
    for (const block of codeBlocks) {
      // Skip if already has copy button
      if (block.querySelector(".copy-button")) return;

      const button = document.createElement("button");
      button.className = "copy-button";
      button.textContent = t("actions.copy");
      button.setAttribute("type", "button");
      button.onclick = async () => {
        const code = block.querySelector("code")?.textContent || "";
        try {
          await navigator.clipboard.writeText(code);
          button.textContent = t("actions.copied");
          setTimeout(() => {
            button.textContent = t("actions.copy");
          }, 2000);
        } catch {
          // Fallback for older browsers
          const textarea = document.createElement("textarea");
          textarea.value = code;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          document.body.removeChild(textarea);
          button.textContent = t("actions.copied");
          setTimeout(() => {
            button.textContent = t("actions.copy");
          }, 2000);
        }
      };

      // Position button in top-right of code block
      block.classList.add("relative");
      block.insertBefore(button, block.firstChild);
    }
  }, [html]);

  if (!content && isStreaming) {
    return (
      <span class="inline-flex items-center gap-2 text-[var(--color-text-muted)]">
        {t("chat.thinking")}
        <span class="inline-flex items-end gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-bounce-dot-1" />
          <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-bounce-dot-2" />
          <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-bounce-dot-3" />
        </span>
      </span>
    );
  }

  return (
    <div
      ref={containerRef}
      class="message-content prose prose-sm max-w-none"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown rendering requires innerHTML
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
