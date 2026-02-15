/**
 * Memory tool blocks (memory_get, memory_search results)
 */

import { t } from "@/lib/i18n";
import { parseResult } from "./utils";
import { CodeBlock } from "./CodeBlock";
import { ToolInputContainer, ToolBadge } from "./shared";

// ============================================
// Memory Get Input Block
// ============================================

interface MemoryGetInputBlockProps {
  args: Record<string, unknown>;
}

export function MemoryGetInputBlock({ args }: MemoryGetInputBlockProps) {
  const path = args.path as string;
  const from = args.from as number | undefined;
  const lines = args.lines as number | undefined;

  const lineRange = from && lines ? `${from}-${from + lines - 1}` : from ? `${from}+` : undefined;

  return (
    <ToolInputContainer inline>
      <span class="sr-only">{t("toolInput.memoryPath")}: </span>
      <span>
        📄 {path}
        {lineRange && <span class="text-[var(--color-text-muted)]">:{lineRange}</span>}
      </span>
      {lines && <ToolBadge>{t("toolOutput.lines", { count: lines })}</ToolBadge>}
    </ToolInputContainer>
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

export function MemorySearchResultBlock({ result }: { result: unknown }) {
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
// Memory Get Result Block
// ============================================

interface MemoryGetResult {
  path?: string;
  text?: string;
  from?: number;
  lines?: number;
}

export function MemoryGetResultBlock({ result }: { result: unknown }) {
  const data = parseResult<MemoryGetResult>(result);

  if (!data?.text) {
    return <CodeBlock content={result} maxLines={20} />;
  }

  // Just show the content - path/lines already shown in input
  return <CodeBlock content={data.text} filePath={data.path} maxLines={30} />;
}
