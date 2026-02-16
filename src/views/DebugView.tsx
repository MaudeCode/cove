/**
 * DebugView
 *
 * Developer debugging tools showing connection state, gateway info,
 * event logs, and system diagnostics.
 * Route: /debug
 */

import { signal, computed } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { t, formatTimestamp } from "@/lib/i18n";
import { useQueryParamSet, toggleSetValue } from "@/hooks/useQueryParam";
import { formatJson, formatUptime } from "@/lib/utils";
import {
  isConnected,
  connectionState,
  gatewayVersion,
  gatewayUrl,
  gatewayCommit,
  gatewayHost,
  gatewayUptime,
  connectedAt,
  reconnectAttempt,
  mainSessionKey,
  tickIntervalMs,
  gatewayConfigPath,
  gatewayStateDir,
  presence,
  subscribe,
} from "@/lib/gateway";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Toggle } from "@/components/ui/Toggle";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Wifi,
  WifiOff,
  Server,
  Monitor,
  Clock,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Activity,
  Key,
  Folder,
  FileText,
  Users,
  Zap,
} from "lucide-preact";
import { PageLayout } from "@/components/ui/PageLayout";
import type { RouteProps } from "@/types/routes";
import type { GatewayEvent } from "@/types/gateway";
import { SnapshotsPanel } from "@/components/debug/SnapshotsPanel";
import { ManualRpcPanel } from "@/components/debug/ManualRpcPanel";
import { JsonBlock } from "@/components/debug/JsonBlock";

// ============================================
// Types
// ============================================

interface EventLogEntry {
  id: number;
  timestamp: number;
  event: string;
  payload: unknown;
}

// ============================================
// State Signals
// ============================================

/** Event log entries */
const eventLog = signal<EventLogEntry[]>([]);

/** Max events to keep in log */
const maxEvents = signal(100);

/** Whether event logging is paused */
const isPaused = signal(false);

/** Counter for unique event IDs */
let eventCounter = 0;

/** Copied state for copy buttons */
const copiedItem = signal<string | null>(null);

/** Expanded event IDs (desktop) */
const expandedEvents = signal<Set<number>>(new Set());

/** Mobile event detail modal */
const mobileEventModal = signal<EventLogEntry | null>(null);

/** Tick counter for forcing uptime re-render */
const uptimeTick = signal(0);

// ============================================
// Computed Values
// ============================================

const formattedUptime = computed(() => {
  // Read tick to create dependency for re-computation
  const _tick = uptimeTick.value;

  const ms = gatewayUptime.value;
  if (ms == null) return "—";
  return formatUptime(ms, { includeMinutesWhenDays: true });
});

const connectionBadgeVariant = computed(() => {
  switch (connectionState.value) {
    case "connected":
      return "success";
    case "connecting":
    case "authenticating":
    case "reconnecting":
      return "warning";
    default:
      return "error";
  }
});

// ============================================
// Helpers
// ============================================

function addEvent(event: string, payload: unknown) {
  if (isPaused.value) return;

  const entry: EventLogEntry = {
    id: ++eventCounter,
    timestamp: Date.now(),
    event,
    payload,
  };

  eventLog.value = [entry, ...eventLog.value].slice(0, maxEvents.value);
}

function clearLog() {
  eventLog.value = [];
}

function toggleEventExpanded(id: number) {
  toggleSetValue(expandedEvents, id, { pushHistory: true });
}

async function copyToClipboard(text: string, itemId: string) {
  try {
    await navigator.clipboard.writeText(text);
    copiedItem.value = itemId;
    setTimeout(() => {
      if (copiedItem.value === itemId) {
        copiedItem.value = null;
      }
    }, 2000);
  } catch {
    // Ignore clipboard errors
  }
}

// ============================================
// Info Row Component
// ============================================

interface InfoRowProps {
  icon: typeof Server;
  label: string;
  value: string | null | undefined;
  copyable?: boolean;
  mono?: boolean;
}

