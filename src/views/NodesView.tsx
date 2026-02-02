/**
 * NodesView
 *
 * Manage paired mobile nodes/devices.
 * Route: /nodes
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
import {
  RefreshCw,
  Search,
  Smartphone,
  Wifi,
  WifiOff,
  Bell,
  Camera,
  MapPin,
  Monitor,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Clock,
} from "lucide-preact";
import type { RouteProps } from "@/types/routes";
import type {
  NodeEntry,
  NodeListResponse,
  PairingRequest,
  PairingListResponse,
} from "@/types/nodes";
import { getNodeStatus, getPlatformIcon, nodeSupportsCommand } from "@/types/nodes";

// ============================================
// State
// ============================================

const nodes = signal<NodeEntry[]>([]);
const pendingRequests = signal<PairingRequest[]>([]);
const isLoading = signal(false);
const error = signal<string | null>(null);

// Filters
const searchQuery = signal("");

// UI state
const expandedNodes = signal<Set<string>>(new Set());
const notifyModal = signal<NodeEntry | null>(null);

// ============================================
// Computed
// ============================================

const stats = computed(() => {
  const all = nodes.value;
  const connected = all.filter((n) => n.connected).length;
  const paired = all.filter((n) => n.paired && !n.connected).length;
  const pending = pendingRequests.value.length;

  return { total: all.length, connected, paired, pending };
});

const filteredNodes = computed(() => {
  let result = nodes.value;

  const query = searchQuery.value.toLowerCase().trim();
  if (query) {
    result = result.filter(
      (n) =>
        n.nodeId.toLowerCase().includes(query) ||
        n.displayName?.toLowerCase().includes(query) ||
        n.platform?.toLowerCase().includes(query),
    );
  }

  return result;
});

// ============================================
// Actions
// ============================================

async function loadNodes(): Promise<void> {
  isLoading.value = true;
  error.value = null;

  try {
    const [nodeList, pairingList] = await Promise.all([
      send<NodeListResponse>("node.list", {}),
      send<PairingListResponse>("node.pair.list", {}),
    ]);

    nodes.value = nodeList.nodes;
    pendingRequests.value = pairingList.pending;
  } catch (err) {
    error.value = getErrorMessage(err);
  } finally {
    isLoading.value = false;
  }
}

async function approveRequest(requestId: string): Promise<void> {
  try {
    await send("node.pair.approve", { requestId });
    toast.success(t("nodes.approveSuccess"));
    await loadNodes();
  } catch (err) {
    toast.error(getErrorMessage(err));
  }
}

async function rejectRequest(requestId: string): Promise<void> {
  try {
    await send("node.pair.reject", { requestId });
    toast.success(t("nodes.rejectSuccess"));
    await loadNodes();
  } catch (err) {
    toast.error(getErrorMessage(err));
  }
}

async function sendNotification(node: NodeEntry, title: string, body: string): Promise<void> {
  try {
    await send("node.invoke", {
      nodeId: node.nodeId,
      command: "system.notify",
      params: { title, body },
      idempotencyKey: crypto.randomUUID(),
    });
    toast.success(t("nodes.notifySuccess", { name: node.displayName || node.nodeId }));
    notifyModal.value = null;
  } catch (err) {
    toast.error(getErrorMessage(err));
  }
}

async function requestLocation(node: NodeEntry): Promise<void> {
  try {
    await send<{ payload: unknown }>("node.invoke", {
      nodeId: node.nodeId,
      command: "location.get",
      params: { desiredAccuracy: "balanced" },
      idempotencyKey: crypto.randomUUID(),
    });
    toast.success(t("nodes.locationSuccess"));
    // TODO: Show location result in a modal or map view
  } catch (err) {
    toast.error(getErrorMessage(err));
  }
}

async function takePhoto(node: NodeEntry, facing: "front" | "back"): Promise<void> {
  try {
    toast.success(t("nodes.cameraRequested"));
    await send("node.invoke", {
      nodeId: node.nodeId,
      command: "camera.snap",
      params: { facing, format: "jpg" },
      idempotencyKey: crypto.randomUUID(),
    });
    toast.success(t("nodes.cameraSuccess"));
    // TODO: Show photo result
  } catch (err) {
    toast.error(getErrorMessage(err));
  }
}

function toggleExpanded(nodeId: string): void {
  const next = new Set(expandedNodes.value);
  if (next.has(nodeId)) {
    next.delete(nodeId);
  } else {
    next.add(nodeId);
  }
  expandedNodes.value = next;
}

// ============================================
// Sub-Components
// ============================================

function PendingRequestCard({ request }: { request: PairingRequest }) {
  return (
    <Card class="border-[var(--color-warning)] border-2">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="text-2xl">{getPlatformIcon(request.platform)}</span>
          <div>
            <h3 class="font-medium">{request.displayName || request.nodeId}</h3>
            <p class="text-sm text-[var(--color-text-muted)]">
              {request.platform} • {t("nodes.requestedAt")} {formatTimestamp(request.createdAt)}
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
            {t("nodes.approve")}
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={X}
            onClick={() => rejectRequest(request.requestId)}
          >
            {t("nodes.reject")}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function NodeRow({ node }: { node: NodeEntry }) {
  const isExpanded = expandedNodes.value.has(node.nodeId);
  const status = getNodeStatus(node);

  return (
    <div class="border-b border-[var(--color-border)] last:border-b-0">
      {/* Row header */}
      <button
        type="button"
        class="w-full flex items-center gap-4 px-4 py-3 hover:bg-[var(--color-bg-tertiary)] text-left"
        onClick={() => toggleExpanded(node.nodeId)}
        aria-expanded={isExpanded}
      >
        {/* Expand chevron */}
        <span class="text-[var(--color-text-muted)]">
          {isExpanded ? <ChevronDown class="w-4 h-4" /> : <ChevronRight class="w-4 h-4" />}
        </span>

        {/* Platform icon */}
        <span class="text-xl w-8 text-center flex-shrink-0">{getPlatformIcon(node.platform)}</span>

        {/* Name & info */}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-medium truncate">{node.displayName || node.nodeId}</span>
            {node.connected && (
              <Wifi class="w-4 h-4 text-[var(--color-success)]" aria-label={t("nodes.connected")} />
            )}
          </div>
          <div class="text-sm text-[var(--color-text-muted)] truncate">
            {node.platform}
            {node.modelIdentifier && ` • ${node.modelIdentifier}`}
            {node.connectedAtMs && (
              <span class="ml-2">
                <Clock class="w-3 h-3 inline mr-1" />
                {formatTimestamp(node.connectedAtMs)}
              </span>
            )}
          </div>
        </div>

        {/* Status badge */}
        <Badge variant={status === "connected" ? "success" : "default"}>
          {t(`nodes.status.${status}`)}
        </Badge>
      </button>

      {/* Expanded details */}
      {isExpanded && <NodeDetails node={node} />}
    </div>
  );
}

