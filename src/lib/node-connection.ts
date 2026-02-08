/**
 * Node Connection
 *
 * Secondary WebSocket connection to the gateway as a "node" role.
 * Allows Cove to receive canvas commands from the agent.
 */

import { signal } from "@preact/signals";
import { gatewayUrl } from "./gateway";
import { getAuth, getSessionCredential } from "./storage";
import { log } from "./logger";

// Connection state
export const nodeConnected = signal(false);
export const nodePairingStatus = signal<"unpaired" | "pending" | "paired">("unpaired");
export const nodeId = signal<string | null>(null);

// Canvas state
export const canvasVisible = signal(false);
export const canvasUrl = signal<string | null>(null);
export const canvasContent = signal<string | null>(null);
export const canvasBlobUrl = signal<string | null>(null);
export const canvasContentType = signal<string | null>(null);
export const standaloneCanvasOpen = signal(false);

// Cross-tab broadcast for canvas content
const canvasChannel =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("cove:canvas") : null;

// Store last base64 for cross-tab sharing (blob URLs can't be shared)
let lastBase64: string | null = null;
let lastBase64Mime: string | null = null;

function broadcastCanvasContent() {
  canvasChannel?.postMessage({
    type: "canvas-content",
    url: canvasUrl.value,
    base64: lastBase64,
    mimeType: lastBase64Mime,
  });
}

// Handle incoming content from other tabs
canvasChannel?.addEventListener("message", (e) => {
  if (e.data.type === "canvas-content") {
    if (e.data.url) {
      canvasUrl.value = e.data.url;
      canvasBlobUrl.value = null;
    } else if (e.data.base64) {
      try {
        const blobUrl = createBlobUrlFromBase64(e.data.base64, e.data.mimeType || "image/png");
        canvasBlobUrl.value = blobUrl;
        canvasContentType.value = e.data.mimeType;
        canvasUrl.value = null;
      } catch {
        // Ignore errors
      }
    }
  }
  // Handle standalone canvas status
  if (e.data.type === "canvas-standalone-status") {
    const wasOpen = standaloneCanvasOpen.value;
    standaloneCanvasOpen.value = e.data.open;
    log.node.debug(`Standalone canvas status: ${e.data.open ? "open" : "closed"}`);

    if (e.data.open) {
      // Send current content when standalone opens
      if (canvasUrl.value || lastBase64) {
        broadcastCanvasContent();
      }
    } else if (wasOpen) {
      // Re-register node when standalone closes
      log.node.debug("Standalone closed, re-registering node");
      refreshNodeRegistration();
    }
  }
});

/**
 * Create a blob URL from base64 data
 */
function createBlobUrlFromBase64(base64: string, mimeType: string): string {
  // Handle data URL format or raw base64
  let rawBase64 = base64;
  let detectedMime = mimeType;

  if (base64.startsWith("data:")) {
    const match = base64.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      detectedMime = match[1];
      rawBase64 = match[2];
    }
  }

  const binary = atob(rawBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: detectedMime });
  return URL.createObjectURL(blob);
}

/**
 * Revoke the previous blob URL to prevent memory leaks
 */
function revokePreviousBlobUrl() {
  if (canvasBlobUrl.value) {
    URL.revokeObjectURL(canvasBlobUrl.value);
    canvasBlobUrl.value = null;
  }
  canvasContentType.value = null;
}

/**
 * Handle canvas content from invoke params (shared by present/navigate)
 */
function handleCanvasContent(cmdParams: Record<string, unknown>): {
  type: "base64" | "url";
  detail: string;
} | null {
  const url = cmdParams.url as string | undefined;
  const imageBase64 = cmdParams.imageBase64 as string | undefined;
  const imageMimeType = (cmdParams.imageMimeType as string) || "image/png";

  revokePreviousBlobUrl();

  if (imageBase64) {
    try {
      const blobUrl = createBlobUrlFromBase64(imageBase64, imageMimeType);
      canvasBlobUrl.value = blobUrl;
      canvasContentType.value = imageMimeType;
      canvasUrl.value = null;
      lastBase64 = imageBase64;
      lastBase64Mime = imageMimeType;
      broadcastCanvasContent();
      return { type: "base64", detail: imageMimeType };
    } catch (e) {
      log.node.error("Failed to create blob from base64:", e);
      return null;
    }
  }

  if (url) {
    canvasUrl.value = url;
    lastBase64 = null;
    lastBase64Mime = null;
    broadcastCanvasContent();
    return { type: "url", detail: url };
  }

  return null;
}

