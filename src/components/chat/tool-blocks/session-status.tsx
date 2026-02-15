/**
 * Session status tool blocks
 */

import { t } from "@/lib/i18n";
import { CodeBlock } from "./CodeBlock";
import { ToolInputContainer, ToolBadge } from "./shared";

// ============================================
// Input Block
// ============================================

interface SessionStatusInputBlockProps {
  args: Record<string, unknown>;
}

export function SessionStatusInputBlock({ args }: SessionStatusInputBlockProps) {
  const sessionKey = args.sessionKey as string | undefined;
  const model = args.model as string | undefined;

  // No args = current session status (common case)
  if (!sessionKey && !model) {
    return (
      <ToolInputContainer>
        <span class="sr-only">{t("toolInput.sessionStatus")}: </span>
        <span>📊 {t("sessionStatus.currentSession")}</span>
      </ToolInputContainer>
    );
  }

  return (
    <ToolInputContainer inline>
      <span class="sr-only">{t("toolInput.sessionStatus")}: </span>
      <span>📊</span>
      {sessionKey && <ToolBadge title={sessionKey}>🧵 {formatSessionKey(sessionKey)}</ToolBadge>}
      {model && <ToolBadge>🧠 {model}</ToolBadge>}
    </ToolInputContainer>
  );
}

/** Format session key for display (truncate middle if long) */
function formatSessionKey(key: string): string {
  if (key.length <= 30) return key;
  return key.slice(0, 15) + "…" + key.slice(-12);
}

// ============================================
// Result Block
// ============================================

interface StatusLine {
  emoji: string;
  label: string;
  value: string;
}

function parseStatusLines(text: string): StatusLine[] {
  const lines = text.trim().split("\n");
  const result: StatusLine[] = [];

  for (const line of lines) {
    // Match emoji at start, then content
    const match = line.match(/^(\p{Emoji}+)\s*(.+)$/u);
    if (match) {
      const content = match[2];
      // Split on first colon for label:value
      const colonIdx = content.indexOf(":");
      if (colonIdx > 0) {
        result.push({
          emoji: match[1],
          label: content.slice(0, colonIdx).trim(),
          value: content.slice(colonIdx + 1).trim(),
        });
      } else {
        result.push({
          emoji: match[1],
          label: "",
          value: content.trim(),
        });
      }
    }
  }

  return result;
}

function extractPercentage(text: string): number | null {
  const match = text.match(/(\d+)%/);
  return match ? parseInt(match[1], 10) : null;
}

function ProgressBar({
  percent,
  color,
  label,
}: {
  percent: number;
  color?: string;
  label?: string;
}) {
  const barColor =
    color ||
    (percent > 66
      ? "var(--color-success)"
      : percent > 33
        ? "var(--color-warning)"
        : "var(--color-error)");

  return (
    <div class="flex items-center gap-2 mt-1.5">
      <div
        class="h-2 w-28 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          class="h-full rounded-full transition-all"
          style={{ width: `${percent}%`, backgroundColor: barColor }}
        />
      </div>
      {label && <span class="text-[var(--color-text-muted)] text-xs">{label}</span>}
    </div>
  );
}

export function SessionStatusResultBlock({ result }: { result: unknown }) {
  const text = typeof result === "string" ? result : String(result);
  const lines = parseStatusLines(text);

  if (lines.length === 0) {
    return <CodeBlock content={result} maxLines={20} />;
  }

  return (
    <div class="rounded-md bg-[var(--color-bg-tertiary)] overflow-hidden">
      {lines.map((line, i) => {
        const contextPercent = line.label === "Context" ? extractPercentage(line.value) : null;
        const usagePercent = line.label === "Usage" ? extractPercentage(line.value) : null;

        return (
          <div
            key={i}
            class={`flex items-start gap-3 px-3 py-2 text-sm ${i > 0 ? "border-t border-[var(--color-border)]/50" : ""}`}
          >
            <span class="flex-shrink-0 w-6 text-center text-base">{line.emoji}</span>
            {line.label && (
              <span class="font-medium text-[var(--color-text-muted)] w-20 flex-shrink-0">
                {line.label}
              </span>
            )}
            <div class="flex-1 min-w-0">
              <span class="text-[var(--color-text-primary)]">{line.value}</span>
              {contextPercent !== null && (
                <ProgressBar
                  percent={contextPercent}
                  color="var(--color-accent)"
                  label={`${contextPercent}%`}
                />
              )}
              {usagePercent !== null && (
                <ProgressBar
                  percent={usagePercent}
                  label={t("sessionStatus.remaining", { percent: usagePercent })}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
