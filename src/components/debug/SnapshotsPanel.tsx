/**
 * SnapshotsPanel
 *
 * Shows status, health, and heartbeat snapshots from the gateway.
 */

import { signal } from "@preact/signals";
import { t } from "@/lib/i18n";
import { isConnected, send } from "@/lib/gateway";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Database, RefreshCw, Activity, Heart, Zap } from "lucide-preact";

// ============================================
// State
// ============================================

const statusSnapshot = signal<unknown>(null);
const healthSnapshot = signal<unknown>(null);
const heartbeatSnapshot = signal<unknown>(null);
const isLoading = signal(false);

// ============================================
// Helpers
// ============================================

function formatPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

async function fetchSnapshots() {
  if (!isConnected.value) return;

  isLoading.value = true;
  try {
    const [status, health] = await Promise.all([
      send<unknown>("status").catch(() => null),
      send<unknown>("health.check").catch(() => null),
    ]);
    statusSnapshot.value = status;
    healthSnapshot.value = health;
    heartbeatSnapshot.value = (status as Record<string, unknown>)?.heartbeat ?? null;
  } catch {
    // Ignore errors
  } finally {
    isLoading.value = false;
  }
}

// ============================================
// Component
// ============================================

export function SnapshotsPanel() {
  const connected = isConnected.value;

  return (
    <Card>
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <Database size={18} class="text-[var(--color-accent)]" />
          <h2 class="font-medium">{t("debug.snapshots")}</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchSnapshots}
          disabled={!connected || isLoading.value}
        >
          {isLoading.value ? (
            <Spinner size="sm" class="mr-1" />
          ) : (
            <RefreshCw size={14} class="mr-1" />
          )}
          {t("actions.refresh")}
        </Button>
      </div>

      <p class="text-sm text-[var(--color-text-muted)] mb-4">{t("debug.snapshotsDesc")}</p>

      <div class="space-y-4">
        {/* Status */}
        <div>
          <div class="flex items-center gap-2 mb-2">
            <Activity size={14} class="text-[var(--color-text-muted)]" />
            <span class="text-sm font-medium">{t("debug.status")}</span>
          </div>
          <pre class="text-xs font-mono bg-[var(--color-bg-tertiary)] p-3 rounded-lg overflow-x-auto max-h-48">
            {statusSnapshot.value ? formatPayload(statusSnapshot.value) : t("debug.noData")}
          </pre>
        </div>

        {/* Health */}
        <div>
          <div class="flex items-center gap-2 mb-2">
            <Heart size={14} class="text-[var(--color-text-muted)]" />
            <span class="text-sm font-medium">{t("debug.health")}</span>
          </div>
          <pre class="text-xs font-mono bg-[var(--color-bg-tertiary)] p-3 rounded-lg overflow-x-auto max-h-48">
            {healthSnapshot.value ? formatPayload(healthSnapshot.value) : t("debug.noData")}
          </pre>
        </div>

        {/* Last Heartbeat */}
        <div>
          <div class="flex items-center gap-2 mb-2">
            <Zap size={14} class="text-[var(--color-text-muted)]" />
            <span class="text-sm font-medium">{t("debug.lastHeartbeat")}</span>
          </div>
          <pre class="text-xs font-mono bg-[var(--color-bg-tertiary)] p-3 rounded-lg overflow-x-auto max-h-48">
            {heartbeatSnapshot.value ? formatPayload(heartbeatSnapshot.value) : t("debug.noData")}
          </pre>
        </div>
      </div>
    </Card>
  );
}
