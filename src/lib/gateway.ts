/**
 * Gateway WebSocket Client
 *
 * Connects to OpenClaw gateway and handles:
 * - Authentication (password or token)
 * - Request/response RPC
 * - Event streaming
 * - Auto-reconnect with exponential backoff
 *
 * Usage:
 *   import { gateway, connect, disconnect, send } from '@/lib/gateway'
 *
 *   await connect({ url: 'ws://localhost:8095', password: 'secret' })
 *   const result = await send('session.list', { limit: 10 })
 *   gateway.events.subscribe(ev => console.log(ev))
 */

import { signal, computed } from "@preact/signals";
import type {
  GatewayMessage,
  GatewayRequest,
  GatewayResponse,
  GatewayEvent,
  AuthConfig,
  HelloPayload,
} from "@/types/gateway";

// ============================================
// Configuration
// ============================================

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

/** Current session key */
export const sessionKey = signal<string | null>(null);

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

  /** Auth mode */
  authMode?: "password" | "token";

  /** Password (if authMode is 'password') */
  password?: string;

  /** Token (if authMode is 'token') */
  token?: string;

  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
}

export interface RequestOptions {
  /** Timeout in ms (default: 30000) */
  timeout?: number;
}

// ============================================
// Connection Management
// ============================================

/**
 * Connect to the gateway
 */
export async function connect(config: ConnectConfig): Promise<HelloPayload> {
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
        authenticate(config)
          .then((hello) => {
            connectionState.value = "connected";
            gatewayVersion.value = hello.version ?? null;
            sessionKey.value = hello.sessionKey ?? null;
            capabilities.value = hello.capabilities ?? [];
            startHeartbeat();
            resolve(hello);
          })
          .catch((err) => {
            lastError.value = err.message;
            disconnect();
            reject(err);
          });
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as GatewayMessage;
          handleMessage(msg);
        } catch (err) {
          console.error("[gateway] Failed to parse message:", err);
        }
      };

      ws.onerror = () => {
        // Error details are limited in browser WebSocket API
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
  sessionKey.value = null;
  capabilities.value = [];
}

/**
 * Authenticate with the gateway
 */
async function authenticate(config: ConnectConfig): Promise<HelloPayload> {
  const auth: AuthConfig = {
    mode: config.authMode ?? (config.token ? "token" : "password"),
    password: config.password,
    token: config.token,
  };

  const result = await send<HelloPayload>("auth.hello", { auth });
  return result;
}

// ============================================
// Request/Response RPC
// ============================================

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

    const request: GatewayRequest = {
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
      handleResponse(msg);
      break;
    case "event":
      handleEvent(msg);
      break;
    default:
      console.warn("[gateway] Unknown message type:", msg);
  }
}

/**
 * Handle a response message
 */
function handleResponse(res: GatewayResponse): void {
  const pending = pendingRequests.get(res.id);
  if (!pending) {
    console.warn("[gateway] Received response for unknown request:", res.id);
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
      console.error("[gateway] Event handler error:", err);
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

  console.log(
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

  /** Session key */
  sessionKey,

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