function NodeDetails({ node }: { node: NodeEntry }) {
  const canNotify = nodeSupportsCommand(node, "system.notify");
  const canCamera = nodeSupportsCommand(node, "camera.snap");
  const canLocation = nodeSupportsCommand(node, "location.get");
  const canScreenRecord = nodeSupportsCommand(node, "screen.record");

  return (
    <div class="px-4 py-3 bg-[var(--color-bg-tertiary)] border-t border-[var(--color-border)]">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left column: Metadata */}
        <div class="space-y-2 text-sm">
          <DetailRow label={t("nodes.nodeId")}>
            <code class="text-xs bg-[var(--color-bg-primary)] px-1 py-0.5 rounded">
              {node.nodeId}
            </code>
          </DetailRow>
          {node.version && <DetailRow label={t("nodes.version")}>{node.version}</DetailRow>}
          {node.remoteIp && <DetailRow label={t("nodes.ipAddress")}>{node.remoteIp}</DetailRow>}
          {node.commands.length > 0 && (
            <DetailRow label={t("nodes.commands")}>
              <span class="text-xs">{node.commands.join(", ")}</span>
            </DetailRow>
          )}
        </div>

        {/* Right column: Actions */}
        <div class="space-y-2">
          <h4 class="text-sm font-medium mb-2">{t("nodes.actions")}</h4>
          <div class="flex flex-wrap gap-2">
            {canNotify && (
              <Button
                variant="secondary"
                size="sm"
                icon={Bell}
                onClick={() => {
                  notifyModal.value = node;
                }}
                disabled={!node.connected}
              >
                {t("nodes.notify")}
              </Button>
            )}
            {canCamera && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Camera}
                  onClick={() => takePhoto(node, "front")}
                  disabled={!node.connected}
                >
                  {t("nodes.cameraFront")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Camera}
                  onClick={() => takePhoto(node, "back")}
                  disabled={!node.connected}
                >
                  {t("nodes.cameraBack")}
                </Button>
              </>
            )}
            {canLocation && (
              <Button
                variant="secondary"
                size="sm"
                icon={MapPin}
                onClick={() => requestLocation(node)}
                disabled={!node.connected}
              >
                {t("nodes.location")}
              </Button>
            )}
            {canScreenRecord && (
              <Button
                variant="secondary"
                size="sm"
                icon={Monitor}
                disabled={!node.connected}
                title={t("nodes.screenRecordHint")}
              >
                {t("nodes.screenRecord")}
              </Button>
            )}
          </div>
          {!node.connected && (
            <p class="text-xs text-[var(--color-text-muted)] mt-2">
              {t("nodes.actionsRequireConnection")}
            </p>
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

function NotifyModal() {
  const node = notifyModal.value;
  if (!node) return null;

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const title = formData.get("title") as string;
    const body = formData.get("body") as string;
    sendNotification(node, title, body);
  };

  return (
    <Modal
      open={true}
      onClose={() => {
        notifyModal.value = null;
      }}
      title={t("nodes.notifyTitle", { name: node.displayName || node.nodeId })}
    >
      <form onSubmit={handleSubmit} class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">{t("nodes.notifyTitleLabel")}</label>
          <Input type="text" name="title" placeholder={t("nodes.notifyTitlePlaceholder")} />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">{t("nodes.notifyBodyLabel")}</label>
          <textarea
            name="body"
            rows={3}
            class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            placeholder={t("nodes.notifyBodyPlaceholder")}
          />
        </div>
        <div class="flex justify-end gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              notifyModal.value = null;
            }}
          >
            {t("actions.cancel")}
          </Button>
          <Button type="submit" variant="primary" icon={Bell}>
            {t("nodes.sendNotification")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EmptyState() {
  return (
    <div class="text-center py-12">
      <Smartphone class="w-12 h-12 mx-auto text-[var(--color-text-muted)] mb-4" />
      <h3 class="text-lg font-medium mb-2">{t("nodes.emptyTitle")}</h3>
      <p class="text-[var(--color-text-muted)] mb-4">{t("nodes.emptyDescription")}</p>
    </div>
  );
}

// ============================================
// Main View
// ============================================

export function NodesView(_props: RouteProps) {
  useEffect(() => {
    if (isConnected.value) {
      loadNodes();
    }
  }, [isConnected.value]);

  const filtered = filteredNodes.value;
  const s = stats.value;
  const pending = pendingRequests.value;

  return (
    <div class="flex-1 overflow-y-auto p-6">
      <div class="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold">{t("nodes.title")}</h1>
            <p class="text-[var(--color-text-muted)]">{t("nodes.description")}</p>
          </div>
          <IconButton
            icon={<RefreshCw class={isLoading.value ? "animate-spin" : ""} />}
            onClick={loadNodes}
            disabled={isLoading.value}
            label={t("actions.refresh")}
          />
        </div>

        {/* Error */}
        {error.value && <HintBox variant="error">{error.value}</HintBox>}

        {/* Loading */}
        {isLoading.value && nodes.value.length === 0 && (
          <div class="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {/* Content */}
        {!isLoading.value && !error.value && (
          <>
            {/* Stats */}
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Smartphone} label={t("nodes.stats.total")} value={s.total} />
              <StatCard
                icon={Wifi}
                label={t("nodes.stats.connected")}
                value={s.connected}
                highlight={s.connected > 0}
              />
              <StatCard icon={WifiOff} label={t("nodes.stats.paired")} value={s.paired} />
              <StatCard
                icon={Clock}
                label={t("nodes.stats.pending")}
                value={s.pending}
                highlight={s.pending > 0}
              />
            </div>

            {/* Pending pairing requests */}
            {pending.length > 0 && (
              <div class="space-y-3">
                <h2 class="text-lg font-semibold">{t("nodes.pendingRequests")}</h2>
                {pending.map((req) => (
                  <PendingRequestCard key={req.requestId} request={req} />
                ))}
              </div>
            )}

            {/* Search */}
            {nodes.value.length > 0 && (
              <div class="flex items-center gap-3">
                <Input
                  type="text"
                  placeholder={t("nodes.searchPlaceholder")}
                  value={searchQuery.value}
                  onInput={(e) => {
                    searchQuery.value = (e.target as HTMLInputElement).value;
                  }}
                  leftElement={<Search class="w-4 h-4" />}
                  class="flex-1 max-w-md"
                />
                <span class="text-sm text-[var(--color-text-muted)]">
                  {filtered.length !== s.total
                    ? t("nodes.filteredCount", { filtered: filtered.length, total: s.total })
                    : t("nodes.count", { count: s.total })}
                </span>
              </div>
            )}

            {/* Nodes list */}
            {nodes.value.length > 0 ? (
              <Card padding="none">
                {filtered.length === 0 ? (
                  <div class="text-center py-8 text-[var(--color-text-muted)]">
                    {t("nodes.noResults")}
                  </div>
                ) : (
                  <div>
                    {filtered.map((node) => (
                      <NodeRow key={node.nodeId} node={node} />
                    ))}
                  </div>
                )}
              </Card>
            ) : (
              <EmptyState />
            )}
          </>
        )}

        {/* Notify modal */}
        <NotifyModal />
      </div>
    </div>
  );
}
