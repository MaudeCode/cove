/**
 * StatusView
 *
 * Gateway status dashboard view.
 * Route: /overview (aliased as OverviewView)
 * TODO: Phase 3.1 implementation
 */

import { t } from "@/lib/i18n";
import { isConnected, gatewayVersion } from "@/lib/gateway";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { RouteProps } from "@/types/routes";

export function StatusView(_props: RouteProps) {
  return (
    <div class="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div class="p-6 border-b border-[var(--color-border)]">
        <h1 class="text-xl font-semibold">{t("nav.status")}</h1>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-6">
        <div class="max-w-2xl mx-auto space-y-6">
          {/* Connection Status Card */}
          <Card title="Gateway Connection" padding="md">
            <div class="flex items-center gap-3">
              <Badge variant={isConnected.value ? "success" : "error"} dot size="md">
                {isConnected.value ? t("status.connected") : t("status.disconnected")}
              </Badge>
              {gatewayVersion.value && (
                <span class="text-sm text-[var(--color-text-muted)]">
                  Version {gatewayVersion.value}
                </span>
              )}
            </div>
          </Card>

          {/* Placeholder for more status info */}
          <Card
            title="More Status Info"
            subtitle="Full status dashboard coming in Phase 3.1"
            padding="md"
          >
            <div class="text-[var(--color-text-muted)] text-sm">
              <ul class="list-disc list-inside space-y-1">
                <li>Session statistics</li>
                <li>Memory usage</li>
                <li>Uptime information</li>
                <li>Plugin status</li>
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
