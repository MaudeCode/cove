/**
 * Markdown Renderer
 *
 * Configured markdown-it instance with syntax highlighting.
 */

import MarkdownIt from "markdown-it";
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
 * Create configured markdown-it instance
 */
function createMarkdownRenderer(): MarkdownIt {
  const md = new MarkdownIt({
    html: false, // Disable HTML for security
    linkify: true, // Auto-link URLs
    typographer: true, // Smart quotes, etc.
    breaks: true, // Convert \n to <br>
    highlight: (code, lang) => {
      const highlighted = highlightCode(code, lang);
      const langClass = lang ? ` language-${resolveLanguage(lang)}` : "";
      return `<pre class="code-block${langClass}"><code>${highlighted}</code></pre>`;
    },
  });

  // Open links in new tab
  const defaultRender =
    md.renderer.rules.link_open ||
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const href = tokens[idx].attrGet("href");

    // External links open in new tab
    if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
      tokens[idx].attrSet("target", "_blank");
      tokens[idx].attrSet("rel", "noopener noreferrer");
    }

    return defaultRender(tokens, idx, options, env, self);
  };

  return md;
}

// Singleton instance
const md = createMarkdownRenderer();

/**
 * Render markdown to HTML
 */
export function renderMarkdown(content: string): string {
  return md.render(content);
}

/**
 * Render inline markdown (no block elements)
 */
export function renderInlineMarkdown(content: string): string {
  return md.renderInline(content);
}
