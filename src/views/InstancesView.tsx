/**
 * InstancesView
 *
 * Connected clients/services overview (presence beacons).
 * Route: /instances
 */

import { signal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { t, formatTimestamp } from "@/lib/i18n";
import { send, isConnected } from "@/lib/gateway";
import { getErrorMessage } from "@/lib/session-utils";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { IconButton } from "@/components/ui/IconButton";
import { StatCard } from "@/components/ui/StatCard";
import { ListCard } from "@/components/ui/ListCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { RefreshCw, Monitor, Server, Smartphone, Globe, Clock } from "lucide-preact";
import { ViewErrorBoundary } from "@/components/ui/ViewErrorBoundary";
import type { SystemPresence } from "@/types/presence";
import type { RouteProps } from "@/types/routes";

// ============================================
// Local State
// ============================================

const instances = signal<SystemPresence[]>([]);
const isLoading = signal<boolean>(false);
const error = signal<string | null>(null);

// ============================================
// Helpers
// ============================================

function getDeviceIcon(presence: SystemPresence) {
  const mode = presence.mode?.toLowerCase() ?? "";
  const family = presence.deviceFamily?.toLowerCase() ?? "";

  if (mode === "gateway") return Server;
  if (family.includes("iphone") || family.includes("android")) return Smartphone;
  if (family.includes("mac") || family.includes("windows") || family.includes("linux"))
    return Monitor;
  return Globe;
}

function formatIdleTime(seconds?: number): string {
  if (seconds === undefined) return "—";
  if (seconds < 60) return t("instances.idleSeconds", { count: seconds });
  if (seconds < 3600) return t("instances.idleMinutes", { count: Math.floor(seconds / 60) });
  return t("instances.idleHours", { count: Math.floor(seconds / 3600) });
}

function getModeVariant(mode?: string): "success" | "warning" | "default" {
  if (!mode) return "default";
  if (mode === "gateway") return "success";
  if (mode === "webchat" || mode === "chat") return "warning";
  return "default";
}

// ============================================
// Actions
// ============================================

async function loadInstances(): Promise<void> {
  isLoading.value = true;
  error.value = null;

  try {
    const result = await send<SystemPresence[]>("system-presence", {});
    instances.value = result ?? [];
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    isLoading.value = false;
  }
}

// ============================================
// Components
// ============================================

function AccessBadges({ roles, scopes }: { roles?: string[]; scopes?: string[] }) {
  const all = [...(roles ?? []), ...(scopes ?? [])];
  if (all.length === 0) return null;

  return (
    <div class="flex flex-wrap items-center gap-1 mt-1">
      {all.map((item) => (
        <Badge key={item} variant="default" size="sm">
          {item}
        </Badge>
      ))}
    </div>
  );
}

/** Mobile card view for an instance */
function InstanceCard({ presence }: { presence: SystemPresence }) {
  const Icon = getDeviceIcon(presence);
  const isGateway = presence.mode === "gateway";

  return (
    <ListCard
      icon={Icon}
      iconVariant={isGateway ? "success" : "default"}
      title={presence.host || presence.instanceId || "Unknown"}
      subtitle={presence.ip}
      badges={
        presence.mode ? (
          <Badge variant={getModeVariant(presence.mode)} size="sm">
            {presence.mode}
          </Badge>
        ) : null
      }
      meta={[
        { icon: Clock, value: formatTimestamp(presence.ts, { relative: true }) },
        ...(presence.platform ? [{ value: presence.platform }] : []),
      ]}
    />
  );
}

/** Desktop table row for an instance */
function InstanceRow({ presence }: { presence: SystemPresence }) {
  const Icon = getDeviceIcon(presence);
  const isGateway = presence.mode === "gateway";

  return (
    <tr class="hover:bg-[var(--color-bg-hover)] transition-colors">
      {/* Instance */}
      <td class="py-3 px-4">
        <div class="flex items-center gap-3">
          <div
            class={`p-1.5 rounded-lg flex-shrink-0 ${
              isGateway ? "bg-[var(--color-success)]/10" : "bg-[var(--color-bg-tertiary)]"
            }`}
          >
            <Icon
              class={`w-4 h-4 ${
                isGateway ? "text-[var(--color-success)]" : "text-[var(--color-text-muted)]"
              }`}
            />
          </div>
          <div class="min-w-0">
            <div class="font-medium truncate">
              {presence.host || presence.instanceId || "Unknown"}
            </div>
            {presence.ip && <div class="text-xs text-[var(--color-text-muted)]">{presence.ip}</div>}
            <AccessBadges roles={presence.roles} scopes={presence.scopes} />
          </div>
        </div>
      </td>

      {/* Mode */}
      <td class="py-3 px-4">
        {presence.mode ? (
          <Badge variant={getModeVariant(presence.mode)} size="sm">
            {presence.mode}
          </Badge>
        ) : (
          <span class="text-[var(--color-text-muted)]">—</span>
        )}
      </td>

      {/* Platform */}
      <td class="py-3 px-4">
        <div class="text-sm">{presence.platform || "—"}</div>
        {presence.version && (
          <div class="text-xs text-[var(--color-text-muted)]">v{presence.version}</div>
        )}
      </td>

      {/* Last Seen */}
      <td class="py-3 px-4 whitespace-nowrap">
        <div class="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
          <Clock class="w-3.5 h-3.5" />
          <span>{formatTimestamp(presence.ts, { relative: true })}</span>
        </div>
      </td>

      {/* Idle - hidden until lg */}
      <td class="py-3 px-4 whitespace-nowrap text-sm text-[var(--color-text-muted)] hidden lg:table-cell">
        {formatIdleTime(presence.lastInputSeconds)}
      </td>
    </tr>
  );
}

// ============================================
// Main View
// ============================================

export function InstancesView(_props: RouteProps) {
  useEffect(() => {
    if (isConnected.value) {
      loadInstances();
    }
  }, [isConnected.value]);

  const gatewayCount = instances.value.filter((i) => i.mode === "gateway").length;
  const clientCount = instances.value.filter((i) => i.mode !== "gateway").length;

  return (
    <ViewErrorBoundary viewName={t("nav.instances")}>
      <div class="flex-1 overflow-y-auto p-4 sm:p-6">
        <div class="max-w-5xl mx-auto space-y-4 sm:space-y-6">
          <PageHeader
            title={t("instances.title")}
            subtitle={t("instances.description")}
            actions={
              <IconButton
                icon={<RefreshCw class={`w-4 h-4 ${isLoading.value ? "animate-spin" : ""}`} />}
                label={t("actions.refresh")}
                onClick={loadInstances}
                disabled={isLoading.value || !isConnected.value}
                variant="ghost"
              />
            }
          />

          {/* Stats Cards */}
          {isConnected.value && !isLoading.value && (
            <div class="grid grid-cols-3 gap-2 sm:gap-4">
              <StatCard
                icon={Globe}
                label={t("instances.stats.total")}
                value={instances.value.length}
              />
              <StatCard icon={Server} label={t("instances.stats.gateways")} value={gatewayCount} />
              <StatCard icon={Monitor} label={t("instances.stats.clients")} value={clientCount} />
            </div>
          )}

          {/* Error */}
          {error.value && (
            <div class="p-4 rounded-xl bg-[var(--color-error)]/10 text-[var(--color-error)]">
              {error.value}
            </div>
          )}

          {/* Loading / Connecting */}
          {(isLoading.value || !isConnected.value) && (
            <div class="flex justify-center py-16">
              <Spinner size="lg" label={!isConnected.value ? t("status.connecting") : undefined} />
            </div>
          )}

          {/* Instances - Cards on mobile, Table on desktop */}
          {isConnected.value && !isLoading.value && instances.value.length > 0 && (
            <>
              {/* Mobile: Card list */}
              <div class="md:hidden space-y-2">
                {instances.value.map((presence, i) => (
                  <InstanceCard
                    key={presence.instanceId || presence.host || i}
                    presence={presence}
                  />
                ))}
              </div>

              {/* Desktop: Table */}
              <Card padding="none" class="hidden md:block">
                <table class="w-full">
                  <thead>
                    <tr class="border-b border-[var(--color-border)] text-left text-sm text-[var(--color-text-muted)]">
                      <th class="py-3 px-4 font-medium">{t("instances.columns.instance")}</th>
                      <th class="py-3 px-4 font-medium w-24">{t("instances.columns.mode")}</th>
                      <th class="py-3 px-4 font-medium w-40">{t("instances.columns.platform")}</th>
                      <th class="py-3 px-4 font-medium w-28">{t("instances.columns.lastSeen")}</th>
                      <th class="py-3 px-4 font-medium w-20 hidden lg:table-cell">
                        {t("instances.columns.idle")}
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-[var(--color-border)]">
                    {instances.value.map((presence, i) => (
                      <InstanceRow
                        key={presence.instanceId || presence.host || i}
                        presence={presence}
                      />
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          )}

          {/* Empty state */}
          {isConnected.value &&
            !isLoading.value &&
            instances.value.length === 0 &&
            !error.value && (
              <Card>
                <div class="p-16 text-center">
                  <Globe class="w-12 h-12 mx-auto mb-4 text-[var(--color-text-muted)] opacity-50" />
                  <h3 class="text-lg font-medium mb-2">{t("instances.emptyTitle")}</h3>
                  <p class="text-[var(--color-text-muted)] mb-4">
                    {t("instances.emptyDescription")}
                  </p>
                  <Button variant="secondary" onClick={loadInstances}>
                    {t("actions.refresh")}
                  </Button>
                </div>
              </Card>
            )}

          {/* Footer count */}
          {isConnected.value && !isLoading.value && instances.value.length > 0 && (
            <p class="text-sm text-[var(--color-text-muted)] text-center">
              {t("instances.count", { count: instances.value.length })}
            </p>
          )}
        </div>
      </div>
    </ViewErrorBoundary>
  );
}