// Generate a stable node ID for this browser
function getOrCreateNodeId(): string {
  const storageKey = "cove:nodeId";
  let id = localStorage.getItem(storageKey);
  if (!id) {
    id = `cove-${crypto.randomUUID().slice(0, 8)}`;
    localStorage.setItem(storageKey, id);
  }
  return id;
}

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingInterval: ReturnType<typeof setInterval> | null = null;
let currentAuthMode: "token" | "password" | undefined = undefined;
let currentCredential: string | undefined = undefined;

const PING_INTERVAL_MS = 15000; // Send ping every 15 seconds
const pendingRequests = new Map<
  string,
  {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }
>();
let requestId = 0;

const REQUEST_TIMEOUT_MS = 30000;

function send(method: string, params?: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error("Not connected"));
      return;
    }
    const id = String(++requestId);

    // Set up timeout to clean up stale requests
    const timeout = setTimeout(() => {
      const pending = pendingRequests.get(id);
      if (pending) {
        pendingRequests.delete(id);
        pending.reject(new Error("Request timeout"));
      }
    }, REQUEST_TIMEOUT_MS);

    pendingRequests.set(id, { resolve, reject, timeout });
    ws.send(JSON.stringify({ type: "req", id, method, params }));
  });
}

function handleMessage(data: string) {
  try {
    const msg = JSON.parse(data);

    // Handle responses to our requests
    if (msg.type === "res" && msg.id != null) {
      const pending = pendingRequests.get(String(msg.id));
      if (pending) {
        pendingRequests.delete(msg.id);
        clearTimeout(pending.timeout);
        if (msg.ok) {
          pending.resolve(msg.payload);
        } else {
          pending.reject(new Error(msg.error?.message ?? "Request failed"));
        }
      }
      return;
    }

    // Handle events from gateway (type can be "evt" or "event")
    if (msg.type === "evt" || msg.type === "event") {
      // node.invoke.request comes as an event, not a request
      if (msg.event === "node.invoke.request") {
        handleInvokeRequest(msg.payload);
        return;
      }
      handleEvent(msg.event, msg.payload);
      return;
    }
  } catch (e) {
    log.node.error("Failed to parse message:", e);
  }
}

function handleEvent(event: string, payload: unknown) {
  log.node.debug("Event:", event, payload);

  // Handle connect.challenge - this triggers us to send the connect request
  if (event === "connect.challenge") {
    log.node.debug("Received connect.challenge, sending connect request");
    sendConnectRequest();
    return;
  }

  if (event === "node.pair.resolved") {
    const p = payload as { status?: string };
    if (p.status === "approved") {
      nodePairingStatus.value = "paired";
      log.node.debug("Pairing approved!");
    } else {
      nodePairingStatus.value = "unpaired";
      log.node.debug("Pairing rejected");
    }
  }
}

async function sendConnectRequest() {
  const id = getOrCreateNodeId();
  nodeId.value = id;

  try {
    // Connect as a node - use node-host client ID per gateway protocol
    const params: Record<string, unknown> = {
      minProtocol: 3,
      maxProtocol: 3,
      role: "node",
      client: {
        id: "node-host", // Must be a predefined client ID
        displayName: `Cove Canvas (${id})`,
        mode: "node",
        version: "1.0.0",
        platform: "macos", // Use macos for better command allowlist defaults
      },
      caps: ["canvas"],
      // Must declare commands we support
      commands: [
        "canvas.present",
        "canvas.hide",
        "canvas.navigate",
        "canvas.eval",
        "canvas.snapshot",
      ],
    };

    // Include auth if we have credentials
    if (currentCredential) {
      if (currentAuthMode === "token") {
        params.auth = { token: currentCredential };
      } else if (currentAuthMode === "password") {
        params.auth = { password: currentCredential };
      }
    }

    log.node.debug("Sending connect request");

    const connectResult = await send("connect", params);

    log.node.debug("Connect result:", connectResult);

    nodeConnected.value = true;
    nodePairingStatus.value = "paired"; // Connected with shared auth = effectively paired
    log.node.info("Node connected successfully");

    // Start keepalive pings (only if not already running)
    startKeepalive();
  } catch (e) {
    log.node.error("Connect failed:", e);
  }
}

function startKeepalive() {
  if (pingInterval) return; // Already running
  pingInterval = setInterval(async () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        await send("ping", {});
        log.node.debug("Keepalive ping successful");
      } catch {
        log.node.debug("Keepalive ping failed, reconnecting");
        refreshNodeRegistration();
      }
    }
  }, PING_INTERVAL_MS);
}

