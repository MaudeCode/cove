/**
 * Gateway WebSocket Client
 *
 * Connects to OpenClaw gateway and handles:
 * - Authentication (password or token)
 * - Request/response RPC
 * - Event streaming
 * - Auto-reconnect with exponential backoff
 *
 * Protocol:
 * 1. Server sends connect.challenge event with { nonce, ts }
 * 2. Client sends connect request with ConnectParams
 * 3. Server responds with hello-ok payload
 */

import { signal, computed } from "@preact/signals";
import type { GatewayMessage, GatewayResponse, GatewayEvent, HelloPayload } from "@/types/gateway";
import { log } from "./logger";

// ============================================
// Configuration
// ============================================

const PROTOCOL_VERSION = 3;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const RECONNECT_MULTIPLIER = 1.5;
const REQUEST_TIMEOUT_MS = 30000;
const HEARTBEAT_INTERVAL_MS = 30000;

// ============================================
// State Signals
// ============================================

type ConnectionState =
  | "disconnected"
  | "connecting"
  | "authenticating"
  | "connected"
  | "reconnecting";

/** Current connection state */
export const connectionState = signal<ConnectionState>("disconnected");

/** Whether we're fully connected and authenticated */
export const isConnected = computed(() => connectionState.value === "connected");

/** Whether this is the initial page load (before first connection attempt) */
const isInitialLoad = signal(true);

/** Last error message */
export const lastError = signal<string | null>(null);

/** Gateway version (from hello response) */
export const gatewayVersion = signal<string | null>(null);

/** Gateway URL (from connect config) */
export const gatewayUrl = signal<string | null>(null);

/** Current connection ID */
const connectionId = signal<string | null>(null);

/**
 * Main session key from gateway (e.g., "agent:main:main")
 *
 * IMPORTANT: This is the actual session key to use for chat operations.
 * Passing just "main" to chat.send will NOT work correctly — the gateway
 * routes based on this full key. See docs/SESSION_ROUTING.md for details.
 */
export const mainSessionKey = signal<string | null>(null);

/** Gateway capabilities (available methods) */
const capabilities = signal<string[]>([]);

/** Reconnect attempt count */
export const reconnectAttempt = signal<number>(0);

/** Server commit hash */
export const gatewayCommit = signal<string | null>(null);

/** Server host name */
export const gatewayHost = signal<string | null>(null);

/** Tick interval from gateway policy (ms) */
export const tickIntervalMs = signal<number | null>(null);

/** Connected at timestamp */
export const connectedAt = signal<number | null>(null);

/** Gateway uptime at connection time (ms) */
export const gatewayUptimeMs = signal<number | null>(null);

/** Config path on the gateway */
export const gatewayConfigPath = signal<string | null>(null);

/** State directory on the gateway */
export const gatewayStateDir = signal<string | null>(null);

/** Presence list (connected clients) */
export const presence = signal<unknown[]>([]);

/** Computed gateway uptime (updates based on initial snapshot + elapsed time) */
export const gatewayUptime = computed(() => {
  const startUptime = gatewayUptimeMs.value;
  const connected = connectedAt.value;
  if (startUptime == null || connected == null) return null;

  const elapsed = Date.now() - connected;
  return startUptime + elapsed;
});

// ============================================
// Internal State
// ============================================

let ws: WebSocket | null = null;
let currentConfig: ConnectConfig | null = null;
let requestId = 0;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

// Pending requests waiting for responses
const pendingRequests = new Map<
  string,
  {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }
>();

// Event subscribers
export type EventHandler = (event: GatewayEvent) => void;
const eventHandlers = new Set<EventHandler>();

// ============================================
// Types
// ============================================

export interface ConnectConfig {
  /** WebSocket URL (ws:// or wss://) */
  url: string;

  /** Auth token */
  token?: string;

  /** Auth password */
  password?: string;

  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
}

// ============================================
// Connection Management
// ============================================

/** Probe timeout in milliseconds */
const PROBE_TIMEOUT_MS = 5000;

export interface ProbeResult {
  /** Whether the probe succeeded */
  ok: boolean;
  /** Error message if probe failed */
  error?: string;
  /** Gateway version (if available from challenge) */
  version?: string;
}

