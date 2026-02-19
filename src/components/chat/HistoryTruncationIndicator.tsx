import { Scissors } from "lucide-preact";
import { t } from "@/lib/i18n";

interface HistoryTruncationIndicatorProps {
  reason?: string;
  class?: string;
}

export function HistoryTruncationIndicator({
  reason,
  class: className,
}: HistoryTruncationIndicatorProps) {
  const title = reason
    ? t("chat.historyTruncatedHintWithReason", { reason })
    : t("chat.historyTruncatedHint");

  return (
    <span
      class={`inline-flex items-center gap-1 text-[11px] text-[var(--color-text-muted)] ${className ?? ""}`}
      title={title}
      aria-label={title}
    >
      <Scissors class="w-3 h-3" aria-hidden="true" />
      <span>{t("chat.historyTruncatedLabel")}</span>
    </span>
  );
}
