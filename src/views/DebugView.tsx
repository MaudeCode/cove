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
import type { RouteProps } from "@/types/routes";
import type { GatewayEvent } from "@/types/gateway";
import { SnapshotsPanel } from "@/components/debug/SnapshotsPanel";
import { ManualRpcPanel } from "@/components/debug/ManualRpcPanel";

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

/** Expanded event IDs */
const expandedEvents = signal<Set<number>>(new Set());

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

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
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
  const current = new Set(expandedEvents.value);
  if (current.has(id)) {
    current.delete(id);
  } else {
    current.add(id);
  }
  expandedEvents.value = current;
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

function formatPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
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
    <div class="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
      <div class="flex items-center gap-2 text-[var(--color-text-muted)]">
        <Icon size={16} />
        <span>{label}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class={mono ? "font-mono text-sm" : ""}>{displayValue}</span>
        {copyable && value && (
          <IconButton
            icon={isCopied ? <Check size={14} /> : <Copy size={14} />}
            size="sm"
            variant="ghost"
            label={t("actions.copy")}
            onClick={() => copyToClipboard(value, itemId)}
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

function EventEntry({ entry, expanded, onToggle }: EventEntryProps) {
  const hasPayload = entry.payload != null && Object.keys(entry.payload as object).length > 0;
  const payloadStr = formatPayload(entry.payload);
  const itemId = `event-${entry.id}`;
  const isCopied = copiedItem.value === itemId;

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
          <div class="relative">
            <pre class="text-xs font-mono bg-[var(--color-bg-tertiary)] p-3 rounded-lg overflow-x-auto max-h-48">
              {payloadStr}
            </pre>
            <IconButton
              icon={isCopied ? <Check size={14} /> : <Copy size={14} />}
              size="sm"
              variant="ghost"
              label={t("actions.copy")}
              class="absolute top-2 right-2"
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(payloadStr, itemId);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function DebugView(_props: RouteProps) {
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
    <div class="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div class="p-6 border-b border-[var(--color-border)]">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-xl font-semibold">{t("nav.debug")}</h1>
            <p class="text-sm text-[var(--color-text-muted)] mt-1">{t("debug.subtitle")}</p>
          </div>
          <div class="flex items-center gap-2">
            <Badge variant={connectionBadgeVariant.value}>
              {connected ? <Wifi size={14} class="mr-1" /> : <WifiOff size={14} class="mr-1" />}
              {state}
            </Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-6">
        <div class="max-w-5xl mx-auto space-y-6">
          {/* Connection & Server Info */}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                <InfoRow icon={Zap} label={t("debug.url")} value={gatewayUrl.value} copyable mono />
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
                <InfoRow icon={Server} label={t("debug.version")} value={gatewayVersion.value} />
                <InfoRow icon={Monitor} label={t("debug.host")} value={gatewayHost.value} />
                <InfoRow
                  icon={FileText}
                  label={t("debug.commit")}
                  value={gatewayCommit.value?.slice(0, 8)}
                  copyable
                  mono
                />
                <InfoRow icon={Clock} label={t("debug.uptime")} value={formattedUptime.value} />
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
                <InfoRow icon={Monitor} label={t("debug.platform")} value={navigator.platform} />
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
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SnapshotsPanel />
            <ManualRpcPanel />
          </div>

          {/* Event Log - at bottom so it doesn't push other cards around */}
          <Card>
            <div class="flex items-center justify-between mb-4">
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
                  label={isPaused.value ? t("debug.paused") : t("debug.recording")}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearLog}
                  disabled={eventLog.value.length === 0}
                  icon={<Trash2 size={14} />}
                >
                  {t("debug.clear")}
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
              <div class="max-h-96 overflow-y-auto border border-[var(--color-border)] rounded-lg">
                {eventLog.value.map((entry) => (
                  <EventEntry
                    key={entry.id}
                    entry={entry}
                    expanded={expandedEvents.value.has(entry.id)}
                    onToggle={() => toggleEventExpanded(entry.id)}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
