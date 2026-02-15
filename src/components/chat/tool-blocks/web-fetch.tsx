/**
 * Web fetch tool blocks
 */

import { t } from "@/lib/i18n";
import { parseResult } from "./utils";
import { CodeBlock } from "./CodeBlock";
import { ToolInputContainer } from "./shared";

// ============================================
// Input Block
// ============================================

interface UrlInputBlockProps {
  args: Record<string, unknown>;
}

export function UrlInputBlock({ args }: UrlInputBlockProps) {
  const url = args.url as string;

  return (
    <ToolInputContainer>
      <span class="sr-only">{t("common.url")}: </span>🌐 {url}
    </ToolInputContainer>
  );
}

// ============================================
// Result Block
// ============================================

interface WebFetchResult {
  url?: string;
  text?: string;
  title?: string;
  status?: number;
}

export function WebFetchResultBlock({ result }: { result: unknown }) {
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
