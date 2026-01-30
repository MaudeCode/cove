/**
 * ConfigView
 *
 * Configuration editor view.
 * TODO: Phase 3.3 implementation
 */

import { t } from "@/lib/i18n";
import { Card } from "@/components/ui";

export function ConfigView() {
  return (
    <div class="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div class="p-6 border-b border-[var(--color-border)]">
        <h1 class="text-xl font-semibold">{t("config.title")}</h1>
      </div>

      {/* Content */}
      <div class="flex-1 flex items-center justify-center p-8">
        <Card padding="lg" class="text-center max-w-sm">
          <div class="text-5xl mb-4">⚙️</div>
          <h2 class="text-lg font-medium mb-2">{t("config.title")}</h2>
          <p class="text-[var(--color-text-muted)]">Configuration editor coming in Phase 3.3</p>
        </Card>
      </div>
    </div>
  );
}
