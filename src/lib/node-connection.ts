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
import {
  buildDeviceConnectParams,
  getDeviceIdentity,
  getDeviceDisplayName,
} from "./device-identity";
import { createBlobUrlFromBase64, getDataUrlMimeType } from "./canvas-utils";

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

// Canvas eval/snapshot - set by node-connection, consumed by CanvasPanel
export const pendingCanvasEval = signal<{
  js: string;
  resolve: (result: unknown) => void;
  reject: (error: string) => void;
} | null>(null);

export const pendingCanvasSnapshot = signal<{
  maxWidth: number;
  quality: number;
  outputFormat: "jpeg" | "png";
  resolve: (dataUrl: string) => void;
  reject: (error: string) => void;
} | null>(null);

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
      revokePreviousBlobUrl();
      canvasUrl.value = e.data.url;
    } else if (e.data.base64) {
      try {
        const mimeType = getDataUrlMimeType(e.data.base64) || e.data.mimeType || "image/png";
        const blobUrl = createBlobUrlFromBase64(e.data.base64, mimeType);
        revokePreviousBlobUrl();
        canvasBlobUrl.value = blobUrl;
        canvasContentType.value = mimeType;
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
 * Transform localhost canvas URLs to use the server proxy.
 *
 * Example: http://127.0.0.1:18789/__openclaw__/canvas/image.png
 *       -> /_canvas/image.png
 *
 * The server proxies /_canvas/* to the gateway via GATEWAY_HOST env var.
 */
function transformCanvasUrl(url: string): string {
  // Check if this is a localhost canvas URL
  const localhostPattern =
    /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/__openclaw__\/canvas)(\/.*)?/i;
  const match = url.match(localhostPattern);

  if (!match) {
    return url; // Not a localhost canvas URL, return as-is
  }

  // Extract the file path after /__openclaw__/canvas
  const filePath = match[4] || "/";
  const transformed = `/_canvas${filePath}`;
  log.node.debug("Transformed canvas URL to proxy:", url, "->", transformed);
  return transformed;
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

  if (imageBase64) {
    try {
      const detectedMimeType = getDataUrlMimeType(imageBase64) || imageMimeType;
      const blobUrl = createBlobUrlFromBase64(imageBase64, detectedMimeType);
      revokePreviousBlobUrl();
      canvasBlobUrl.value = blobUrl;
      canvasContentType.value = detectedMimeType;
      canvasUrl.value = null;
      lastBase64 = imageBase64;
      lastBase64Mime = detectedMimeType;
      broadcastCanvasContent();
      return { type: "base64", detail: detectedMimeType };
    } catch (e) {
      log.node.error("Failed to create blob from base64:", e);
      return null;
    }
  }

  if (url) {
    const transformedUrl = transformCanvasUrl(url);
    revokePreviousBlobUrl();
    canvasUrl.value = transformedUrl;
    lastBase64 = null;
    lastBase64Mime = null;
    broadcastCanvasContent();
    return { type: "url", detail: transformedUrl };
  }

  return null;
}
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let refreshReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingInterval: ReturnType<typeof setInterval> | null = null;
let currentAuthMode: "token" | "password" | undefined = undefined;
let currentCredential: string | undefined = undefined;
let connectionEpoch = 0;

const PING_INTERVAL_MS = 15000; // Send ping every 15 seconds
const CANVAS_OPERATION_TIMEOUT_MS = 10000; // Timeout for eval/snapshot operations
const PROTOCOL_VERSION = 4;
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

function rejectPendingRequests(error: Error): void {
  for (const [id, pending] of pendingRequests) {
    clearTimeout(pending.timeout);
    pending.reject(error);
    pendingRequests.delete(id);
  }
}

function isCurrentConnection(epoch: number): boolean {
  return epoch === connectionEpoch;
}

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

function handleMessage(data: string, epoch: number) {
  if (!isCurrentConnection(epoch)) return;

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
      handleEvent(msg.event, msg.payload, epoch);
      return;
    }
  } catch (e) {
    log.node.error("Failed to parse message:", e);
  }
}

