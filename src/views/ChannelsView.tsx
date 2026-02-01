/**
 * ChannelsView
 *
 * Channel status and management.
 * Route: /channels
 */

import { signal, computed } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { t, formatTimestamp } from "@/lib/i18n";
import { send, isConnected } from "@/lib/gateway";
import { getErrorMessage } from "@/lib/session-utils";
import { toast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { IconButton } from "@/components/ui/IconButton";
import { StatCard } from "@/components/ui/StatCard";
import { Modal } from "@/components/ui/Modal";
import {
  RefreshCw,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  LogOut,
  Activity,
  Zap,
  Link2,
  Settings2,
  ExternalLink,
} from "lucide-preact";
import type {
  ChannelsStatusResponse,
  ChannelDisplayData,
  ChannelAccountSnapshot,
  ChannelStatus,
} from "@/types/channels";
import { transformChannelsResponse } from "@/types/channels";
import type { RouteProps } from "@/types/routes";

// ============================================
// Local State
// ============================================

const channels = signal<ChannelDisplayData[]>([]);
const isLoading = signal<boolean>(false);
const isProbing = signal<boolean>(false);
const error = signal<string | null>(null);
const expandedChannels = signal<Set<string>>(new Set());

// Logout modal state
const logoutModal = signal<{
  channel: string;
  accountId: string;
  label: string;
} | null>(null);
const isLoggingOut = signal<boolean>(false);

// ============================================
// Channel Icons
// ============================================

/** Get emoji icon for channel based on ID */
function getChannelIcon(id: string): string {
  const icons: Record<string, string> = {
    telegram: "✈️",
    discord: "🎮",
    signal: "🔐",
    whatsapp: "💬",
    slack: "💼",
    googlechat: "🗨️",
    imessage: "🍎",
    nostr: "🔮",
    webchat: "🌐",
    matrix: "🔷",
    twitter: "🐦",
    mastodon: "🐘",
    email: "📧",
    sms: "📱",
  };
  return icons[id.toLowerCase()] ?? "📡";
}

// ============================================
// Status Helpers
// ============================================

function getStatusBadge(status: ChannelStatus) {
  switch (status) {
    case "connected":
      return {
        variant: "success" as const,
        label: t("channels.status.connected"),
        icon: CheckCircle2,
      };
    case "configured":
      return {
        variant: "warning" as const,
        label: t("channels.status.configured"),
        icon: Settings2,
      };
    case "not-configured":
      return {
        variant: "default" as const,
        label: t("channels.status.notConfigured"),
        icon: Link2,
      };
    case "disabled":
      return { variant: "default" as const, label: t("channels.status.disabled"), icon: XCircle };
    case "error":
      return { variant: "error" as const, label: t("channels.status.error"), icon: AlertCircle };
  }
}

function getAccountStatusBits(account: ChannelAccountSnapshot): string[] {
  const bits: string[] = [];

  if (account.enabled === false) bits.push(t("channels.account.disabled"));
  else if (account.enabled === true) bits.push(t("channels.account.enabled"));

  if (account.configured === true) bits.push(t("channels.account.configured"));
  if (account.linked === true) bits.push(t("channels.account.linked"));
  if (account.running === true) bits.push(t("channels.account.running"));
  if (account.connected === true) bits.push(t("channels.account.connected"));
  else if (account.connected === false && account.running)
    bits.push(t("channels.account.disconnected"));

  return bits;
}

function formatActivity(inbound?: number | null, outbound?: number | null): string {
  const parts: string[] = [];
  if (inbound) {
    parts.push(`↓ ${formatTimestamp(inbound, { relative: true })}`);
  }
  if (outbound) {
    parts.push(`↑ ${formatTimestamp(outbound, { relative: true })}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

// ============================================
// Actions
// ============================================

async function loadChannels(probe = false): Promise<void> {
  if (probe) {
    isProbing.value = true;
  } else {
    isLoading.value = true;
  }
  error.value = null;

  try {
    const result = await send<ChannelsStatusResponse>("channels.status", {
      probe,
      timeoutMs: probe ? 15000 : 10000,
    });
    channels.value = transformChannelsResponse(result);
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    isLoading.value = false;
    isProbing.value = false;
  }
}

async function handleLogout(): Promise<void> {
  if (!logoutModal.value) return;

  isLoggingOut.value = true;
  try {
    await send("channels.logout", {
      channel: logoutModal.value.channel,
      accountId: logoutModal.value.accountId,
    });
    toast.success(t("channels.logoutSuccess", { channel: logoutModal.value.label }));
    logoutModal.value = null;
    // Refresh to show updated status
    loadChannels();
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    isLoggingOut.value = false;
  }
}

function toggleExpanded(channelId: string) {
  const next = new Set(expandedChannels.value);
  if (next.has(channelId)) {
    next.delete(channelId);
  } else {
    next.add(channelId);
  }
  expandedChannels.value = next;
}

// ============================================
// Computed Stats
// ============================================

const stats = computed(() => {
  const list = channels.value;
  return {
    total: list.length,
    connected: list.filter((c) => c.status === "connected").length,
    configured: list.filter((c) => c.status === "configured" || c.status === "connected").length,
    errors: list.filter((c) => c.status === "error").length,
  };
});

// ============================================
// Components
// ============================================

function AccountDetails({
  account,
  channelId,
  channelLabel,
}: {
  account: ChannelAccountSnapshot;
  channelId: string;
  channelLabel: string;
}) {
  const statusBits = getAccountStatusBits(account);
  const hasProbe = account.probe !== undefined;
  const probeOk = hasProbe && account.probe?.ok === true;
  const probeFailed = hasProbe && account.probe?.ok === false;
  const botUsername = account.bot?.username;

  return (
    <div class="px-4 py-3 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)]">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1 min-w-0">
          {/* Account ID / Name */}
          <div class="flex items-center gap-2 mb-2">
            <span class="font-medium">{account.name || account.accountId}</span>
            {account.accountId !== "default" && account.name && (
              <span class="text-xs text-[var(--color-text-muted)]">({account.accountId})</span>
            )}
            {botUsername && (
              <Badge variant="default" size="sm">
                @{botUsername.replace(/^@/, "")}
              </Badge>
            )}
          </div>

          {/* Status bits */}
          <div class="flex flex-wrap gap-1.5 mb-2">
            {statusBits.map((bit) => (
              <Badge key={bit} variant="default" size="sm">
                {bit}
              </Badge>
            ))}
            {hasProbe && (
              <Badge variant={probeOk ? "success" : probeFailed ? "error" : "default"} size="sm">
                {probeOk
                  ? t("channels.probeOk")
                  : probeFailed
                    ? t("channels.probeFailed")
                    : t("channels.probing")}
              </Badge>
            )}
          </div>

          {/* Activity */}
          <div class="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
            <div class="flex items-center gap-1">
              <Clock class="w-3 h-3" />
              <span>{formatActivity(account.lastInboundAt, account.lastOutboundAt)}</span>
            </div>
            {account.mode && <span>mode: {account.mode}</span>}
            {account.dmPolicy && <span>dm: {account.dmPolicy}</span>}
          </div>

          {/* Error */}
          {account.lastError && (
            <div class="mt-2 text-xs text-[var(--color-error)] bg-[var(--color-error)]/10 px-2 py-1 rounded">
              {account.lastError}
            </div>
          )}

          {/* Token/config sources */}
          {(account.tokenSource || account.botTokenSource || account.baseUrl) && (
            <div class="mt-2 text-xs text-[var(--color-text-muted)]">
              {account.tokenSource && <span class="mr-3">token: {account.tokenSource}</span>}
              {account.botTokenSource && <span class="mr-3">bot: {account.botTokenSource}</span>}
              {account.baseUrl && <span>url: {account.baseUrl}</span>}
            </div>
          )}
        </div>

        {/* Actions */}
        <div class="flex items-center gap-2">
          <IconButton
            icon={<LogOut class="w-4 h-4" />}
            label={t("channels.logout")}
            onClick={() => {
              logoutModal.value = {
                channel: channelId,
                accountId: account.accountId,
                label: `${channelLabel} (${account.name || account.accountId})`,
              };
            }}
            variant="ghost"
            size="sm"
          />
        </div>
      </div>
    </div>
  );
}

function ChannelRow({ channel }: { channel: ChannelDisplayData }) {
  const isExpanded = expandedChannels.value.has(channel.id);
  const statusInfo = getStatusBadge(channel.status);
  const StatusIcon = statusInfo.icon;
  const accountCount = channel.accounts.length;
  const hasAccounts = accountCount > 0;

  // Find last activity across all accounts
  const lastActivity = channel.accounts.reduce((latest, acc) => {
    const inbound = acc.lastInboundAt ?? 0;
    const outbound = acc.lastOutboundAt ?? 0;
    const max = Math.max(inbound, outbound);
    return max > latest ? max : latest;
  }, 0);

  return (
    <>
      <tr
        class={`hover:bg-[var(--color-bg-hover)] transition-colors ${hasAccounts ? "cursor-pointer" : ""}`}
        onClick={hasAccounts ? () => toggleExpanded(channel.id) : undefined}
        onKeyDown={
          hasAccounts
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleExpanded(channel.id);
                }
              }
            : undefined
        }
        tabIndex={hasAccounts ? 0 : undefined}
        role={hasAccounts ? "button" : undefined}
        aria-expanded={hasAccounts ? isExpanded : undefined}
      >
        {/* Channel */}
        <td class="py-3 px-4">
          <div class="flex items-center gap-3">
            {hasAccounts && (
              <div class="w-4 flex-shrink-0">
                {isExpanded ? (
                  <ChevronDown class="w-4 h-4 text-[var(--color-text-muted)]" />
                ) : (
                  <ChevronRight class="w-4 h-4 text-[var(--color-text-muted)]" />
                )}
              </div>
            )}
            {!hasAccounts && <div class="w-4" />}
            <span class="text-xl" role="img" aria-label={channel.label}>
              {getChannelIcon(channel.id)}
            </span>
            <div class="min-w-0">
              <div class="font-medium">{channel.label}</div>
              {channel.detailLabel !== channel.label && (
                <div class="text-xs text-[var(--color-text-muted)]">{channel.detailLabel}</div>
              )}
            </div>
          </div>
        </td>

        {/* Accounts */}
        <td class="py-3 px-4 text-center">
          {accountCount > 0 ? (
            <span class="text-sm font-medium">{accountCount}</span>
          ) : (
            <span class="text-sm text-[var(--color-text-muted)]">—</span>
          )}
        </td>

        {/* Status */}
        <td class="py-3 px-4">
          <Badge variant={statusInfo.variant} size="sm">
            <StatusIcon class="w-3 h-3 mr-1" />
            {statusInfo.label}
          </Badge>
        </td>

        {/* Last Activity */}
        <td class="py-3 px-4 whitespace-nowrap text-sm text-[var(--color-text-muted)]">
          {lastActivity > 0 ? formatTimestamp(lastActivity, { relative: true }) : "—"}
        </td>

        {/* Actions */}
        <td class="py-3 px-4">
          <div class="flex items-center justify-end gap-2">
            <a
              href={`https://docs.openclaw.ai/channels/${channel.id}`}
              target="_blank"
              rel="noopener noreferrer"
              class="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              onClick={(e) => e.stopPropagation()}
              aria-label={t("channels.viewDocs")}
            >
              <ExternalLink class="w-4 h-4" />
            </a>
          </div>
        </td>
      </tr>

      {/* Expanded account details */}
      {isExpanded &&
        channel.accounts.map((account) => (
          <tr key={`${channel.id}-${account.accountId}`}>
            <td colSpan={5} class="p-0">
              <AccountDetails
                account={account}
                channelId={channel.id}
                channelLabel={channel.label}
              />
            </td>
          </tr>
        ))}
    </>
  );
}

function LogoutModal() {
  if (!logoutModal.value) return null;

  return (
    <Modal
      open={true}
      onClose={() => {
        logoutModal.value = null;
      }}
      title={t("channels.logoutTitle")}
    >
      <div class="space-y-4">
        <p class="text-[var(--color-text-secondary)]">
          {t("channels.logoutConfirm", { channel: logoutModal.value.label })}
        </p>
        <p class="text-sm text-[var(--color-text-muted)]">{t("channels.logoutWarning")}</p>
      </div>

      <div class="flex justify-end gap-3 mt-6">
        <Button
          variant="ghost"
          onClick={() => {
            logoutModal.value = null;
          }}
          disabled={isLoggingOut.value}
        >
          {t("actions.cancel")}
        </Button>
        <Button variant="danger" onClick={handleLogout} loading={isLoggingOut.value}>
          {t("channels.logout")}
        </Button>
      </div>
    </Modal>
  );
}

// ============================================
// Main View
// ============================================

export function ChannelsView(_props: RouteProps) {
  useEffect(() => {
    if (isConnected.value) {
      loadChannels();
    }
  }, [isConnected.value]);

  const statValues = stats.value;

  return (
    <div class="flex-1 overflow-y-auto p-6">
      <div class="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <h1 class="text-2xl font-bold">{t("channels.title")}</h1>
            <p class="text-[var(--color-text-muted)] mt-1">{t("channels.description")}</p>
          </div>
          <div class="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadChannels(true)}
              disabled={isProbing.value || isLoading.value || !isConnected.value}
              icon={<Activity class={`w-4 h-4 ${isProbing.value ? "animate-pulse" : ""}`} />}
            >
              {isProbing.value ? t("channels.probing") : t("channels.probe")}
            </Button>
            <IconButton
              icon={<RefreshCw class={`w-4 h-4 ${isLoading.value ? "animate-spin" : ""}`} />}
              label={t("actions.refresh")}
              onClick={() => loadChannels()}
              disabled={isLoading.value || !isConnected.value}
              variant="ghost"
            />
          </div>
        </div>

        {/* Stats Cards */}
        {isConnected.value && !isLoading.value && (
          <div class="grid grid-cols-4 gap-3">
            <StatCard
              icon={MessageSquare}
              label={t("channels.stats.total")}
              value={statValues.total}
            />
            <StatCard
              icon={CheckCircle2}
              label={t("channels.stats.connected")}
              value={statValues.connected}
            />
            <StatCard
              icon={Zap}
              label={t("channels.stats.configured")}
              value={statValues.configured}
            />
            <StatCard
              icon={AlertCircle}
              label={t("channels.stats.errors")}
              value={statValues.errors}
              highlight={statValues.errors > 0}
            />
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

        {/* Channels Table */}
        {isConnected.value && !isLoading.value && channels.value.length > 0 && (
          <Card padding="none">
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-[var(--color-border)] text-left text-sm text-[var(--color-text-muted)]">
                    <th class="py-3 px-4 font-medium">{t("channels.columns.channel")}</th>
                    <th class="py-3 px-4 font-medium w-24 text-center">
                      {t("channels.columns.accounts")}
                    </th>
                    <th class="py-3 px-4 font-medium w-36">{t("channels.columns.status")}</th>
                    <th class="py-3 px-4 font-medium w-32">{t("channels.columns.lastActivity")}</th>
                    <th class="py-3 px-4 font-medium w-16"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[var(--color-border)]">
                  {channels.value.map((channel) => (
                    <ChannelRow key={channel.id} channel={channel} />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Empty state */}
        {isConnected.value && !isLoading.value && channels.value.length === 0 && !error.value && (
          <Card>
            <div class="p-16 text-center">
              <MessageSquare class="w-12 h-12 mx-auto mb-4 text-[var(--color-text-muted)] opacity-50" />
              <h3 class="text-lg font-medium mb-2">{t("channels.emptyTitle")}</h3>
              <p class="text-[var(--color-text-muted)] mb-4">{t("channels.emptyDescription")}</p>
              <a
                href="https://docs.openclaw.ai/channels"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 text-[var(--color-accent)] hover:underline"
              >
                {t("channels.learnMore")}
                <ExternalLink class="w-4 h-4" />
              </a>
            </div>
          </Card>
        )}

        {/* Footer count */}
        {isConnected.value && !isLoading.value && channels.value.length > 0 && (
          <p class="text-sm text-[var(--color-text-muted)] text-center">
            {t("channels.count", { count: channels.value.length })}
          </p>
        )}
      </div>

      {/* Logout Modal */}
      <LogoutModal />
    </div>
  );
}
