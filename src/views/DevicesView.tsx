/**
 * DevicesView
 *
 * Manage paired devices (operators and nodes).
 * Route: /devices
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
import { StatCard } from "@/components/ui/StatCard";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { HintBox } from "@/components/ui/HintBox";
import { Dropdown } from "@/components/ui/Dropdown";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconButton } from "@/components/ui/IconButton";
import { DeviceCard, DeviceRow, DeviceDetails } from "@/components/devices";
import {
  RefreshCw,
  Search,
  Smartphone,
  Monitor,
  Globe,
  Check,
  X,
  Clock,
  RotateCcw,
  Trash2,
} from "lucide-preact";
import { PageLayout } from "@/components/ui/PageLayout";
import type { RouteProps } from "@/types/routes";
import type {
  DeviceListResponse,
  DevicePendingRequest,
  PairedDevice,
  DeviceRole,
  DeviceTokenSummary,
} from "@/types/devices";
import {
  getDeviceRole,
  isNodeDevice,
  isOperatorDevice,
  getRoleBadgeVariant,
  getPlatformIcon,
  formatDeviceId,
} from "@/types/devices";

// ============================================
// State
// ============================================

const devices = signal<PairedDevice[]>([]);
const pendingRequests = signal<DevicePendingRequest[]>([]);
const isLoading = signal(false);
const error = signal<string | null>(null);

// Filters
const searchQuery = signal("");
const roleFilter = signal<DeviceRole>("all");

// UI state
const expandedDevices = signal<Set<string>>(new Set());
const tokenModal = signal<PairedDevice | null>(null);
const mobileDetailModal = signal<PairedDevice | null>(null);
const rotatingToken = signal(false);

// ============================================
// Constants
// ============================================

const ROLE_OPTIONS = [
  { value: "all", label: () => t("devices.filters.allRoles") },
  { value: "operator", label: () => t("devices.filters.operators") },
  { value: "node", label: () => t("devices.filters.nodes") },
] as const;

// ============================================
// Computed
// ============================================

const stats = computed(() => {
  const all = devices.value;
  const operators = all.filter(isOperatorDevice).length;
  const nodes = all.filter(isNodeDevice).length;
  const pending = pendingRequests.value.length;

  return { total: all.length, operators, nodes, pending };
});

const filteredDevices = computed(() => {
  let result = devices.value;

  // Filter by role
  if (roleFilter.value === "operator") {
    result = result.filter(isOperatorDevice);
  } else if (roleFilter.value === "node") {
    result = result.filter(isNodeDevice);
  }

  // Filter by search
  const query = searchQuery.value.toLowerCase().trim();
  if (query) {
    result = result.filter(
      (d) =>
        d.deviceId.toLowerCase().includes(query) ||
        d.displayName?.toLowerCase().includes(query) ||
        d.platform?.toLowerCase().includes(query) ||
        d.remoteIp?.toLowerCase().includes(query),
    );
  }

  return result;
});

// ============================================
// Actions
// ============================================

async function loadDevices(): Promise<void> {
  isLoading.value = true;
  error.value = null;

  try {
    const result = await send<DeviceListResponse>("device.pair.list", {});
    devices.value = result.paired;
    pendingRequests.value = result.pending;
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    isLoading.value = false;
  }
}

async function approveRequest(requestId: string): Promise<void> {
  try {
    await send("device.pair.approve", { requestId });
    toast.success(t("devices.approveSuccess"));
    await loadDevices();
  } catch (err) {
    toast.error(getErrorMessage(err));
  }
}

async function rejectRequest(requestId: string): Promise<void> {
  try {
    await send("device.pair.reject", { requestId });
    toast.success(t("devices.rejectSuccess"));
    await loadDevices();
  } catch (err) {
    toast.error(getErrorMessage(err));
  }
}

async function rotateToken(device: PairedDevice, role: string): Promise<void> {
  rotatingToken.value = true;
  try {
    const result = await send<{ token: string }>("device.token.rotate", {
      deviceId: device.deviceId,
      role,
    });
    toast.success(t("devices.tokenRotated"));
    // Show the new token
    await navigator.clipboard.writeText(result.token);
    toast.success(t("devices.tokenCopied"));
    tokenModal.value = null;
    await loadDevices();
  } catch (err) {
    toast.error(getErrorMessage(err));
  } finally {
    rotatingToken.value = false;
  }
}

async function revokeToken(device: PairedDevice, role: string): Promise<void> {
  try {
    await send("device.token.revoke", {
      deviceId: device.deviceId,
      role,
    });
    toast.success(t("devices.tokenRevoked"));
    tokenModal.value = null;
    await loadDevices();
  } catch (err) {
    toast.error(getErrorMessage(err));
  }
}

function toggleExpanded(deviceId: string): void {
  const next = new Set(expandedDevices.value);
  if (next.has(deviceId)) {
    next.delete(deviceId);
  } else {
    next.add(deviceId);
  }
  expandedDevices.value = next;
}

// ============================================
// Sub-Components
// ============================================

function PendingRequestCard({ request }: { request: DevicePendingRequest }) {
  const role = getDeviceRole(request);

  return (
    <Card class="border-[var(--color-warning)] border-2">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div class="flex items-center gap-3">
          <span class="text-2xl">{getPlatformIcon(request.platform)}</span>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="font-medium">{request.displayName || formatDeviceId(request.deviceId)}</h3>
              <Badge variant={getRoleBadgeVariant(role)}>{role}</Badge>
              {request.isRepair && <Badge variant="warning">{t("devices.repair")}</Badge>}
            </div>
            <p class="text-sm text-[var(--color-text-muted)]">
              {request.platform}
              {request.remoteIp && ` • ${request.remoteIp}`}
              {" • "}
              {formatTimestamp(request.ts)}
            </p>
          </div>
        </div>
        <div class="flex gap-2 self-end sm:self-start">
          <Button
            variant="primary"
            size="sm"
            icon={Check}
            onClick={() => approveRequest(request.requestId)}
          >
            {t("devices.approve")}
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={X}
            onClick={() => rejectRequest(request.requestId)}
          >
            {t("devices.reject")}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Token card for the token management modal */
