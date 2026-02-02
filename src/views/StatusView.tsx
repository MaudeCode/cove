/**
 * StatusView (Overview Dashboard)
 *
 * Gateway status and quick stats dashboard.
 * Route: /overview
 */

import { signal, computed } from "@preact/signals";
import { useEffect, useState } from "preact/hooks";
import { t, formatTimestamp } from "@/lib/i18n";
import {
  gateway,
  isConnected,
  connectionState,
  gatewayVersion,
  gatewayUrl,
  gatewayCommit,
  gatewayHost,
  gatewayUptime,
  connectedAt,
  presence,
  disconnect,
  send,
} from "@/lib/gateway";
import { sessions } from "@/signals/sessions";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Wifi,
  WifiOff,
  Clock,
  Users,
  MessageSquare,
  Shield,
  AlertTriangle,
  Copy,
  Check,
  Radio,
  Zap,
  Sparkles,
} from "lucide-preact";
import type { RouteProps } from "@/types/routes";

// ============================================
// Types
// ============================================

interface CronStatus {
  enabled: boolean;
  jobCount: number;
  nextWakeMs: number | null;
}

interface ChannelStatus {
  id: string;
  type: string;
  connected: boolean;
  error?: string;
}

interface HealthData {
  memoryUsageMB?: number;
  cpuPercent?: number;
  uptimeMs?: number;
}

interface SkillsStatus {
  total: number;
  eligible: number;
}

// ============================================
// Dashboard Data Signals
// ============================================

const cronStatus = signal<CronStatus | null>(null);
const channels = signal<ChannelStatus[]>([]);
const healthData = signal<HealthData | null>(null);
const skillsStatus = signal<SkillsStatus | null>(null);
const loadingData = signal(false);

// ============================================
// Data Fetching
// ============================================

async function fetchDashboardData() {
  if (!isConnected.value) return;

  loadingData.value = true;

  try {
    // Fetch cron status
    try {
      const cronResult = await send<{
        enabled: boolean;
        jobs: number;
        nextWakeAtMs?: number;
      }>("cron.status");

      cronStatus.value = {
        enabled: cronResult.enabled ?? false,
        jobCount: cronResult.jobs ?? 0,
        nextWakeMs: cronResult.nextWakeAtMs ?? null,
      };
    } catch {
      cronStatus.value = null;
    }

    // Fetch channels
    try {
      const channelsResult = await send<{
        channelOrder: string[];
        channelAccounts: Record<
          string,
          Array<{
            accountId: string;
            name?: string | null;
            connected?: boolean | null;
            running?: boolean | null;
            configured?: boolean | null;
          }>
        >;
      }>("channels.status");

      // Count total accounts and connected accounts across all channels
      const allAccounts: ChannelStatus[] = [];
      const channelTypes = channelsResult.channelOrder ?? [];

      for (const channelType of channelTypes) {
        const accounts = channelsResult.channelAccounts?.[channelType] ?? [];
        for (const account of accounts) {
          allAccounts.push({
            id: account.accountId,
            type: channelType,
            connected: account.connected ?? account.running ?? false,
          });
        }
      }

      channels.value = allAccounts;
    } catch {
      channels.value = [];
    }

    // Fetch skills status
    try {
      const skillsResult = await send<{
        skills?: Array<{ eligible: boolean }>;
      }>("skills.status");

      const skills = skillsResult.skills ?? [];
      skillsStatus.value = {
        total: skills.length,
        eligible: skills.filter((s) => s.eligible).length,
      };
    } catch {
      skillsStatus.value = null;
    }

    // Health data - skip for now, API may not exist
    healthData.value = null;
  } finally {
    loadingData.value = false;
  }
}

// ============================================
// Computed Values
// ============================================

const uptimeFormatted = computed(() => {
  const ms = gatewayUptime.value;
  if (ms == null) return null;

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
});

const isSecureContext = computed(() => {
  return window.location.protocol === "https:" || window.location.hostname === "localhost";
});

const gatewayIsSecure = computed(() => {
  const url = gatewayUrl.value;
  return url?.startsWith("wss://") ?? false;
});

const connectedChannelCount = computed(() => {
  return channels.value.filter((c) => c.connected).length;
});

const formatNextWake = computed(() => {
  const next = cronStatus.value?.nextWakeMs;
  if (!next) return null;

  const now = Date.now();
  const diff = next - now;

  if (diff < 0) return "now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
});

// ============================================
// Components
// ============================================

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  href,
}: {
  icon: typeof Wifi;
  label: string;
  value: string | number;
  subtext?: string;
  href?: string;
}) {
  const content = (
    <>
      <div class="p-2 rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]">
        <Icon class="w-5 h-5" />
      </div>
      <div>
        <div class="text-lg font-semibold">{value}</div>
        <div class="text-sm text-[var(--color-text-muted)]">{label}</div>
        {subtext && <div class="text-xs text-[var(--color-text-muted)]">{subtext}</div>}
      </div>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        class="flex items-center gap-3 p-4 rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors no-underline"
      >
        {content}
      </a>
    );
  }

  return (
    <div class="flex items-center gap-3 p-4 rounded-lg bg-[var(--color-bg-secondary)]">
      {content}
    </div>
  );
}

function CopyableValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div class="flex items-center justify-between py-2">
      <span class="text-[var(--color-text-muted)]">{label}</span>
      <div class="flex items-center gap-2">
        <code class="text-sm bg-[var(--color-bg-secondary)] px-2 py-0.5 rounded">{value}</code>
        <button
          onClick={handleCopy}
          class="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          aria-label={`Copy ${label}`}
        >
          {copied ? (
            <Check class="w-4 h-4 text-[var(--color-success)]" />
          ) : (
            <Copy class="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div class="flex items-center justify-between py-2">
      <span class="text-[var(--color-text-muted)]">{label}</span>
      <span class="font-medium">{value}</span>
    </div>
  );
}

