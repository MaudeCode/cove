/**
 * Result display blocks for specific tool types
 */

import { useMemo } from "preact/hooks";
import { t } from "@/lib/i18n";
import { renderMarkdown } from "@/lib/markdown";
import { parseResult, parseErrorResult, type ErrorResultShape } from "./utils";
import { CodeBlock } from "./CodeBlock";

// ============================================
// Error Result Block
// ============================================

export function ErrorResultBlock({ result }: { result: ErrorResultShape }) {
  return (
    <div class="text-xs p-3 rounded-md bg-[var(--color-error)]/10 border border-[var(--color-error)]/20">
      <div class="font-medium text-[var(--color-error)] mb-1">{t("status.error")}</div>
      <div class="text-[var(--color-text-primary)] whitespace-pre-wrap">{result.error}</div>
    </div>
  );
}

// ============================================
// Result Block (dispatcher)
// ============================================

interface ResultBlockProps {
  result: unknown;
  error?: boolean;
  toolName?: string;
  filePath?: string;
}

export function ResultBlock({ result, error, toolName, filePath }: ResultBlockProps) {
  const errorResult = parseErrorResult(result);

  if (errorResult) {
    return <ErrorResultBlock result={errorResult} />;
  }

  // Special formatting for specific tools
  if (toolName === "web_search") {
    return <WebSearchResultBlock result={result} />;
  }

  if (toolName === "web_fetch") {
    return <WebFetchResultBlock result={result} />;
  }

  if (toolName === "memory_search") {
    return <MemorySearchResultBlock result={result} />;
  }

  if (toolName === "image") {
    return <ImageResultBlock result={result} />;
  }

  return <CodeBlock content={result} maxLines={20} error={error} filePath={filePath} />;
}

// ============================================
// Web Search Result Block
// ============================================

interface WebSearchResult {
  results?: Array<{
    title?: string;
    url?: string;
    description?: string;
    siteName?: string;
  }>;
}

function WebSearchResultBlock({ result }: { result: unknown }) {
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

// ============================================
// Web Fetch Result Block
// ============================================

interface WebFetchResult {
  url?: string;
  text?: string;
  title?: string;
  status?: number;
}

function WebFetchResultBlock({ result }: { result: unknown }) {
  const data = parseResult<WebFetchResult>(result);

  if (!data?.text) {
    return <CodeBlock content={result} maxLines={20} />;
  }

  // Strip the EXTERNAL_UNTRUSTED_CONTENT wrappers
  const cleanText = data.text
    .replace(/\n?<<<EXTERNAL_UNTRUSTED_CONTENT>>>\nSource: Web Fetch\n---\n?/g, "")
    .replace(/\n?<<<END_EXTERNAL_UNTRUSTED_CONTENT>>>/g, "")
    .trim();

  return (
    <div class="space-y-2">
      <div class="text-xs p-2 rounded-md bg-[var(--color-bg-tertiary)] font-mono text-[var(--color-text-muted)]">
        {data.url} {data.status && `(${data.status})`}
      </div>
      <CodeBlock content={cleanText} maxLines={30} filePath="content.md" />
    </div>
  );
}

// ============================================
// Memory Search Result Block
// ============================================

interface MemorySearchResult {
  results?: Array<{
    path?: string;
    snippet?: string;
    score?: number;
    startLine?: number;
    endLine?: number;
  }>;
}

function MemorySearchResultBlock({ result }: { result: unknown }) {
  const data = parseResult<MemorySearchResult>(result);
  const results = data?.results;

  if (!results || !Array.isArray(results) || results.length === 0) {
    return <CodeBlock content={result} maxLines={20} />;
  }

  return (
    <div class="space-y-3">
      {results.map((r, i) => (
        <div key={i} class="space-y-1">
          <div class="flex items-center justify-between text-xs px-1">
            <div class="font-mono text-[var(--color-accent)]">
              {r.path}
              {r.startLine && r.endLine && (
                <span class="text-[var(--color-text-muted)]">
                  :{r.startLine}-{r.endLine}
                </span>
              )}
            </div>
            {r.score !== undefined && (
              <div class="text-[var(--color-text-muted)]">{(r.score * 100).toFixed(0)}%</div>
            )}
          </div>
          {r.snippet && (
            <CodeBlock
              content={r.snippet.replace(/\nSource:.*$/, "").trim()}
              filePath={r.path}
              maxLines={10}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================
// Image Result Block
// ============================================

function ImageResultBlock({ result }: { result: unknown }) {
  const text = typeof result === "string" ? result : String(result);

  // Render as markdown
  const html = useMemo(() => renderMarkdown(text), [text]);

  return (
    <div
      class="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed p-2 rounded-md bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] [&_strong]:text-[var(--color-text-primary)] [&_em]:text-[var(--color-text-secondary)]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