/**
 * Probe a gateway URL to check if it's a valid OpenClaw gateway.
 * Opens a WebSocket, waits for connect.challenge event, then closes.
 * Does not authenticate.
 *
 * @param url - WebSocket URL to probe
 * @param signal - Optional AbortSignal to cancel the probe
 */
export function probeGateway(url: string, signal?: AbortSignal): Promise<ProbeResult> {
  return new Promise((resolve) => {
    // Check if already aborted
    if (signal?.aborted) {
      resolve({ ok: false, error: "Aborted" });
      return;
    }

    let probeWs: WebSocket | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let resolved = false;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (probeWs) {
        probeWs.onopen = null;
        probeWs.onmessage = null;
        probeWs.onerror = null;
        probeWs.onclose = null;
        probeWs.close();
        probeWs = null;
      }
    };

    const fail = (error: string) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve({ ok: false, error });
    };

    const succeed = (version?: string) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve({ ok: true, version });
    };

    // Handle abort signal
    signal?.addEventListener("abort", () => {
      fail("Aborted");
    });

    // Timeout handler
    timeoutId = setTimeout(() => {
      fail("Connection timed out");
    }, PROBE_TIMEOUT_MS);

    try {
      probeWs = new WebSocket(url);

      probeWs.onopen = () => {
        log.gateway.debug("Probe: WebSocket opened, waiting for challenge...");
      };

      probeWs.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          // Check if it's a connect.challenge event
          if (msg.type === "evt" && msg.event === "connect.challenge") {
            log.gateway.debug("Probe: Received connect.challenge, gateway is valid");
            succeed(msg.payload?.version);
          } else {
            // Got some other message - still likely a gateway, but unexpected
            log.gateway.debug("Probe: Received unexpected message:", msg.type, msg.event);
            succeed();
          }
        } catch {
          fail("Invalid response from server");
        }
      };

      probeWs.onerror = () => {
        fail("Connection failed");
      };

      probeWs.onclose = (event) => {
        if (!event.wasClean) {
          fail("Connection closed unexpectedly");
        }
      };
    } catch (err) {
      fail(err instanceof Error ? err.message : "Failed to connect");
    }
  });
}

/**
 * Connect to the gateway
 */
export function connect(config: ConnectConfig): Promise<HelloPayload> {
  // Track if this is a reconnect attempt before any cleanup
  const isReconnectAttempt = reconnectAttempt.value > 0;

  // Clean up existing connection - but don't use disconnect() during reconnect
  // as it resets reconnectAttempt and other state we want to preserve
  if (ws) {
    if (isReconnectAttempt) {
      // Just close the socket without full disconnect
      ws.onclose = null;
      ws.close();
      ws = null;
    } else {
      disconnect();
    }
  }

  currentConfig = config;
  connectionState.value = "connecting";
  isInitialLoad.value = false;
  lastError.value = null;
  // Only reset attempt counter for fresh connections, not reconnects
  if (!isReconnectAttempt) {
    reconnectAttempt.value = 0;
  }
  gatewayUrl.value = config.url;

  return new Promise((resolve, reject) => {
    try {
      ws = new WebSocket(config.url);

      ws.onopen = () => {
        connectionState.value = "authenticating";
        // Wait for connect.challenge event before sending connect request
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as GatewayMessage;

          // Handle connect.challenge event during authentication
          if (
            connectionState.value === "authenticating" &&
            msg.type === "event" &&
            msg.event === "connect.challenge"
          ) {
            // Note: msg.payload contains { nonce, ts } for future HMAC auth

            // Now send the connect request
            sendConnectRequest(config)
              .then((hello) => {
                connectionState.value = "connected";
                connectedAt.value = Date.now();

                // Server info
                gatewayVersion.value = hello.server?.version ?? null;
                gatewayCommit.value = hello.server?.commit ?? null;
                gatewayHost.value = hello.server?.host ?? null;
                connectionId.value = hello.server?.connId ?? null;

                // Features & policy
                capabilities.value = hello.features?.methods ?? [];
                tickIntervalMs.value = hello.policy?.tickIntervalMs ?? null;

                // Snapshot data
                presence.value = hello.snapshot?.presence ?? [];
                gatewayUptimeMs.value = hello.snapshot?.uptimeMs ?? null;
                gatewayConfigPath.value = hello.snapshot?.configPath ?? null;
                gatewayStateDir.value = hello.snapshot?.stateDir ?? null;

                // Capture main session key from snapshot
                const sessionDefaults = hello.snapshot?.sessionDefaults;
                if (sessionDefaults?.mainSessionKey) {
                  mainSessionKey.value = sessionDefaults.mainSessionKey;
                  log.gateway.info("Main session key:", mainSessionKey.value);
                }

                startHeartbeat();
                resolve(hello);
              })
              .catch((err) => {
                lastError.value = err.message;
                disconnect();
                reject(err);
              });
            return;
          }

          handleMessage(msg);
        } catch (err) {
          log.gateway.error(" Failed to parse message:", err);
        }
      };

      ws.onerror = () => {
        lastError.value = "WebSocket error";
      };

      ws.onclose = (_event) => {
        const state = connectionState.value;
        const wasConnected = state === "connected";
        const wasReconnecting = reconnectAttempt.value > 0;
        stopHeartbeat();
        clearPendingRequests(new Error("Connection closed"));

        // Schedule reconnect if:
        // 1. We were connected and autoReconnect is enabled, OR
        // 2. We were already in a reconnect attempt (keep trying)
        if ((wasConnected || wasReconnecting) && currentConfig?.autoReconnect !== false) {
          scheduleReconnect();
        } else {
          connectionState.value = "disconnected";
        }
      };
    } catch (err) {
      connectionState.value = "disconnected";
      lastError.value = err instanceof Error ? err.message : "Failed to connect";
      reject(err);
    }
  });
}

