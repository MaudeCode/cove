import { t } from "@/lib/i18n";
import { BouncingText } from "../ui/BouncingText";

export function ThinkingStatus() {
  const label = t("chat.thinking");

  return (
    <span
      role="status"
      aria-label={label}
      class="inline-flex min-w-0 max-w-full items-center text-[var(--color-text-muted)]"
    >
      <BouncingText class="truncate" text={label} />
    </span>
  );
}
