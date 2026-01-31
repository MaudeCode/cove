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

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "authenticating"
  | "connected"
  | "reconnecting";

/** Current connection state */
export const connectionState = signal<ConnectionState>("disconnected");

/** Whether we're fully connected and authenticated */
export const isConnected = computed(() => connectionState.value === "connected");

/** Last error message */
export const lastError = signal<string | null>(null);

/** Gateway version (from hello response) */
export const gatewayVersion = signal<string | null>(null);

/** Current connection ID */
export const connectionId = signal<string | null>(null);

/** Main session key from gateway (e.g., "agent:main:main") */
export const mainSessionKey = signal<string | null>(null);

/** Gateway capabilities */
export const capabilities = signal<string[]>([]);

/** Reconnect attempt count */
export const reconnectAttempt = signal<number>(0);

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
type EventHandler = (event: GatewayEvent) => void;
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

/**
 * Connect to the gateway
 */
export function connect(config: ConnectConfig): Promise<HelloPayload> {
  // Clean up existing connection
  if (ws) {
    disconnect();
  }

  currentConfig = config;
  connectionState.value = "connecting";
  lastError.value = null;
  reconnectAttempt.value = 0;

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
                gatewayVersion.value = hello.server?.version ?? null;
                connectionId.value = hello.server?.connId ?? null;
                capabilities.value = hello.features?.methods ?? [];

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
        const wasConnected = connectionState.value === "connected";
        stopHeartbeat();
        clearPendingRequests(new Error("Connection closed"));

        if (wasConnected && currentConfig?.autoReconnect !== false) {
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
      version: "0.1.0",
      platform: getBrowserPlatform(),
      mode: "webchat",
    },
    role: "operator",
    scopes: ["operator.read", "operator.write"],
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
  gatewayVersion.value = null;
  connectionId.value = null;
  mainSessionKey.value = null;
  capabilities.value = [];
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

function startHeartbeat(): void {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      send("ping").catch(() => {
        // Ignore ping errors
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

  /** Connection ID */
  connectionId,

  /** Main session key (from gateway) */
  mainSessionKey,

  /** Capabilities */
  capabilities,

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