/**
 * Send the connect request with proper protocol params
 */
async function sendConnectRequest(config: ConnectConfig): Promise<HelloPayload> {
  const params = {
    minProtocol: PROTOCOL_VERSION,
    maxProtocol: PROTOCOL_VERSION,
    client: {
      id: "webchat",
      displayName: "Cove",
      version: __APP_VERSION__,
      platform: getBrowserPlatform(),
      mode: "webchat",
    },
    role: "operator",
    scopes: ["operator.admin", "operator.read", "operator.write"],
    auth: {} as { token?: string; password?: string },
  };

  if (config.token) {
    params.auth.token = config.token;
  } else if (config.password) {
    params.auth.password = config.password;
  }

  const result = await send<HelloPayload>("connect", params);
  return result;
}

/**
 * Get browser platform string
 */
function getBrowserPlatform(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Mac")) return "macos";
  if (ua.includes("Windows")) return "windows";
  if (ua.includes("Linux")) return "linux";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "ios";
  if (ua.includes("Android")) return "android";
  return "web";
}

/**
 * Disconnect from the gateway
 */
export function disconnect(): void {
  currentConfig = null;
  stopHeartbeat();
  cancelReconnect();
  clearPendingRequests(new Error("Disconnected"));

  if (ws) {
    ws.onclose = null; // Prevent reconnect
    ws.close();
    ws = null;
  }

  connectionState.value = "disconnected";
  connectedAt.value = null;
  gatewayVersion.value = null;
  gatewayCommit.value = null;
  gatewayHost.value = null;
  gatewayUrl.value = null;
  connectionId.value = null;
  mainSessionKey.value = null;
  capabilities.value = [];
  tickIntervalMs.value = null;
  presence.value = [];
}

// ============================================
// Request/Response RPC
// ============================================

export interface RequestOptions {
  /** Timeout in ms (default: 30000) */
  timeout?: number;
}

/**
 * Send a request to the gateway
 */