// ============================================
// Main View
// ============================================

export function StatusView(_props: RouteProps) {
  const connected = isConnected.value;
  const state = connectionState.value;

  // Fetch data when connected
  useEffect(() => {
    if (connected) {
      fetchDashboardData();
    }
  }, [connected]);

  return (
    <div class="flex-1 overflow-y-auto p-6">
      <div class="max-w-5xl mx-auto space-y-6">
        {/* Security Warnings */}
        {!isSecureContext.value && (
          <div class="flex items-start gap-3 p-4 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20">
            <AlertTriangle class="w-5 h-5 text-[var(--color-warning)] flex-shrink-0 mt-0.5" />
            <div>
              <div class="font-medium text-[var(--color-warning)]">Insecure Context</div>
              <p class="text-sm text-[var(--color-text-secondary)] mt-1">
                This page is not served over HTTPS. Some features may be limited.
              </p>
            </div>
          </div>
        )}

        {connected && gatewayUrl.value && !gatewayIsSecure.value && (
          <div class="flex items-start gap-3 p-4 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20">
            <Shield class="w-5 h-5 text-[var(--color-warning)] flex-shrink-0 mt-0.5" />
            <div>
              <div class="font-medium text-[var(--color-warning)]">Insecure WebSocket</div>
              <p class="text-sm text-[var(--color-text-secondary)] mt-1">
                Connected via <code class="bg-[var(--color-bg-secondary)] px-1 rounded">ws://</code>{" "}
                instead of <code class="bg-[var(--color-bg-secondary)] px-1 rounded">wss://</code>.
                Traffic is not encrypted.
              </p>
            </div>
          </div>
        )}

        {/* Connection Status Card */}
        <Card padding="lg">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              {connected ? (
                <div class="p-2 rounded-lg bg-[var(--color-success)]/10">
                  <Wifi class="w-6 h-6 text-[var(--color-success)]" />
                </div>
              ) : (
                <div class="p-2 rounded-lg bg-[var(--color-error)]/10">
                  <WifiOff class="w-6 h-6 text-[var(--color-error)]" />
                </div>
              )}
              <div>
                <h2 class="text-lg font-semibold">Gateway Connection</h2>
                <Badge
                  variant={connected ? "success" : state === "connecting" ? "warning" : "error"}
                  dot
                  size="sm"
                >
                  {state === "connected"
                    ? t("status.connected")
                    : state === "connecting" || state === "authenticating"
                      ? t("status.connecting")
                      : state === "reconnecting"
                        ? t("status.reconnecting")
                        : t("status.disconnected")}
                </Badge>
              </div>
            </div>

            {connected && (
              <Button variant="secondary" size="sm" onClick={() => disconnect()}>
                Disconnect
              </Button>
            )}
          </div>

          {connected && gatewayUrl.value && (
            <div class="border-t border-[var(--color-border)] pt-4 mt-4 space-y-1">
              <CopyableValue label="URL" value={gatewayUrl.value} />
              {gateway.connectionId.value && (
                <CopyableValue label="Connection ID" value={gateway.connectionId.value} />
              )}
            </div>
          )}
        </Card>

        {/* Quick Stats */}
        {connected && (
          <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard
              icon={Clock}
              label="Uptime"
              value={uptimeFormatted.value ?? "—"}
              subtext={
                connectedAt.value ? `Since ${formatTimestamp(connectedAt.value)}` : undefined
              }
              href="/stats"
            />
            <StatCard
              icon={Users}
              label="Instances"
              value={presence.value.length}
              subtext="Connected clients"
              href="/instances"
            />
            <StatCard
              icon={MessageSquare}
              label="Sessions"
              value={sessions.value.length}
              subtext="Active sessions"
              href="/sessions"
            />
          </div>
        )}

        {/* Quick Stats - Row 2: Cron & Channels */}
        {connected && (
          <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard
              icon={Zap}
              label="Cron"
              value={cronStatus.value?.enabled ? "Enabled" : "Disabled"}
              subtext={
                cronStatus.value?.nextWakeMs
                  ? `Next wake: ${formatNextWake.value}`
                  : cronStatus.value?.jobCount
                    ? `${cronStatus.value.jobCount} jobs`
                    : undefined
              }
              href="/cron"
            />
            <StatCard
              icon={Radio}
              label="Channels"
              value={channels.value.length > 0 ? connectedChannelCount.value : "—"}
              subtext={
                channels.value.length > 0
                  ? `${connectedChannelCount.value}/${channels.value.length} connected`
                  : "No channels configured"
              }
              href="/channels"
            />
            <StatCard
              icon={Sparkles}
              label="Skills"
              value={skillsStatus.value?.eligible ?? "—"}
              subtext={
                skillsStatus.value
                  ? `${skillsStatus.value.eligible}/${skillsStatus.value.total} active`
                  : undefined
              }
              href="/skills"
            />
          </div>
        )}

        {/* Server Info */}
        {connected && (
          <Card title={t("overview.serverInfo")} padding="md">
            <div class="divide-y divide-[var(--color-border)]">
              <InfoRow label={t("overview.version")} value={gatewayVersion.value} />
              <InfoRow label={t("overview.commit")} value={gatewayCommit.value?.substring(0, 8)} />
              <InfoRow label={t("overview.host")} value={gatewayHost.value} />
              <InfoRow
                label={t("overview.capabilities")}
                value={
                  gateway.capabilities.value.length > 0
                    ? t("overview.capabilitiesCount", { count: gateway.capabilities.value.length })
                    : null
                }
              />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
