/**
 * MessageContent
 *
 * Renders markdown content with syntax highlighting and search highlighting.
 */

import { useRef, useEffect } from "preact/hooks";
import { renderMarkdown } from "@/lib/markdown";
import { BouncingDots } from "@/components/ui";
import { t } from "@/lib/i18n";
import { searchQuery } from "@/signals/chat";

interface MessageContentProps {
  content: string;
  isStreaming?: boolean;
}

/**
 * Highlight search matches in text nodes (not in code blocks)
 */
function highlightSearchMatches(container: HTMLElement, query: string) {
  if (!query) return;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      // Skip text inside code blocks and pre tags
      const parent = node.parentElement;
      if (parent?.closest("pre, code")) {
        return NodeFilter.FILTER_REJECT;
      }
      // Skip if already inside a mark tag
      if (parent?.tagName === "MARK") {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }

  const lowerQuery = query.toLowerCase();

  for (const textNode of textNodes) {
    const text = textNode.textContent || "";
    const lowerText = text.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);

    if (index >= 0) {
      const before = text.slice(0, index);
      const match = text.slice(index, index + query.length);
      const after = text.slice(index + query.length);

      const fragment = document.createDocumentFragment();
      if (before) fragment.appendChild(document.createTextNode(before));

      const mark = document.createElement("mark");
      mark.className = "bg-yellow-200 dark:bg-yellow-800 rounded px-0.5";
      mark.textContent = match;
      fragment.appendChild(mark);

      if (after) fragment.appendChild(document.createTextNode(after));

      textNode.replaceWith(fragment);
    }
  }
}

export function MessageContent({ content, isStreaming = false }: MessageContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Render markdown - NO useMemo to ensure updates always render
  // useMemo was potentially causing stale renders during rapid streaming
  const html = content ? renderMarkdown(content) : "";

  // Get current search query (access .value for reactivity)
  const query = searchQuery.value.trim();

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

  // Highlight search matches
  useEffect(() => {
    if (!containerRef.current || !query) return;

    // Need to re-render the markdown first (remove old highlights)
    containerRef.current.innerHTML = html;

    // Then apply highlighting
    highlightSearchMatches(containerRef.current, query);
  }, [html, query]);

  if (!content && isStreaming) {
    return (
      <span class="inline-flex items-center gap-2 text-[var(--color-text-muted)]">
        {t("chat.thinking")}
        <BouncingDots />
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
