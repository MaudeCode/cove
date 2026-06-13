import "../../helpers/dom-environment";
import { describe, expect, test } from "bun:test";
import { sanitizeCodeHtml, sanitizeHtml } from "../../../src/lib/sanitize";

describe("sanitizeHtml", () => {
  test("strips executable tags, event handlers, and javascript URLs", () => {
    const clean = sanitizeHtml(
      [
        "<script>alert(1)</script>",
        "<style>body{display:none}</style>",
        '<iframe src="https://example.test"></iframe>',
        '<form><input name="token"><button>send</button></form>',
        '<img src="x" onerror="alert(1)">',
        '<a href="JaVaScRiPt:alert(1)" onclick="steal()">bad</a>',
        '<a href="java\nscript:alert(1)">newline</a>',
      ].join(""),
    );

    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("<style");
    expect(clean).not.toContain("<iframe");
    expect(clean).not.toContain("<form");
    expect(clean).not.toContain("<input");
    expect(clean).not.toContain("<button");
    expect(clean).not.toContain("onerror");
    expect(clean).not.toContain("onclick");
    expect(clean.toLowerCase()).not.toContain("javascript:");
    const template = document.createElement("template");
    template.innerHTML = clean;
    for (const link of Array.from(template.content.querySelectorAll("a"))) {
      expect(link.getAttribute("href")).toBeNull();
    }
    expect(clean).toContain("<img");
    expect(clean).toContain(">bad</a>");
  });

  test("preserves safe markdown output and Prism token spans", () => {
    const clean = sanitizeHtml(
      [
        '<pre class="code-block language-ts"><code><span class="token keyword">const</span> x = 1</code></pre>',
        '<a href="https://example.test" target="_blank" rel="noopener noreferrer">link</a>',
        "<details open><summary>More</summary><table><tbody><tr><td>cell</td></tr></tbody></table></details>",
      ].join(""),
    );

    expect(clean).toContain('class="code-block language-ts"');
    expect(clean).toContain('class="token keyword"');
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('rel="noopener noreferrer"');
    expect(clean).toContain("<details open");
    expect(clean).toContain("<table>");
  });
});

describe("sanitizeCodeHtml", () => {
  test("keeps Prism code spans while stripping non-code elements and attributes", () => {
    const clean = sanitizeCodeHtml(
      [
        '<pre id="bad"><code><span class="token string" data-x="1">"ok"</span></code></pre>',
        '<a href="https://example.test">link</a>',
        '<img src="x" onerror="alert(1)">',
        "<script>alert(1)</script>",
      ].join(""),
    );

    expect(clean).toContain("<pre>");
    expect(clean).toContain("<code>");
    expect(clean).toContain('<span class="token string">"ok"</span>');
    expect(clean).not.toContain("<a");
    expect(clean).not.toContain("<img");
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("id=");
    expect(clean).not.toContain("data-x");
    expect(clean).not.toContain("onerror");
  });
});
