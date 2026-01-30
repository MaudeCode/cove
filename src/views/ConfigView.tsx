/**
 * ConfigView
 *
 * Configuration editor view.
 * TODO: Phase 3.3 implementation
 */

import { t } from "@/lib/i18n";

export function ConfigView() {
  return (
    <div class="flex-1 flex flex-col overflow-hidden">
      <div class="p-6 border-b border-[var(--color-border)]">
        <h1 class="text-xl font-semibold">{t("config.title")}</h1>
      </div>

      <div class="flex-1 flex items-center justify-center p-8">
        <div class="text-center">
          <div class="text-5xl mb-4">⚙️</div>
          <h2 class="text-lg font-medium mb-2">{t("config.title")}</h2>
          <p class="text-[var(--color-text-muted)]">Configuration editor coming in Phase 3.3</p>
        </div>
      </div>
    </div>
  );
}