async function handleInvokeRequest(payload: unknown) {
  const p = payload as {
    id?: string;
    command?: string;
    paramsJSON?: string;
    idempotencyKey?: string;
  };

  // Parse params from JSON string
  let cmdParams: Record<string, unknown> = {};
  if (p.paramsJSON) {
    try {
      cmdParams = JSON.parse(p.paramsJSON);
    } catch {
      log.node.error("Failed to parse paramsJSON:", p.paramsJSON);
    }
  }

  log.node.debug("Invoke request:", p.command);

  let result: unknown = { ok: true };
  let error: { code: string; message: string } | undefined;

  try {
    switch (p.command) {
      case "canvas.present": {
        const contentResult = handleCanvasContent(cmdParams);
        // Toggle to ensure subscribers see the change even if already true
        canvasVisible.value = false;
        canvasVisible.value = true;
        if (contentResult) {
          log.node.debug(
            `Canvas presented: ${contentResult.type === "base64" ? `(${contentResult.detail})` : contentResult.detail}`,
          );
        }
        break;
      }
      case "canvas.hide": {
        canvasVisible.value = false;
        log.node.debug("Canvas hidden");
        break;
      }
      case "canvas.navigate": {
        const contentResult = handleCanvasContent(cmdParams);
        // Toggle to ensure subscribers see the change even if already true
        canvasVisible.value = false;
        canvasVisible.value = true;
        if (contentResult) {
          log.node.debug(
            `Canvas navigated: ${contentResult.type === "base64" ? `(${contentResult.detail})` : contentResult.detail}`,
          );
        }
        break;
      }
      case "canvas.eval": {
        const js = cmdParams.javaScript as string | undefined;
        log.node.debug("canvas.eval requested:", js?.slice(0, 50));
        result = { result: "eval not implemented in Cove yet" };
        break;
      }
      case "canvas.snapshot": {
        log.node.debug("canvas.snapshot requested");
        error = { code: "NOT_IMPLEMENTED", message: "snapshot not implemented in Cove yet" };
        break;
      }
      default:
        error = { code: "UNKNOWN_COMMAND", message: `Unknown command: ${p.command}` };
    }
  } catch (e) {
    error = { code: "ERROR", message: String(e) };
  }

  // Send result back
  if (ws && ws.readyState === WebSocket.OPEN) {
    const resultMsg = {
      type: "req",
      id: String(++requestId),
      method: "node.invoke.result",
      params: {
        id: p.id, // The invoke request ID
        nodeId: "node-host", // Must match our node ID
        ok: !error,
        payload: error ? undefined : result,
        error: error ?? undefined,
      },
    };
    log.node.debug("Sending invoke result");
    ws.send(JSON.stringify(resultMsg));
  }
}

async function connectNode() {
  const url = gatewayUrl.value;
  const auth = getAuth();
  const credential = getSessionCredential();

  log.node.debug("connectNode called");

  if (!url) {
    log.node.debug("No gateway URL, skipping node connection");
    return;
  }

  // Get auth credential (token or password)
  currentAuthMode = auth?.authMode;
  currentCredential = credential ?? undefined;

  const wsUrl = url.replace(/^http/, "ws");
  log.node.debug("Connecting to gateway as node");

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    log.node.debug("WebSocket connected, waiting for connect.challenge");
  };

  ws.onmessage = (event) => {
    handleMessage(String(event.data));
  };

  ws.onclose = (event) => {
    log.node.debug("WebSocket closed:", event.code, event.reason);
    nodeConnected.value = false;
    ws = null;

    // Clear keepalive
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }

    // Reconnect after delay
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectNode();
      }, 5000);
    }
  };

  ws.onerror = () => {
    log.node.error("WebSocket error");
  };
}

export function startNodeConnection() {
  log.node.debug("startNodeConnection called");
  if (gatewayUrl.value) {
    connectNode();
  } else {
    log.node.debug("No gateway URL, skipping node connection");
  }
}

/** Stop the node connection (for cleanup) */
export function refreshNodeRegistration() {
  log.node.debug("refreshNodeRegistration called - doing full reconnect");
  // Close existing connection and reconnect fresh
  if (ws) {
    ws.close();
    ws = null;
  }
  nodeConnected.value = false;
  // Reconnect after a brief delay
  setTimeout(() => {
    connectNode();
  }, 500);
}

export function stopNodeConnection() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  // Clean up pending requests
  for (const [id, pending] of pendingRequests) {
    clearTimeout(pending.timeout);
    pending.reject(new Error("Connection closed"));
    pendingRequests.delete(id);
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  nodeConnected.value = false;
}