interface TokenCardProps {
  token: DeviceTokenSummary;
  device: PairedDevice;
  disabled?: boolean;
}

function TokenCard({ token, device, disabled }: TokenCardProps) {
  return (
    <div class="flex items-center justify-between rounded-lg p-3 bg-[var(--color-bg-tertiary)]">
      <div>
        <div class="font-medium">{token.role}</div>
        <div class="text-xs text-[var(--color-text-muted)]">
          {t("devices.tokenCreated")}: {formatTimestamp(token.createdAtMs)}
          {token.rotatedAtMs && (
            <>
              {" "}
              • {t("devices.tokenRotatedAt")}: {formatTimestamp(token.rotatedAtMs)}
            </>
          )}
        </div>
      </div>
      <div class="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          icon={RotateCcw}
          onClick={() => rotateToken(device, token.role)}
          disabled={disabled}
        >
          {t("devices.rotate")}
        </Button>
        <Button
          variant="danger"
          size="sm"
          icon={Trash2}
          onClick={() => revokeToken(device, token.role)}
        >
          {t("devices.revoke")}
        </Button>
      </div>
    </div>
  );
}

function TokenModal() {
  const device = tokenModal.value;
  if (!device) return null;

  const tokens = device.tokens ?? [];

  return (
    <Modal
      open={true}
      onClose={() => {
        tokenModal.value = null;
      }}
      title={t("devices.tokenManagement")}
    >
      <div class="space-y-4">
        <p class="text-sm text-[var(--color-text-muted)]">
          {t("devices.tokenManagementDesc", {
            name: device.displayName || formatDeviceId(device.deviceId),
          })}
        </p>

        {tokens.length === 0 ? (
          <p class="text-sm">{t("devices.noTokens")}</p>
        ) : (
          <div class="space-y-3">
            {tokens.map((token) => (
              <TokenCard
                key={token.role}
                token={token}
                device={device}
                disabled={rotatingToken.value}
              />
            ))}
          </div>
        )}
      </div>

      <div class="mt-6 flex justify-end">
        <Button
          variant="secondary"
          onClick={() => {
            tokenModal.value = null;
          }}
        >
          {t("actions.close")}
        </Button>
      </div>
    </Modal>
  );
}

function EmptyState() {
  return (
    <div class="text-center py-12">
      <Smartphone class="w-12 h-12 mx-auto text-[var(--color-text-muted)] mb-4" />
      <h3 class="text-lg font-medium mb-2">{t("devices.emptyTitle")}</h3>
      <p class="text-[var(--color-text-muted)] mb-4">{t("devices.emptyDescription")}</p>
    </div>
  );
}

// ============================================
// Main View
// ============================================