export function send<T = unknown>(
  method: string,
  params?: unknown,
  options?: RequestOptions,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error("Not connected"));
      return;
    }

    const id = `req_${++requestId}`;
    const timeout = options?.timeout ?? REQUEST_TIMEOUT_MS;

    const request = {
      type: "req",
      id,
      method,
      params,
    };

    const timeoutHandle = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Request timeout: ${method}`));
    }, timeout);

    pendingRequests.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
      timeout: timeoutHandle,
    });

    ws.send(JSON.stringify(request));
  });
}

/**
 * Handle incoming messages
 */
function handleMessage(msg: GatewayMessage): void {
  switch (msg.type) {
    case "res":
      handleResponse(msg as GatewayResponse);
      break;
    case "event":
      handleEvent(msg as GatewayEvent);
      break;
    default:
      log.gateway.warn(" Unknown message type:", msg);
  }
}

/**
 * Handle a response message
 */
function handleResponse(res: GatewayResponse): void {
  const pending = pendingRequests.get(res.id);
  if (!pending) {
    log.gateway.warn(" Received response for unknown request:", res.id);
    return;
  }

  pendingRequests.delete(res.id);
  clearTimeout(pending.timeout);

  if (res.ok) {
    pending.resolve(res.payload);
  } else {
    pending.reject(new Error(res.error?.message ?? "Request failed"));
  }
}

/**
 * Handle an event message
 */
function handleEvent(event: GatewayEvent): void {
  log.gateway.debug("Event received:", event.event);

  // Notify all subscribers
  for (const handler of eventHandlers) {
    try {
      handler(event);
    } catch (err) {
      log.gateway.error(" Event handler error:", err);
    }
  }
}

/**
 * Clear all pending requests with an error
 */
function clearPendingRequests(error: Error): void {
  for (const [_id, pending] of pendingRequests) {
    clearTimeout(pending.timeout);
    pending.reject(error);
  }
  pendingRequests.clear();
}

// ============================================
// Event Subscription
// ============================================

/**
 * Subscribe to gateway events
 */
export function subscribe(handler: EventHandler): () => void {
  eventHandlers.add(handler);
  return () => eventHandlers.delete(handler);
}

/**
 * Subscribe to events of a specific type
 */
export function on(eventType: string, handler: (payload: unknown) => void): () => void {
  const wrapper: EventHandler = (event) => {
    if (event.event === eventType) {
      handler(event.payload);
    }
  };
  return subscribe(wrapper);
}

// ============================================
// Heartbeat
// ============================================

let consecutiveHeartbeatFailures = 0;
const MAX_HEARTBEAT_FAILURES = 3;

function startHeartbeat(): void {
  stopHeartbeat();
  consecutiveHeartbeatFailures = 0;
  heartbeatTimer = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      send("health")
        .then(() => {
          consecutiveHeartbeatFailures = 0;
        })
        .catch((err) => {
          consecutiveHeartbeatFailures++;
          log.gateway.warn(
            `Heartbeat failed (${consecutiveHeartbeatFailures}/${MAX_HEARTBEAT_FAILURES}):`,
            err instanceof Error ? err.message : String(err),
          );
          if (consecutiveHeartbeatFailures >= MAX_HEARTBEAT_FAILURES) {
            log.gateway.error(
              "Too many consecutive heartbeat failures, connection may be unhealthy",
            );
          }
        });
    }
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ============================================
// Auto-Reconnect
// ============================================

function scheduleReconnect(): void {
  if (!currentConfig || reconnectTimer) return;

  connectionState.value = "reconnecting";
  reconnectAttempt.value++;

  const delay = Math.min(
    RECONNECT_BASE_MS * Math.pow(RECONNECT_MULTIPLIER, reconnectAttempt.value - 1),
    RECONNECT_MAX_MS,
  );

  log.gateway.info(
    `[gateway] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttempt.value})`,
  );

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (!currentConfig) return;

    try {
      await connect(currentConfig);
    } catch {
      // connect() will schedule another reconnect on failure
    }
  }, delay);
}

function cancelReconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectAttempt.value = 0;
}

// ============================================
// Utility Exports
// ============================================

/**
 * Gateway client object for convenient access
 */
export const gateway = {
  /** Connection state signal */
  state: connectionState,

  /** Whether connected */
  isConnected,

  /** Last error */
  error: lastError,

  /** Gateway version */
  version: gatewayVersion,

  /** Gateway commit hash */
  commit: gatewayCommit,

  /** Gateway host name */
  host: gatewayHost,

  /** Gateway URL */
  url: gatewayUrl,

  /** Connection ID */
  connectionId,

  /** Main session key (from gateway) */
  mainSessionKey,

  /** Capabilities (available methods) */
  capabilities,

  /** Tick interval (ms) */
  tickIntervalMs,

  /** Connected at timestamp */
  connectedAt,

  /** Presence list */
  presence,

  /** Reconnect attempt count */
  reconnectAttempt,

  /** Connect to gateway */
  connect,

  /** Disconnect from gateway */
  disconnect,

  /** Send request */
  send,

  /** Subscribe to all events */
  subscribe,

  /** Subscribe to specific event type */
  on,
};

// Named export only (no default)
