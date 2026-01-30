/**
 * StatusView
 *
 * Gateway status dashboard view.
 * TODO: Phase 3.1 implementation
 */

import { t } from "@/lib/i18n";
import { isConnected, gatewayVersion } from "@/lib/gateway";

export function StatusView() {
  return (
    <div class="flex-1 flex flex-col overflow-hidden">
      <div class="p-6 border-b border-[var(--color-border)]">
        <h1 class="text-xl font-semibold">{t("nav.status")}</h1>
      </div>

      <div class="flex-1 overflow-y-auto p-6">
        <div class="max-w-2xl mx-auto space-y-6">
          {/* Connection Status Card */}
          <div class="p-4 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border)]">
            <h2 class="text-sm font-medium text-[var(--color-text-muted)] mb-3">
              Gateway Connection
            </h2>
            <div class="flex items-center gap-3">
              <div
                class={`w-3 h-3 rounded-full ${
                  isConnected.value ? "bg-[var(--color-success)]" : "bg-[var(--color-error)]"
                }`}
              />
              <div>
                <div class="font-medium">
                  {isConnected.value ? t("status.connected") : t("status.disconnected")}
                </div>
                {gatewayVersion.value && (
                  <div class="text-sm text-[var(--color-text-muted)]">
                    Version {gatewayVersion.value}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Placeholder for more status info */}
          <div class="p-4 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border)]">
            <h2 class="text-sm font-medium text-[var(--color-text-muted)] mb-3">
              More Status Info
            </h2>
            <p class="text-[var(--color-text-muted)] text-sm">
              Full status dashboard coming in Phase 3.1
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
