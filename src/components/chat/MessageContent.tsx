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

/** CSS classes for search highlight marks */
const SEARCH_HIGHLIGHT_CLASS = "bg-[var(--color-warning-muted)] rounded px-0.5";

/**
 * Highlight ALL search matches in text nodes (not in code blocks)
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

    // Find ALL matches in this text node
    const matches: Array<{ start: number; end: number }> = [];
    let searchStart = 0;
    let index: number;

    while ((index = lowerText.indexOf(lowerQuery, searchStart)) !== -1) {
      matches.push({ start: index, end: index + query.length });
      searchStart = index + 1; // Move past this match to find overlapping matches
    }

    if (matches.length === 0) continue;

    // Build fragment with all matches highlighted
    const fragment = document.createDocumentFragment();
    let lastEnd = 0;

    for (const match of matches) {
      // Add text before this match
      if (match.start > lastEnd) {
        fragment.appendChild(document.createTextNode(text.slice(lastEnd, match.start)));
      }

      // Add highlighted match
      const mark = document.createElement("mark");
      mark.className = SEARCH_HIGHLIGHT_CLASS;
      mark.textContent = text.slice(match.start, match.end);
      fragment.appendChild(mark);

      lastEnd = match.end;
    }

    // Add remaining text after last match
    if (lastEnd < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastEnd)));
    }

    textNode.replaceWith(fragment);
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
