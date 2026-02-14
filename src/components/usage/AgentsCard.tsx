/**
 * AgentsCard
 *
 * Displays configured agents with session counts and heartbeat status.
 */

import { t } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Cpu, Zap } from "lucide-preact";
import type { HealthSummary } from "@/types/server-stats";

interface AgentsCardProps {
  healthData: HealthSummary | null;
}

export function AgentsCard({ healthData }: AgentsCardProps) {
  if (!healthData?.agents || healthData.agents.length === 0) {
    return null;
  }

  return (
    <Card padding="md">
      <div class="flex items-center gap-3 mb-4">
        <div class="p-2 rounded-lg bg-[var(--color-warning)]/10">
          <Cpu class="w-5 h-5 text-[var(--color-warning)]" />
        </div>
        <h3 class="font-semibold">{t("common.agents")}</h3>
      </div>

      <div class="space-y-3">
        {healthData.agents.map((agent) => (
          <div
            key={agent.agentId}
            class="flex items-center justify-between py-2 px-3 bg-[var(--color-bg-secondary)] rounded-lg"
          >
            <div class="flex items-center gap-2">
              <span class="font-medium">{agent.name || agent.agentId}</span>
              {agent.isDefault && (
                <Badge variant="success" size="sm">
                  {t("common.default")}
                </Badge>
              )}
            </div>
            <div class="flex items-center gap-4 text-sm text-[var(--color-text-muted)]">
              <span>
                {agent.sessions.count} {t("usage.agents.sessions")}
              </span>
              {agent.heartbeat.enabled && (
                <span class="flex items-center gap-1">
                  <Zap class="w-3.5 h-3.5" />
                  {agent.heartbeat.every}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
