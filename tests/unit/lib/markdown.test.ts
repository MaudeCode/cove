import { describe, expect, test } from "bun:test";
import { renderMarkdown } from "../../../src/lib/markdown";

describe("markdown renderer", () => {
  test("flattens remote images while preserving data images", () => {
    const remote = renderMarkdown("![pixel](https://example.test/pixel.png)");
    expect(remote).not.toContain("<img");
    expect(remote).toContain('href="https://example.test/pixel.png"');
    expect(remote).toContain('target="_blank"');
    expect(remote).toContain('rel="noopener noreferrer"');
    expect(remote).toContain("[pixel]");

    const data = renderMarkdown("![inline <alt>](data:image/png;base64,abc)");
    expect(data).toContain("<img");
    expect(data).toContain('src="data:image/png;base64,abc"');
    expect(data).toContain('alt="inline &lt;alt&gt;"');
  });

  test("escapes raw HTML and adds safe external link attributes", () => {
    const html = renderMarkdown(
      ['<img src="x" onerror="alert(1)">', "<script>alert(1)</script>"].join("\n"),
    );
    expect(html).toContain("&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");

    const links = renderMarkdown(
      ['[external](https://example.test/path "title")', "[relative](/docs)"].join("\n"),
    );
    expect(links).toContain('href="https://example.test/path"');
    expect(links).toContain('title="title"');
    expect(links).toContain('target="_blank"');
    expect(links).toContain('rel="noopener noreferrer"');
    expect(links).toContain('href="/docs"');
  });

  test("resolves code aliases, highlights Prism languages, and escapes unknown code", () => {
    const highlighted = renderMarkdown("```ts\nconst value: number = 1;\n```");
    expect(highlighted).toContain('class="code-block language-typescript"');
    expect(highlighted).toContain('class="token keyword"');
    expect(highlighted).toContain("value");

    const shell = renderMarkdown("```zsh\necho '<safe>'\n```");
    expect(shell).toContain('class="code-block language-bash"');
    expect(shell).toContain("&lt;safe>");

    const unknown = renderMarkdown("```madeup\n<script>alert(1)</script>\n```");
    expect(unknown).toContain('class="code-block language-madeup"');
    expect(unknown).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(unknown).not.toContain("<script>");
  });
});
