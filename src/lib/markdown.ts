/**
 * Markdown Renderer
 *
 * Configured marked instance with Prism syntax highlighting.
 */

import { Marked } from "marked";
import Prism from "prismjs";

// Import common languages
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

/**
 * Language aliases
 */
const languageAliases: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  rb: "ruby",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  dockerfile: "docker",
  "": "plaintext",
};

/**
 * Resolve language alias to Prism language
 */
function resolveLanguage(lang: string): string {
  const normalized = lang.toLowerCase().trim();
  return languageAliases[normalized] || normalized;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Highlight code with Prism
 */
function highlightCode(code: string, lang: string): string {
  const language = resolveLanguage(lang);

  if (Prism.languages[language]) {
    try {
      return Prism.highlight(code, Prism.languages[language], language);
    } catch {
      // Fall through to plain text
    }
  }

  // Return escaped HTML for unknown languages
  return escapeHtml(code);
}

/**
 * Create configured marked instance
 */
function createMarkdownRenderer(): Marked {
  const marked = new Marked({
    gfm: true, // GitHub Flavored Markdown
    breaks: true, // Convert \n to <br>
  });

  // Custom renderer for code blocks and links
  marked.use({
    renderer: {
      code(token) {
        const lang = token.lang || "";
        const code = token.text;
        const highlighted = highlightCode(code, lang);
        const langClass = lang ? ` language-${resolveLanguage(lang)}` : "";
        return `<pre class="code-block${langClass}"><code>${highlighted}</code></pre>`;
      },
      link(token) {
        const href = token.href;
        const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
        const text = token.text;

        // External links open in new tab
        if (href.startsWith("http://") || href.startsWith("https://")) {
          return `<a href="${escapeHtml(href)}"${title} target="_blank" rel="noopener noreferrer">${text}</a>`;
        }

        return `<a href="${escapeHtml(href)}"${title}>${text}</a>`;
      },
    },
  });

  return marked;
}

// Singleton instance
const marked = createMarkdownRenderer();

/**
 * Render markdown to HTML
 */
export function renderMarkdown(content: string): string {
  return marked.parse(content) as string;
}

/**
 * Render inline markdown (no block elements)
 */
export function renderInlineMarkdown(content: string): string {
  return marked.parseInline(content) as string;
}