function handleEvent(event: string, payload: unknown, epoch: number) {
  log.node.debug("Event:", event, payload);

  // Handle connect.challenge - this triggers us to send the connect request
  if (event === "connect.challenge") {
    const p = payload as { nonce?: string; ts?: number };
    const nonce = typeof p.nonce === "string" ? p.nonce : undefined;
    log.node.debug("Received connect.challenge with nonce:", nonce?.slice(0, 8) + "...");
    sendConnectRequest(nonce, epoch);
    return;
  }

  if (event === "node.pair.resolved") {
    const p = payload as { status?: string };
    if (p.status === "approved") {
      nodePairingStatus.value = "paired";
      log.node.debug("Pairing approved! Reconnecting...");
      // Reconnect now that we're paired
      refreshNodeRegistration();
    } else {
      nodePairingStatus.value = "unpaired";
      log.node.debug("Pairing rejected");
    }
  }
}

async function sendConnectRequest(nonce: string | undefined, epoch: number) {
  try {
    // Get or create persistent device identity (Ed25519 keys stored in localStorage)
    const identity = await getDeviceIdentity();
    const displayName = await getDeviceDisplayName();
    nodeId.value = identity.deviceId;

    // Build signed device params for proper node registration
    const device = await buildDeviceConnectParams({
      clientId: "node-host",
      clientMode: "node",
      role: "node",
      scopes: [],
      token: currentAuthMode === "token" ? (currentCredential ?? null) : null,
      nonce, // Include challenge nonce in signature
    });

    if (!isCurrentConnection(epoch)) return;

    const params: Record<string, unknown> = {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      role: "node",
      client: {
        id: "node-host",
        displayName,
        mode: "node",
        version: "1.0.0",
        platform: navigator.platform?.toLowerCase().includes("mac") ? "macos" : "web",
      },
      device, // Signed device identity - device.id becomes the nodeId
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

    log.node.debug("Sending connect request with device:", device.id.slice(0, 16) + "...");

    const connectResult = await send("connect", params);

    if (!isCurrentConnection(epoch)) return;

    log.node.debug("Connect result:", connectResult);

    nodeConnected.value = true;
    nodePairingStatus.value = "paired";
    log.node.info("Node connected as device:", identity.deviceId.slice(0, 16) + "...");

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
    params?: Record<string, unknown>;
    paramsJSON?: string;
    idempotencyKey?: string;
  };

  // Parse params - can come as object or JSON string
  let cmdParams: Record<string, unknown> = {};
  if (p.params && typeof p.params === "object") {
    cmdParams = p.params;
  } else if (p.paramsJSON) {
    try {
      cmdParams = JSON.parse(p.paramsJSON);
    } catch {
      log.node.error("Failed to parse paramsJSON:", p.paramsJSON);
    }
  }

  log.node.debug("Invoke request:", p.command, "params keys:", Object.keys(cmdParams));

  let result: unknown = { ok: true };
  let error: { code: string; message: string } | undefined;

  try {
    switch (p.command) {
      case "canvas.present": {
        const contentResult = handleCanvasContent(cmdParams);
        if (!contentResult) {
          error = { code: "INVALID_PARAMS", message: "url or imageBase64 parameter required" };
          break;
        }
        // Toggle to ensure subscribers see the change even if already true
        canvasVisible.value = false;
        canvasVisible.value = true;
        log.node.debug(
          `Canvas presented: ${contentResult.type === "base64" ? `(${contentResult.detail})` : contentResult.detail}`,
        );
        break;
      }
      case "canvas.hide": {
        canvasVisible.value = false;
        log.node.debug("Canvas hidden");
        break;
      }
      case "canvas.navigate": {
        const contentResult = handleCanvasContent(cmdParams);
        if (!contentResult) {
          error = { code: "INVALID_PARAMS", message: "url or imageBase64 parameter required" };
          break;
        }
        // Toggle to ensure subscribers see the change even if already true
        canvasVisible.value = false;
        canvasVisible.value = true;
        log.node.debug(
          `Canvas navigated: ${contentResult.type === "base64" ? `(${contentResult.detail})` : contentResult.detail}`,
        );
        break;
      }
      case "canvas.eval": {
        const js = cmdParams.javaScript as string | undefined;
        log.node.debug("canvas.eval requested:", js?.slice(0, 50));
        if (!js) {
          error = { code: "INVALID_PARAMS", message: "javaScript parameter required" };
          break;
        }
        try {
          const evalResult = await new Promise<unknown>((resolve, reject) => {
            pendingCanvasEval.value?.reject("Superseded by a newer canvas.eval request");
            const request: NonNullable<typeof pendingCanvasEval.value> = {
              js,
              resolve,
              reject: (msg: string) => reject(new Error(msg)),
            };
            pendingCanvasEval.value = request;
            setTimeout(() => {
              if (pendingCanvasEval.value === request) {
                pendingCanvasEval.value = null;
                reject(new Error("Canvas eval timeout"));
              }
            }, CANVAS_OPERATION_TIMEOUT_MS);
          });
          result = { result: evalResult };
        } catch (e) {
          error = { code: "EVAL_ERROR", message: String(e) };
        }
        break;
      }
      case "canvas.snapshot": {
        const maxWidth = (cmdParams.maxWidth as number) || 800;
        const quality = (cmdParams.quality as number) || 0.8;
        const formatParam = (cmdParams.outputFormat as string) || "jpeg";
        const outputFormat: "jpeg" | "png" = formatParam === "png" ? "png" : "jpeg";
        log.node.debug("canvas.snapshot requested:", { maxWidth, quality, outputFormat });
        try {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            pendingCanvasSnapshot.value?.reject("Superseded by a newer canvas.snapshot request");
            const request: NonNullable<typeof pendingCanvasSnapshot.value> = {
              maxWidth,
              quality,
              outputFormat,
              resolve,
              reject: (msg: string) => reject(new Error(msg)),
            };
            pendingCanvasSnapshot.value = request;
            setTimeout(() => {
              if (pendingCanvasSnapshot.value === request) {
                pendingCanvasSnapshot.value = null;
                reject(new Error("Canvas snapshot timeout"));
              }
            }, CANVAS_OPERATION_TIMEOUT_MS);
          });
          result = { dataUrl };
        } catch (e) {
          error = { code: "SNAPSHOT_ERROR", message: String(e) };
        }
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
        nodeId: nodeId.value, // Our device ID
        ok: !error,
        payload: error ? undefined : result,
        error: error ?? undefined,
      },
    };
    log.node.debug("Sending invoke result for node:", nodeId.value?.slice(0, 8));
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

  const epoch = ++connectionEpoch;
  const socket = new WebSocket(wsUrl);
  ws = socket;

  socket.onopen = () => {
    if (!isCurrentConnection(epoch) || ws !== socket) return;
    log.node.debug("WebSocket connected, waiting for connect.challenge");
  };

  socket.onmessage = (event) => {
    if (!isCurrentConnection(epoch) || ws !== socket) return;
    handleMessage(String(event.data), epoch);
  };

  socket.onclose = (event) => {
    if (!isCurrentConnection(epoch) || ws !== socket) return;
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

  socket.onerror = () => {
    if (!isCurrentConnection(epoch) || ws !== socket) return;
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
  connectionEpoch++;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  rejectPendingRequests(new Error("Connection refreshing"));
  // Close existing connection and reconnect fresh
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
  nodeConnected.value = false;
  // Reconnect after a brief delay
  if (refreshReconnectTimer) {
    clearTimeout(refreshReconnectTimer);
  }
  refreshReconnectTimer = setTimeout(() => {
    refreshReconnectTimer = null;
    connectNode();
  }, 500);
}

export function stopNodeConnection() {
  connectionEpoch++;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (refreshReconnectTimer) {
    clearTimeout(refreshReconnectTimer);
    refreshReconnectTimer = null;
  }
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  // Clean up pending requests
  rejectPendingRequests(new Error("Connection closed"));
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }
  currentAuthMode = undefined;
  currentCredential = undefined;
  nodeConnected.value = false;
}
