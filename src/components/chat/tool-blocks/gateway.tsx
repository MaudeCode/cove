/**
 * Gateway tool blocks
 */

import { t, formatDuration } from "@/lib/i18n";
import { parseResult } from "./utils";
import { ToolInputContainer, ResultCard, ResultGrid, ResultGridRow } from "./shared";
import { CodeBlock } from "./CodeBlock";

// ============================================
// Types
// ============================================

interface UpdateRunResult {
  ok: boolean;
  result?: {
    ok: boolean;
    result?: {
      status: string;
      mode: string;
      before?: { version: string };
      after?: { version: string };
      durationMs?: number;
      steps?: Array<{
        name: string;
        command?: string;
        durationMs?: number;
        exitCode?: number;
      }>;
    };
    restart?: {
      ok: boolean;
      reason?: string;
    };
  };
}

// ============================================
// Input Block
// ============================================

interface GatewayInputBlockProps {
  args: Record<string, unknown>;
}

export function GatewayInputBlock({ args }: GatewayInputBlockProps) {
  const action = args.action as string | undefined;

  if (action === "update.run") {
    const note = args.note as string | undefined;
    return (
      <ToolInputContainer inline>
        <span>🔄</span>
        <span class="text-[var(--color-text-primary)]">{t("gateway.updateRun")}</span>
        {note && <span class="text-[var(--color-text-muted)]">— {note}</span>}
      </ToolInputContainer>
    );
  }

  // Fallback for other gateway actions
  return (
    <ToolInputContainer>
      <span class="text-[var(--color-text-muted)]">gateway</span>{" "}
      <span class="text-[var(--color-text-primary)]">{action || "unknown"}</span>
    </ToolInputContainer>
  );
}

// ============================================
// Result Block
// ============================================

export function GatewayResultBlock({ result }: { result: unknown }) {
  const parsed = parseResult<UpdateRunResult>(result);

  // Check if this is an update.run result
  const updateResult = parsed?.result?.result;
  if (updateResult?.before?.version || updateResult?.after?.version) {
    const before = updateResult.before?.version;
    const after = updateResult.after?.version;
    const mode = updateResult.mode;
    const duration = updateResult.durationMs;
    const restart = parsed?.result?.restart;

    const header = (
      <span class="font-medium text-[var(--color-text-primary)]">
        {t("gateway.updateComplete")}
      </span>
    );

    return (
      <ResultCard header={header} success={updateResult.status === "ok"}>
        <ResultGrid>
          {before && after && (
            <ResultGridRow label={t("gateway.version")}>
              <span class="text-[var(--color-text-muted)]">{before}</span>
              <span class="mx-1.5">→</span>
              <span class="text-[var(--color-success)] font-medium">{after}</span>
            </ResultGridRow>
          )}
          {mode && <ResultGridRow label={t("gateway.mode")}>{mode}</ResultGridRow>}
          {duration && (
            <ResultGridRow label={t("gateway.duration")}>{formatDuration(duration)}</ResultGridRow>
          )}
          {restart && (
            <ResultGridRow label={t("gateway.restart")}>
              {restart.ok ? (
                <span class="text-[var(--color-success)]">{t("gateway.restartOk")}</span>
              ) : (
                <span class="text-[var(--color-error)]">{t("gateway.restartFailed")}</span>
              )}
            </ResultGridRow>
          )}
        </ResultGrid>
      </ResultCard>
    );
  }

  // Fallback to code block for other gateway results
  return <CodeBlock content={result} maxLines={15} />;
}