export function DevicesView(_props: RouteProps) {
  useEffect(() => {
    if (isConnected.value) {
      loadDevices();
    }
  }, [isConnected.value]);

  const filtered = filteredDevices.value;
  const s = stats.value;
  const pending = pendingRequests.value;

  return (
    <PageLayout viewName={t("nav.devices")}>
      <PageHeader
        title={t("devices.title")}
        subtitle={t("devices.description")}
        actions={
          <IconButton
            icon={<RefreshCw class={isLoading.value ? "animate-spin" : ""} />}
            onClick={loadDevices}
            disabled={isLoading.value}
            label={t("actions.refresh")}
          />
        }
      />

      {/* Error */}
      {error.value && <HintBox variant="error">{error.value}</HintBox>}

      {/* Loading */}
      {isLoading.value && devices.value.length === 0 && (
        <div class="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      )}

      {/* Content */}
      {!isLoading.value && !error.value && (
        <>
          {/* Stats */}
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            <StatCard
              icon={Smartphone}
              label={t("devices.stats.total")}
              value={s.total}
              active={roleFilter.value === "all"}
              onClick={() => {
                roleFilter.value = "all";
              }}
            />
            <StatCard
              icon={Globe}
              label={t("devices.stats.operators")}
              value={s.operators}
              active={roleFilter.value === "operator"}
              onClick={() => {
                roleFilter.value = "operator";
              }}
            />
            <StatCard
              icon={Monitor}
              label={t("devices.stats.nodes")}
              value={s.nodes}
              active={roleFilter.value === "node"}
              onClick={() => {
                roleFilter.value = "node";
              }}
            />
            <StatCard
              icon={Clock}
              label={t("devices.stats.pending")}
              value={s.pending}
              highlight={s.pending > 0}
            />
          </div>

          {/* Pending pairing requests */}
          {pending.length > 0 && (
            <div class="space-y-3" data-tour="pending-requests">
              <h2 class="text-lg font-semibold">{t("devices.pendingRequests")}</h2>
              {pending.map((req) => (
                <PendingRequestCard key={req.requestId} request={req} />
              ))}
            </div>
          )}

          {/* Filters */}
          {devices.value.length > 0 && (
            <div class="space-y-3">
              <div class="flex items-center gap-3">
                <Input
                  type="text"
                  placeholder={t("devices.searchPlaceholder")}
                  value={searchQuery.value}
                  onInput={(e) => {
                    searchQuery.value = (e.target as HTMLInputElement).value;
                  }}
                  leftElement={<Search class="w-4 h-4" />}
                  class="flex-1"
                />
                <Dropdown
                  value={roleFilter.value}
                  onChange={(v) => {
                    roleFilter.value = v as DeviceRole;
                  }}
                  options={ROLE_OPTIONS.map((o) => ({ value: o.value, label: o.label() }))}
                  size="sm"
                  align="right"
                  aria-label={t("devices.filters.allRoles")}
                />
              </div>
              <p class="text-sm text-[var(--color-text-muted)]">
                {filtered.length !== s.total
                  ? t("devices.filteredCount", { filtered: filtered.length, total: s.total })
                  : t("devices.count", { count: s.total })}
              </p>
            </div>
          )}

          {/* Devices list */}
          {devices.value.length > 0 ? (
            filtered.length === 0 ? (
              <Card padding="none">
                <div class="text-center py-8 text-[var(--color-text-muted)]">
                  {t("devices.noResults")}
                </div>
              </Card>
            ) : (
              <>
                {/* Mobile: Card list */}
                <div class="md:hidden space-y-2">
                  {filtered.map((device) => (
                    <DeviceCard
                      key={device.deviceId}
                      device={device}
                      onSelect={(d) => {
                        mobileDetailModal.value = d;
                      }}
                    />
                  ))}
                </div>

                {/* Desktop: Row list with expand/collapse */}
                <Card padding="none" class="hidden md:block overflow-hidden">
                  {filtered.map((device) => (
                    <DeviceRow
                      key={device.deviceId}
                      device={device}
                      isExpanded={expandedDevices.value.has(device.deviceId)}
                      onToggleExpand={() => toggleExpanded(device.deviceId)}
                      onOpenTokenModal={(d) => {
                        tokenModal.value = d;
                      }}
                    />
                  ))}
                </Card>
              </>
            )
          ) : (
            <EmptyState />
          )}
        </>
      )}

      {/* Mobile detail modal */}
      <Modal
        open={!!mobileDetailModal.value}
        onClose={() => {
          mobileDetailModal.value = null;
        }}
        title={
          mobileDetailModal.value?.displayName ||
          (mobileDetailModal.value ? formatDeviceId(mobileDetailModal.value.deviceId) : "")
        }
      >
        {mobileDetailModal.value && (
          <DeviceDetails
            device={mobileDetailModal.value}
            bare
            onOpenTokenModal={(d) => {
              mobileDetailModal.value = null;
              tokenModal.value = d;
            }}
          />
        )}
      </Modal>

      {/* Token modal */}
      <TokenModal />
    </PageLayout>
  );
}
