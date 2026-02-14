import DOMPurify, { type Config } from "dompurify";

/**
 * Configuration for DOMPurify sanitization
 * Allows safe HTML elements commonly used in markdown rendering
 */
const SANITIZE_CONFIG: Config = {
  // Allow common HTML elements used in markdown
  ALLOWED_TAGS: [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "br",
    "hr",
    "ul",
    "ol",
    "li",
    "dl",
    "dt",
    "dd",
    "strong",
    "em",
    "b",
    "i",
    "u",
    "s",
    "strike",
    "del",
    "ins",
    "sub",
    "sup",
    "small",
    "mark",
    "abbr",
    "code",
    "pre",
    "kbd",
    "samp",
    "var",
    "blockquote",
    "q",
    "cite",
    "a",
    "img",
    "figure",
    "figcaption",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
    "caption",
    "colgroup",
    "col",
    "div",
    "span",
    "details",
    "summary",
  ],
  // Allow safe attributes
  ALLOWED_ATTR: [
    "href",
    "src",
    "alt",
    "title",
    "class",
    "id",
    "name",
    "target",
    "rel",
    "width",
    "height",
    "colspan",
    "rowspan",
    "scope",
    "start",
    "type",
    "open",
    "aria-label",
    "aria-hidden",
    "aria-describedby",
    "role",
    "tabindex",
    "data-line",
    "data-language",
  ],
  // Ensure links open safely
  ADD_ATTR: ["target", "rel"],
  // Force all links to have safe attributes
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
  // Allow data URIs for images (base64 encoded)
  ALLOW_DATA_ATTR: false,
  ADD_DATA_URI_TAGS: ["img"],
  // Use safe URI schemes
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
};

/**
 * Sanitize HTML content to prevent XSS attacks
 * Use this for all user-generated or external HTML content
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ...SANITIZE_CONFIG,
    RETURN_TRUSTED_TYPE: false,
  }) as string;
}

/**
 * Sanitize HTML for code/JSON display with Prism highlighting
 * More restrictive - only allows code-related elements
 */
export function sanitizeCodeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ["span", "code", "pre", "br"],
    ALLOWED_ATTR: ["class"],
    FORBID_TAGS: ["script", "style"],
    FORBID_ATTR: ["onerror", "onload", "onclick"],
    RETURN_TRUSTED_TYPE: false,
  }) as string;
}
