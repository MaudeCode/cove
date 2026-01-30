/**
 * CronView
 *
 * Cron job management view.
 * TODO: Phase 3.2 implementation
 */

import { t } from "@/lib/i18n";

export function CronView() {
  return (
    <div class="flex-1 flex flex-col overflow-hidden">
      <div class="p-6 border-b border-[var(--color-border)]">
        <h1 class="text-xl font-semibold">{t("cron.title")}</h1>
      </div>

      <div class="flex-1 flex items-center justify-center p-8">
        <div class="text-center">
          <div class="text-5xl mb-4">⏰</div>
          <h2 class="text-lg font-medium mb-2">{t("cron.title")}</h2>
          <p class="text-[var(--color-text-muted)]">Cron job management coming in Phase 3.2</p>
        </div>
      </div>
    </div>
  );
}
