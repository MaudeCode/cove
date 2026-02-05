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
import { ChannelIcon } from "@/components/ui/ChannelIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  RefreshCw,
  MessageSquare,
  AlertCircle,
  Clock,
  LogOut,
  Activity,
  Zap,
  ExternalLink,
  Settings,
} from "lucide-preact";
import { ViewErrorBoundary } from "@/components/ui/ViewErrorBoundary";
import type {
  ChannelsStatusResponse,
  ChannelDisplayData,
  ChannelAccountSnapshot,
  ChannelStatus,
} from "@/types/channels";
import { transformChannelsResponse, getChannelLastActivity } from "@/types/channels";
import type { RouteProps } from "@/types/routes";
import { route } from "preact-router";

// ============================================
// Local State
// ============================================

const channels = signal<ChannelDisplayData[]>([]);
const isLoading = signal<boolean>(false);
const isProbing = signal<boolean>(false);
const error = signal<string | null>(null);

// Logout modal state
const logoutModal = signal<{
  channel: string;
  accountId: string;
  label: string;
} | null>(null);
const isLoggingOut = signal<boolean>(false);

// ============================================
// Status Helpers
// ============================================

function getStatusBadge(status: ChannelStatus) {
  switch (status) {
    case "connected":
      return { variant: "success" as const, label: t("channels.status.connected") };
    case "configured":
      return { variant: "warning" as const, label: t("channels.status.configured") };
    case "not-configured":
      return { variant: "default" as const, label: t("channels.status.notConfigured") };
    case "disabled":
      return { variant: "default" as const, label: t("channels.status.disabled") };
    case "error":
      return { variant: "error" as const, label: t("channels.status.error") };
  }
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
    loadChannels();
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    isLoggingOut.value = false;
  }
}

// ============================================
// Computed Stats
// ============================================

const stats = computed(() => {
  const list = channels.value;
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  return {
    total: list.length,
    active: list.filter((c) => getChannelLastActivity(c) > oneDayAgo).length,
    errors: list.filter((c) => c.status === "error").length,
  };
});

// ============================================
// Components
// ============================================

function AccountRow({
  account,
  channelId,
  channelLabel,
}: {
  account: ChannelAccountSnapshot;
  channelId: string;
  channelLabel: string;
}) {
  const isConnected = account.connected === true;
  const hasError = Boolean(account.lastError);
  const botUsername = account.bot?.username;

  return (
    <div class="flex items-center justify-between py-2 px-3 bg-[var(--color-bg-secondary)] rounded-lg">
      <div class="flex items-center gap-3 min-w-0">
        {/* Status dot */}
        <div
          class={`w-2 h-2 rounded-full flex-shrink-0 ${
            hasError
              ? "bg-[var(--color-error)]"
              : isConnected
                ? "bg-[var(--color-success)]"
                : "bg-[var(--color-text-muted)]"
          }`}
        />

        {/* Account info */}
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-medium truncate">{account.name || account.accountId}</span>
            {botUsername && (
              <span class="text-xs text-[var(--color-text-muted)]">
                @{botUsername.replace(/^@/, "")}
              </span>
            )}
          </div>
          {hasError && (
            <div class="text-xs text-[var(--color-error)] truncate">{account.lastError}</div>
          )}
        </div>
      </div>

      {/* Logout button */}
      <IconButton
        icon={<LogOut class="w-3.5 h-3.5" />}
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
  );
}

function ChannelCard({ channel }: { channel: ChannelDisplayData }) {
  const statusInfo = getStatusBadge(channel.status);
  const lastActivity = getChannelLastActivity(channel);

  return (
    <Card padding="md">
      {/* Header: Icon + Name + Status */}
      <div class="flex items-start gap-3 mb-4">
        <ChannelIcon channelId={channel.id} size={40} />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h3 class="font-semibold text-lg">{channel.label}</h3>
            <Badge variant={statusInfo.variant} size="sm">
              {statusInfo.label}
            </Badge>
          </div>
          <div class="flex items-center gap-3 mt-1 text-sm text-[var(--color-text-muted)]">
            {lastActivity > 0 && (
              <span class="flex items-center gap-1">
                <Clock class="w-3.5 h-3.5" />
                {formatTimestamp(lastActivity, { relative: true })}
              </span>
            )}
            <button
              type="button"
              onClick={() => route(`/config#channels.${channel.id}`)}
              class="flex items-center gap-1 hover:text-[var(--color-accent)] transition-colors"
            >
              <Settings class="w-3.5 h-3.5" />
              {t("channels.configure")}
            </button>
            <a
              href={`https://docs.openclaw.ai/channels/${channel.id}`}
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-1 hover:text-[var(--color-accent)] transition-colors"
            >
              {t("channels.docs")}
              <ExternalLink class="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Accounts */}
      {channel.accounts.length > 0 && (
        <div class="space-y-2">
          {channel.accounts.map((account) => (
            <AccountRow
              key={account.accountId}
              account={account}
              channelId={channel.id}
              channelLabel={channel.label}
            />
          ))}
        </div>
      )}
    </Card>
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
    <ViewErrorBoundary viewName={t("nav.channels")}>
      <div class="flex-1 overflow-y-auto p-4 sm:p-6">
        <div class="max-w-4xl mx-auto space-y-4 sm:space-y-6">
          <PageHeader
            title={t("channels.title")}
            subtitle={t("channels.description")}
            actions={
              <>
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
              </>
            }
          />

          {/* Stats Cards */}
          {isConnected.value && !isLoading.value && (
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              <StatCard
                icon={MessageSquare}
                label={t("channels.stats.total")}
                value={statValues.total}
              />
              <StatCard icon={Zap} label={t("channels.stats.active")} value={statValues.active} />
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

          {/* Channel Cards */}
          {isConnected.value && !isLoading.value && channels.value.length > 0 && (
            <div class="grid gap-4 sm:grid-cols-2">
              {channels.value.map((channel) => (
                <ChannelCard key={channel.id} channel={channel} />
              ))}
            </div>
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
    </ViewErrorBoundary>
  );
}
