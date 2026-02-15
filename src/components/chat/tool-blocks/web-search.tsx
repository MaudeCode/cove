/**
 * Web search result block
 */

import { parseResult } from "./utils";
import { CodeBlock } from "./CodeBlock";

interface WebSearchResult {
  results?: Array<{
    title?: string;
    url?: string;
    description?: string;
    siteName?: string;
  }>;
}

export function WebSearchResultBlock({ result }: { result: unknown }) {
  const data = parseResult<WebSearchResult>(result);
  const results = data?.results;

  if (!results || !Array.isArray(results) || results.length === 0) {
    return <CodeBlock content={result} maxLines={20} />;
  }

  // Strip the EXTERNAL_UNTRUSTED_CONTENT wrappers
  const cleanText = (text?: string) => {
    if (!text) return "";
    return text
      .replace(/\n?<<<EXTERNAL_UNTRUSTED_CONTENT>>>\nSource: Web Search\n---\n?/g, "")
      .replace(/\n?<<<END_EXTERNAL_UNTRUSTED_CONTENT>>>/g, "")
      .replace(/<\/?strong>/g, "")
      .trim();
  };

  return (
    <div class="space-y-2">
      {results.map((r, i) => (
        <a
          key={i}
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          class="block text-xs p-2 rounded-md bg-[var(--color-bg-tertiary)] space-y-1 border border-transparent hover:border-[var(--color-accent)]/50 transition-colors cursor-pointer no-underline"
        >
          <div class="font-medium text-[var(--color-text-primary)]">{cleanText(r.title)}</div>
          <div class="text-[var(--color-accent)] truncate">{r.url}</div>
          {r.description && (
            <div class="text-[var(--color-text-muted)]">{cleanText(r.description)}</div>
          )}
        </a>
      ))}
    </div>
  );
}
