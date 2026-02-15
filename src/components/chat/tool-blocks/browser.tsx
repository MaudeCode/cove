/**
 * Browser tool blocks
 */

import { t } from "@/lib/i18n";
import { parseResult } from "./utils";
import { CodeBlock } from "./CodeBlock";
import { ToolInputContainer, ToolBadge, ToolOutputContainer } from "./shared";

// ============================================
// Input Block
// ============================================

interface BrowserInputBlockProps {
  args: Record<string, unknown>;
}

export function BrowserInputBlock({ args }: BrowserInputBlockProps) {
  const action = args.action as string;
  const profile = args.profile as string | undefined;
  const url = (args.targetUrl ?? args.url) as string | undefined;

  return (
    <ToolInputContainer inline>
      <span class="sr-only">{t("toolInput.browserAction")}: </span>
      <span>🌐 {action}</span>
      {profile && <ToolBadge>{profile}</ToolBadge>}
      {url && <span class="text-[var(--color-accent)] truncate">{url}</span>}
    </ToolInputContainer>
  );
}

// ============================================
// Result Block
// ============================================

interface BrowserTab {
  targetId?: string;
  title?: string;
  url?: string;
  type?: string;
}

interface BrowserTabsResult {
  tabs?: BrowserTab[];
}

export function BrowserResultBlock({ result }: { result: unknown }) {
  // Handle string result (snapshot output with EXTERNAL markers)
  if (typeof result === "string") {
    const cleaned = result
      .replace(/<<<EXTERNAL_UNTRUSTED_CONTENT>>>\nSource: Browser\n---\n?/g, "")
      .replace(/\n?<<<END_EXTERNAL_UNTRUSTED_CONTENT>>>/g, "")
      .trim();

    // Try to parse as JSON (tabs response wrapped in markers)
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed?.tabs) {
        return <BrowserTabsList tabs={parsed.tabs} />;
      }
    } catch {
      // Not JSON, show as content
    }

    if (!cleaned) {
      return <ToolOutputContainer>{t("toolOutput.emptyResponse")}</ToolOutputContainer>;
    }

    return <CodeBlock content={cleaned} maxLines={30} />;
  }

  // Handle object result
  const data = parseResult<BrowserTabsResult>(result);
  if (data?.tabs) {
    return <BrowserTabsList tabs={data.tabs} />;
  }

  return <CodeBlock content={result} maxLines={20} />;
}

function BrowserTabsList({ tabs }: { tabs: BrowserTab[] }) {
  if (tabs.length === 0) {
    return <ToolOutputContainer>{t("toolOutput.noTabsOpen")}</ToolOutputContainer>;
  }

  return (
    <div class="space-y-1">
      {tabs.map((tab, i) => (
        <div
          key={tab.targetId ?? i}
          class="flex items-center gap-2 text-xs p-2 rounded-md bg-[var(--color-bg-tertiary)]"
        >
          <span class="text-[var(--color-text-muted)]">🌐</span>
          <span class="font-medium text-[var(--color-text-primary)] truncate">
            {tab.title || "Untitled"}
          </span>
          {tab.url && tab.url !== "about:blank" && (
            <span class="text-[var(--color-accent)] truncate text-[10px]">{tab.url}</span>
          )}
        </div>
      ))}
    </div>
  );
}
