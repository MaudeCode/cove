/**
 * Result block dispatcher
 *
 * Routes tool results to the appropriate specialized block based on tool name.
 */

import { t } from "@/lib/i18n";
import { parseErrorResult, type ErrorResultShape } from "./utils";
import { CodeBlock } from "./CodeBlock";
import { WebSearchResultBlock } from "./web-search";
import { WebFetchResultBlock } from "./web-fetch";
import { MemorySearchResultBlock, MemoryGetResultBlock } from "./memory";
import { ImageResultBlock } from "./image";
import { SessionStatusResultBlock } from "./session-status";
import { BrowserResultBlock } from "./browser";
import { CronResultBlock } from "./cron";
import { MessageResultBlock } from "./message";

// ============================================
// Error Result Block
// ============================================

export function ErrorResultBlock({ result }: { result: ErrorResultShape }) {
  return (
    <div class="text-xs p-3 rounded-md bg-[var(--color-error)]/10 border border-[var(--color-error)]/20">
      <div class="font-medium text-[var(--color-error)] mb-1">{t("common.error")}</div>
      <div class="text-[var(--color-text-primary)] whitespace-pre-wrap">{result.error}</div>
    </div>
  );
}

// ============================================
// Result Block Dispatcher
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

  // Route to specialized blocks based on tool name
  switch (toolName) {
    case "web_search":
      return <WebSearchResultBlock result={result} />;

    case "web_fetch":
      return <WebFetchResultBlock result={result} />;

    case "memory_search":
      return <MemorySearchResultBlock result={result} />;

    case "memory_get":
      return <MemoryGetResultBlock result={result} />;

    case "image":
      return <ImageResultBlock result={result} />;

    case "session_status":
      return <SessionStatusResultBlock result={result} />;

    case "browser":
      return <BrowserResultBlock result={result} />;

    case "cron":
      return <CronResultBlock result={result} />;

    case "message":
      return <MessageResultBlock result={result} />;

    default:
      return <CodeBlock content={result} maxLines={20} error={error} filePath={filePath} />;
  }
}
