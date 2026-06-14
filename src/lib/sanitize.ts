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

const CODE_SANITIZE_CONFIG: Config = {
  ALLOWED_TAGS: ["span", "code", "pre", "br"],
  ALLOWED_ATTR: ["class"],
  FORBID_TAGS: ["script", "style"],
  FORBID_ATTR: ["onerror", "onload", "onclick"],
  RETURN_TRUSTED_TYPE: false,
};

interface FallbackConfig {
  allowedAttrs: Set<string>;
  allowedTags: Set<string>;
  allowedUriRegexp?: RegExp;
  forbidAttrs: Set<string>;
  forbidTags: Set<string>;
}

const HTML_FALLBACK_CONFIG = createFallbackConfig(SANITIZE_CONFIG);
const CODE_FALLBACK_CONFIG = createFallbackConfig(CODE_SANITIZE_CONFIG);

/**
 * Sanitize HTML content to prevent XSS attacks
 * Use this for all user-generated or external HTML content
 */
export function sanitizeHtml(dirty: string): string {
  const clean = DOMPurify.sanitize(dirty, {
    ...SANITIZE_CONFIG,
    RETURN_TRUSTED_TYPE: false,
  }) as string;
  return enforceSanitizeFallback(clean, HTML_FALLBACK_CONFIG);
}

/**
 * Sanitize HTML for code/JSON display with Prism highlighting
 * More restrictive - only allows code-related elements
 */
export function sanitizeCodeHtml(dirty: string): string {
  const clean = DOMPurify.sanitize(dirty, CODE_SANITIZE_CONFIG) as string;
  return enforceSanitizeFallback(clean, CODE_FALLBACK_CONFIG);
}

function createFallbackConfig(config: Config): FallbackConfig {
  return {
    allowedAttrs: new Set(config.ALLOWED_ATTR as string[]),
    allowedTags: new Set(config.ALLOWED_TAGS as string[]),
    allowedUriRegexp: config.ALLOWED_URI_REGEXP,
    forbidAttrs: new Set(config.FORBID_ATTR as string[]),
    forbidTags: new Set(config.FORBID_TAGS as string[]),
  };
}

function enforceSanitizeFallback(html: string, config: FallbackConfig): string {
  const template = document.createElement("template");
  template.innerHTML = html;

  for (const element of Array.from(template.content.querySelectorAll("*"))) {
    const tagName = element.tagName.toLowerCase();
    if (config.forbidTags.has(tagName)) {
      element.remove();
      continue;
    }
    if (!config.allowedTags.has(tagName)) {
      element.replaceWith(...Array.from(element.childNodes));
      continue;
    }

    for (const attr of Array.from(element.attributes)) {
      const attrName = attr.name.toLowerCase();
      if (
        config.forbidAttrs.has(attrName) ||
        attrName.startsWith("on") ||
        !config.allowedAttrs.has(attrName) ||
        !isAllowedUriAttribute(attrName, attr.value, config.allowedUriRegexp)
      ) {
        element.removeAttribute(attr.name);
      }
    }
  }

  return template.innerHTML;
}

function isAllowedUriAttribute(name: string, value: string, allowedUriRegexp?: RegExp): boolean {
  if (name !== "href" && name !== "src") return true;
  if (!allowedUriRegexp) return true;
  return allowedUriRegexp.test(stripUnsafeUriChars(value));
}

function stripUnsafeUriChars(value: string): string {
  let stripped = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 31 || code === 127 || /\s/.test(char)) continue;
    stripped += char;
  }
  return stripped;
}