function InfoRow({ icon: Icon, label, value, copyable, mono }: InfoRowProps) {
  const displayValue = value ?? "—";
  const itemId = `${label}-${displayValue}`;
  const isCopied = copiedItem.value === itemId;

  return (
    <div class="flex flex-col sm:flex-row sm:items-center justify-between py-2 gap-1 sm:gap-2 border-b border-[var(--color-border)] last:border-0">
      <div class="flex items-center gap-2 text-[var(--color-text-muted)]">
        <Icon size={16} class="flex-shrink-0" />
        <span class="text-sm">{label}</span>
      </div>
      <div class="flex items-center gap-2 pl-6 sm:pl-0">
        <span class={`${mono ? "font-mono text-sm" : ""} break-all`}>{displayValue}</span>
        {copyable && value && (
          <IconButton
            icon={isCopied ? <Check size={14} /> : <Copy size={14} />}
            size="sm"
            variant="ghost"
            label={t("actions.copy")}
            onClick={() => copyToClipboard(value, itemId)}
            class="flex-shrink-0"
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// Event Log Entry Component
// ============================================

interface EventEntryProps {
  entry: EventLogEntry;
  expanded: boolean;
  onToggle: () => void;
}

/** Mobile-only event card */
function MobileEventCard({ entry }: { entry: EventLogEntry }) {
  const hasPayload = entry.payload != null && Object.keys(entry.payload as object).length > 0;

  return (
    <button
      type="button"
      class="w-full flex items-center justify-between gap-3 p-3 text-left bg-[var(--color-bg-secondary)] rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
      onClick={() => {
        mobileEventModal.value = entry;
      }}
      aria-label={t("debug.viewEventDetails", { event: entry.event })}
    >
      <div class="min-w-0">
        <Badge variant="default" class="font-mono text-xs mb-1">
          {entry.event}
        </Badge>
        <div class="text-xs text-[var(--color-text-muted)]">
          {new Date(entry.timestamp).toLocaleTimeString()}
        </div>
      </div>
      {hasPayload && (
        <ChevronRight size={16} class="text-[var(--color-text-muted)] flex-shrink-0" />
      )}
    </button>
  );
}

/** Desktop expandable event row */
function EventEntry({ entry, expanded, onToggle }: EventEntryProps) {
  const hasPayload = entry.payload != null && Object.keys(entry.payload as object).length > 0;
  const payloadStr = formatJson(entry.payload);
  const itemId = `event-${entry.id}`;

  return (
    <div class="border-b border-[var(--color-border)] last:border-0">
      <button
        type="button"
        class="w-full flex items-center gap-2 py-2 px-3 text-left hover:bg-[var(--color-bg-hover)] transition-colors"
        onClick={onToggle}
        disabled={!hasPayload}
        aria-expanded={expanded}
        aria-label={`${entry.event} event, ${hasPayload ? t("debug.clickToExpand") : t("debug.noPayload")}`}
      >
        {hasPayload ? (
          expanded ? (
            <ChevronDown size={14} class="text-[var(--color-text-muted)]" />
          ) : (
            <ChevronRight size={14} class="text-[var(--color-text-muted)]" />
          )
        ) : (
          <span class="w-[14px]" />
        )}
        <span class="text-xs text-[var(--color-text-muted)] w-20 shrink-0">
          {new Date(entry.timestamp).toLocaleTimeString()}
        </span>
        <Badge variant="default" class="font-mono text-xs">
          {entry.event}
        </Badge>
      </button>

      {expanded && hasPayload && (
        <div class="px-3 pb-3">
          <JsonBlock value={payloadStr} id={itemId} />
        </div>
      )}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function DebugView(_props: RouteProps) {
  // URL query params (note: event IDs are ephemeral, mainly useful for back/forward)
  const eventsReady = eventLog.value.length > 0;
  const [expandedParam, setExpandedParam, expandedInitialized] = useQueryParamSet<number>("event", {
    ready: eventsReady,
  });

  // Sync URL → expanded events
  useEffect(() => {
    if (eventsReady && expandedParam.value.size > 0) {
      const validIds = Array.from(expandedParam.value).filter((id) =>
        eventLog.value.some((e) => e.id === id),
      );
      if (validIds.length > 0) {
        const newIds = validIds.filter((id) => !expandedEvents.value.has(id));
        if (newIds.length > 0) {
          expandedEvents.value = new Set([...expandedEvents.value, ...validIds]);
          // Scroll to first new one
          setTimeout(() => {
            const els = document.querySelectorAll(`[data-event-id="${newIds[0]}"]`);
            const el = Array.from(els).find((e) => (e as HTMLElement).offsetParent !== null);
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 100);
        }
      }
    }
  }, [expandedParam.value, eventsReady]);

  // Sync expanded → URL
  useEffect(() => {
    if (expandedInitialized.value) {
      setExpandedParam(expandedEvents.value);
    }
  }, [expandedEvents.value, expandedInitialized.value]);

  // Subscribe to gateway events
  useEffect(() => {
    const unsubscribe = subscribe((event: GatewayEvent) => {
      addEvent(event.event, event.payload);
    });

    return unsubscribe;
  }, []);

  // Update uptime display periodically
  useEffect(() => {
    const interval = setInterval(() => {
      uptimeTick.value++;
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const connected = isConnected.value;
  const state = connectionState.value;

  return (
    <PageLayout viewName={t("common.debug")}>
      <PageHeader
        title={t("common.debug")}
        subtitle={t("debug.subtitle")}
        actions={
          <Badge variant={connectionBadgeVariant.value}>
            {connected ? <Wifi size={14} class="mr-1" /> : <WifiOff size={14} class="mr-1" />}
            {state}
          </Badge>
        }
      />
      {/* Connection & Server Info */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Connection Info */}
        <Card>
          <div class="flex items-center gap-2 mb-4">
            <Wifi
              size={18}
              class={connected ? "text-[var(--color-success)]" : "text-[var(--color-error)]"}
            />
            <h2 class="font-medium">{t("debug.connection")}</h2>
          </div>
          <div class="space-y-0">
            <InfoRow icon={Activity} label={t("debug.state")} value={state} />
            <InfoRow icon={Zap} label={t("common.url")} value={gatewayUrl.value} copyable mono />
            <InfoRow
              icon={Key}
              label={t("debug.sessionKey")}
              value={mainSessionKey.value}
              copyable
              mono
            />
            <InfoRow
              icon={RefreshCw}
              label={t("debug.reconnectAttempts")}
              value={String(reconnectAttempt.value)}
            />
            <InfoRow
              icon={Clock}
              label={t("debug.connectedAt")}
              value={connectedAt.value ? formatTimestamp(connectedAt.value) : null}
            />
          </div>
        </Card>

        {/* Server Info */}
        <Card>
          <div class="flex items-center gap-2 mb-4">
            <Server size={18} class="text-[var(--color-primary)]" />
            <h2 class="font-medium">{t("debug.server")}</h2>
          </div>
          <div class="space-y-0">
            <InfoRow icon={Server} label={t("common.version")} value={gatewayVersion.value} />
            <InfoRow icon={Monitor} label={t("common.host")} value={gatewayHost.value} />
            <InfoRow
              icon={FileText}
              label={t("common.commit")}
              value={gatewayCommit.value?.slice(0, 8)}
              copyable
              mono
            />
            <InfoRow icon={Clock} label={t("common.uptime")} value={formattedUptime.value} />
            <InfoRow
              icon={Clock}
              label={t("debug.tickInterval")}
              value={tickIntervalMs.value ? `${tickIntervalMs.value}ms` : null}
            />
          </div>
        </Card>

        {/* Paths Info */}
        <Card>
          <div class="flex items-center gap-2 mb-4">
            <Folder size={18} class="text-[var(--color-warning)]" />
            <h2 class="font-medium">{t("debug.paths")}</h2>
          </div>
          <div class="space-y-0">
            <InfoRow
              icon={FileText}
              label={t("debug.configPath")}
              value={gatewayConfigPath.value}
              copyable
              mono
            />
            <InfoRow
              icon={Folder}
              label={t("debug.stateDir")}
              value={gatewayStateDir.value}
              copyable
              mono
            />
          </div>
        </Card>

        {/* Client Info */}
        <Card>
          <div class="flex items-center gap-2 mb-4">
            <Monitor size={18} class="text-[var(--color-info)]" />
            <h2 class="font-medium">{t("debug.client")}</h2>
          </div>
          <div class="space-y-0">
            <InfoRow icon={Monitor} label={t("debug.appVersion")} value={__APP_VERSION__} />
            <InfoRow icon={Monitor} label={t("common.platform")} value={navigator.platform} />
            <InfoRow
              icon={Monitor}
              label={t("debug.userAgent")}
              value={navigator.userAgent.slice(0, 60) + "..."}
            />
            <InfoRow
              icon={Users}
              label={t("debug.presenceCount")}
              value={String(presence.value.length)}
            />
          </div>
        </Card>
      </div>

      {/* Snapshots & Manual RPC - Side by side on larger screens */}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <SnapshotsPanel />
        <ManualRpcPanel />
      </div>

      {/* Event Log - at bottom so it doesn't push other cards around */}
      <Card>
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div class="flex items-center gap-2">
            <Activity size={18} class="text-[var(--color-accent)]" />
            <h2 class="font-medium">{t("debug.eventLog")}</h2>
            <Badge variant="default">{eventLog.value.length}</Badge>
          </div>
          <div class="flex items-center gap-2">
            <Toggle
              checked={!isPaused.value}
              onChange={(checked) => {
                isPaused.value = !checked;
              }}
              label={isPaused.value ? t("common.paused") : t("debug.recording")}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={clearLog}
              disabled={eventLog.value.length === 0}
              icon={<Trash2 size={14} />}
            >
              <span class="hidden sm:inline">{t("common.clear")}</span>
            </Button>
          </div>
        </div>

        {eventLog.value.length === 0 ? (
          <div class="text-center py-8 text-[var(--color-text-muted)]">
            <Activity size={32} class="mx-auto mb-2 opacity-50" />
            <p>{t("debug.noEvents")}</p>
            <p class="text-sm mt-1">{t("debug.noEventsHint")}</p>
          </div>
        ) : (
          <>
            {/* Mobile: Card list */}
            <div class="md:hidden space-y-2 max-h-96 overflow-y-auto">
              {eventLog.value.map((entry) => (
                <div key={entry.id} data-event-id={entry.id}>
                  <MobileEventCard entry={entry} />
                </div>
              ))}
            </div>

            {/* Desktop: Expandable rows */}
            <div class="hidden md:block max-h-96 overflow-y-auto border border-[var(--color-border)] rounded-lg">
              {eventLog.value.map((entry) => (
                <div key={entry.id} data-event-id={entry.id}>
                  <EventEntry
                    entry={entry}
                    expanded={expandedEvents.value.has(entry.id)}
                    onToggle={() => toggleEventExpanded(entry.id)}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Mobile event detail modal */}
      <Modal
        open={!!mobileEventModal.value}
        onClose={() => {
          mobileEventModal.value = null;
        }}
        title={mobileEventModal.value?.event || ""}
      >
        {mobileEventModal.value && (
          <div class="space-y-3">
            <div class="text-sm text-[var(--color-text-muted)]">
              {new Date(mobileEventModal.value.timestamp).toLocaleString()}
            </div>
            {mobileEventModal.value.payload != null &&
            Object.keys(mobileEventModal.value.payload as object).length > 0 ? (
              <JsonBlock
                value={formatJson(mobileEventModal.value.payload)}
                maxHeight="max-h-[60vh]"
                id={`mobile-event-${mobileEventModal.value.id}`}
              />
            ) : (
              <p class="text-sm text-[var(--color-text-muted)]">{t("debug.noPayload")}</p>
            )}
          </div>
        )}
      </Modal>
    </PageLayout>
  );
}
