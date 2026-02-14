/**
 * GatewayInfoCard
 *
 * Displays gateway connection info, version, and uptime.
 */

import { t } from "@/lib/i18n";
import {
  gatewayVersion,
  gatewayHost,
  gatewayUptime,
  gatewayConfigPath,
  gatewayStateDir,
} from "@/lib/gateway";
import { formatVersion } from "@/lib/session-utils";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Server, Clock, Activity, FileText, FolderOpen } from "lucide-preact";
import { formatUptime } from "@/types/server-stats";
import type { HealthSummary } from "@/types/server-stats";

interface GatewayInfoCardProps {
  healthData: HealthSummary | null;
}

export function GatewayInfoCard({ healthData }: GatewayInfoCardProps) {
  const uptime = gatewayUptime.value;

  return (
    <Card padding="md">
      <div class="flex items-center gap-3 mb-4">
        <div class="p-2 rounded-lg bg-[var(--color-accent)]/10">
          <Server class="w-5 h-5 text-[var(--color-accent)]" />
        </div>
        <div>
          <h3 class="font-semibold">{t("common.gateway")}</h3>
          <p class="text-sm text-[var(--color-text-muted)]">
            {gatewayHost.value || t("usage.gateway.unknown")}
          </p>
        </div>
        {gatewayVersion.value && (
          <Badge variant="default" size="sm" class="ml-auto">
            {formatVersion(gatewayVersion.value)}
          </Badge>
        )}
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="flex items-center gap-2">
          <Clock class="w-4 h-4 text-[var(--color-text-muted)]" />
          <div>
            <div class="text-sm text-[var(--color-text-muted)]">{t("common.uptime")}</div>
            <div class="font-medium">{uptime != null ? formatUptime(uptime) : "-"}</div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Activity class="w-4 h-4 text-[var(--color-text-muted)]" />
          <div>
            <div class="text-sm text-[var(--color-text-muted)]">{t("common.sessions")}</div>
            <div class="font-medium">{healthData?.sessions?.count ?? "-"}</div>
          </div>
        </div>
      </div>

      {(gatewayConfigPath.value || gatewayStateDir.value) && (
        <div class="mt-4 pt-4 border-t border-[var(--color-border)] space-y-2">
          {gatewayConfigPath.value && (
            <div class="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <FileText class="w-3.5 h-3.5" />
              <span class="truncate font-mono">{gatewayConfigPath.value}</span>
            </div>
          )}
          {gatewayStateDir.value && (
            <div class="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <FolderOpen class="w-3.5 h-3.5" />
              <span class="truncate font-mono">{gatewayStateDir.value}</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
