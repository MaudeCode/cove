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
import { IconButton } from "@/components/ui/IconButton";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { StatCard } from "@/components/ui/StatCard";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { HintBox } from "@/components/ui/HintBox";
import { Dropdown } from "@/components/ui/Dropdown";
import {
  RefreshCw,
  Search,
  Smartphone,
  Monitor,
  Globe,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Clock,
  Key,
  RotateCcw,
  Trash2,
  Shield,
} from "lucide-preact";
import type { RouteProps } from "@/types/routes";
import type {
  DeviceListResponse,
  DevicePendingRequest,
  PairedDevice,
  DeviceRole,
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
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="text-2xl">{getPlatformIcon(request.platform)}</span>
          <div>
            <div class="flex items-center gap-2">
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
        <div class="flex gap-2">
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

function DeviceRow({ device }: { device: PairedDevice }) {
  const isExpanded = expandedDevices.value.has(device.deviceId);
  const role = getDeviceRole(device);
  const tokenCount = device.tokens?.length ?? 0;

  return (
    <div class="border-b border-[var(--color-border)] last:border-b-0">
      {/* Row header */}
      <button
        type="button"
        class="w-full flex items-center gap-4 px-4 py-3 hover:bg-[var(--color-bg-tertiary)] text-left"
        onClick={() => toggleExpanded(device.deviceId)}
        aria-expanded={isExpanded}
      >
        {/* Expand chevron */}
        <span class="text-[var(--color-text-muted)]">
          {isExpanded ? <ChevronDown class="w-4 h-4" /> : <ChevronRight class="w-4 h-4" />}
        </span>

        {/* Platform icon */}
        <span class="text-xl w-8 text-center flex-shrink-0">
          {getPlatformIcon(device.platform)}
        </span>

        {/* Name & info */}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-medium truncate">
              {device.displayName || formatDeviceId(device.deviceId)}
            </span>
          </div>
          <div class="text-sm text-[var(--color-text-muted)] truncate">
            {device.platform}
            {device.remoteIp && ` • ${device.remoteIp}`}
            {device.clientMode && ` • ${device.clientMode}`}
          </div>
        </div>

        {/* Role badge */}
        <Badge variant={getRoleBadgeVariant(role)}>{role}</Badge>

        {/* Token count */}
        {tokenCount > 0 && (
          <div class="flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
            <Key class="w-4 h-4" />
            <span>{tokenCount}</span>
          </div>
        )}

        {/* Approved date */}
        <div class="hidden md:flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
          <Clock class="w-4 h-4" />
          <span>{formatTimestamp(device.approvedAtMs)}</span>
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && <DeviceDetails device={device} />}
    </div>
  );
}

function DeviceDetails({ device }: { device: PairedDevice }) {
  const tokens = device.tokens ?? [];

  return (
    <div class="px-4 py-3 bg-[var(--color-bg-tertiary)] border-t border-[var(--color-border)]">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left column: Metadata */}
        <div class="space-y-2 text-sm">
          <DetailRow label={t("devices.deviceId")}>
            <code class="text-xs bg-[var(--color-bg-primary)] px-1 py-0.5 rounded break-all">
              {device.deviceId}
            </code>
          </DetailRow>
          {device.clientId && (
            <DetailRow label={t("devices.clientId")}>{device.clientId}</DetailRow>
          )}
          {device.scopes && device.scopes.length > 0 && (
            <DetailRow label={t("devices.scopes")}>
              <span class="text-xs">{device.scopes.join(", ")}</span>
            </DetailRow>
          )}
          <DetailRow label={t("devices.approved")}>
            {formatTimestamp(device.approvedAtMs)}
          </DetailRow>
        </div>

        {/* Right column: Tokens */}
        <div class="space-y-2">
          <h4 class="text-sm font-medium flex items-center gap-2">
            <Shield class="w-4 h-4" />
            {t("devices.tokens")}
          </h4>
          {tokens.length === 0 ? (
            <p class="text-sm text-[var(--color-text-muted)]">{t("devices.noTokens")}</p>
          ) : (
            <div class="space-y-2">
              {tokens.map((token) => (
                <div
                  key={token.role}
                  class="flex items-center justify-between p-2 bg-[var(--color-bg-primary)] rounded-lg"
                >
                  <div>
                    <span class="font-medium text-sm">{token.role}</span>
                    <div class="text-xs text-[var(--color-text-muted)]">
                      {token.revokedAtMs ? t("devices.tokenRevoked") : t("devices.tokenActive")}
                    </div>
                  </div>
                  <div class="flex gap-1">
                    <IconButton
                      icon={<RotateCcw class="w-4 h-4" />}
                      label={t("devices.rotateToken")}
                      onClick={() => {
                        tokenModal.value = device;
                      }}
                      size="sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: preact.ComponentChildren }) {
  return (
    <div>
      <span class="text-[var(--color-text-muted)]">{label}:</span> {children}
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
              <div
                key={token.role}
                class="flex items-center justify-between p-3 bg-[var(--color-bg-tertiary)] rounded-lg"
              >
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
                    disabled={rotatingToken.value}
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
    <div class="flex-1 overflow-y-auto p-6">
      <div class="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold">{t("devices.title")}</h1>
            <p class="text-[var(--color-text-muted)]">{t("devices.description")}</p>
          </div>
          <IconButton
            icon={<RefreshCw class={isLoading.value ? "animate-spin" : ""} />}
            onClick={loadDevices}
            disabled={isLoading.value}
            label={t("actions.refresh")}
          />
        </div>

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
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <div class="space-y-3">
                <h2 class="text-lg font-semibold">{t("devices.pendingRequests")}</h2>
                {pending.map((req) => (
                  <PendingRequestCard key={req.requestId} request={req} />
                ))}
              </div>
            )}

            {/* Filters */}
            {devices.value.length > 0 && (
              <div class="flex flex-col sm:flex-row sm:items-center gap-4">
                <div class="flex-1 flex items-center gap-3">
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
                  <span class="text-sm text-[var(--color-text-muted)] whitespace-nowrap">
                    {filtered.length !== s.total
                      ? t("devices.filteredCount", { filtered: filtered.length, total: s.total })
                      : t("devices.count", { count: s.total })}
                  </span>
                </div>
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
            )}

            {/* Devices list */}
            {devices.value.length > 0 ? (
              <Card padding="none">
                {filtered.length === 0 ? (
                  <div class="text-center py-8 text-[var(--color-text-muted)]">
                    {t("devices.noResults")}
                  </div>
                ) : (
                  <div>
                    {filtered.map((device) => (
                      <DeviceRow key={device.deviceId} device={device} />
                    ))}
                  </div>
                )}
              </Card>
            ) : (
              <EmptyState />
            )}
          </>
        )}

        {/* Token modal */}
        <TokenModal />
      </div>
    </div>
  );
}
