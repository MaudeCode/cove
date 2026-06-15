import { t } from "@/lib/i18n";
import { TextShimmer } from "../ui/TextShimmer";
import { Brain } from "lucide-preact";

export function ThinkingStatus() {
  const label = t("chat.thinking");

  return (
    <span
      role="status"
      aria-label={label}
      class="inline-flex min-w-0 max-w-full items-center gap-2 text-[var(--color-text-muted)]"
    >
      <Brain class="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      <TextShimmer class="truncate" text={label} />
    </span>
  );
}
