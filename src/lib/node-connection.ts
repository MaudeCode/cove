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
let currentAuthMode: "token" | "password" | undefined = undefined;
let currentCredential: string | undefined = undefined;
let pendingRequests = new Map<
  string,
  {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }
>();
let requestId = 0;

function send(method: string, params?: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reject(new Error("Not connected"));
      return;
    }
    const id = String(++requestId);
    pendingRequests.set(id, { resolve, reject });
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
    log.node.warn("Received connect.challenge, sending connect request");
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

    log.node.warn("Sending connect with params:", JSON.stringify(params, null, 2));

    const connectResult = await send("connect", params);

    log.node.warn("Connect result:", connectResult);

    nodeConnected.value = true;
    nodePairingStatus.value = "paired"; // Connected with shared auth = effectively paired
    log.node.warn("Node connected successfully!");
  } catch (e) {
    log.node.warn("Connect failed:", e);
  }
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
      log.node.warn("Failed to parse paramsJSON:", p.paramsJSON);
    }
  }

  log.node.warn("Invoke request:", p.command, cmdParams);

  let result: unknown = { ok: true };
  let error: { code: string; message: string } | undefined;

  try {
    switch (p.command) {
      case "canvas.present": {
        const url = cmdParams.url as string | undefined;
        const imageBase64 = cmdParams.imageBase64 as string | undefined;
        const imageMimeType = (cmdParams.imageMimeType as string) || "image/png";

        revokePreviousBlobUrl();

        // If we have base64 image data, use it directly
        if (imageBase64) {
          try {
            const blobUrl = createBlobUrlFromBase64(imageBase64, imageMimeType);
            canvasBlobUrl.value = blobUrl;
            canvasContentType.value = imageMimeType;
            canvasUrl.value = null; // Clear URL since we're using blob
            log.node.warn("Canvas showing base64 image:", imageMimeType);
          } catch (e) {
            log.node.warn("Failed to create blob from base64:", e);
          }
        } else if (url) {
          canvasUrl.value = url;
          // Note: Direct URL fetch removed due to CORS issues
          // URLs will be rendered directly (works for public URLs and data URLs)
        }

        canvasVisible.value = true;
        log.node.warn("Canvas presented:", url || "(base64 image)");
        break;
      }
      case "canvas.hide": {
        canvasVisible.value = false;
        log.node.warn("Canvas hidden");
        break;
      }
      case "canvas.navigate": {
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
            log.node.warn("Canvas navigated to base64 image:", imageMimeType);
          } catch (e) {
            log.node.warn("Failed to create blob from base64:", e);
          }
        } else if (url) {
          canvasUrl.value = url;
        }

        canvasVisible.value = true;
        log.node.warn("Canvas navigated:", url || "(base64 image)");
        break;
      }
      case "canvas.eval": {
        const js = cmdParams.javaScript as string | undefined;
        log.node.warn("canvas.eval not fully implemented:", js);
        result = { result: "eval not implemented in Cove yet" };
        break;
      }
      case "canvas.snapshot": {
        log.node.warn("canvas.snapshot not implemented yet");
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
    log.node.warn("Sending invoke result:", resultMsg);
    ws.send(JSON.stringify(resultMsg));
  }
}

async function connectNode() {
  const url = gatewayUrl.value;
  const auth = getAuth();
  const credential = getSessionCredential();

  log.node.warn("connectNode called, url:", url);

  if (!url) {
    log.node.warn("No gateway URL in connectNode");
    return;
  }

  // Get auth credential (token or password)
  log.node.warn("Auth mode:", auth?.authMode, "Credential exists:", !!credential);
  currentAuthMode = auth?.authMode;
  currentCredential = credential ?? undefined;

  const wsUrl = url.replace(/^http/, "ws");
  log.node.warn("Connecting to", wsUrl);

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    log.node.warn("WebSocket connected, waiting for connect.challenge...");
    // Don't send connect yet - wait for connect.challenge event
  };

  ws.onmessage = (event) => {
    log.node.warn("Raw message received:", String(event.data).slice(0, 200));
    handleMessage(String(event.data));
  };

  ws.onclose = (event) => {
    log.node.warn("WebSocket closed:", event.code, event.reason);
    nodeConnected.value = false;
    ws = null;

    // Reconnect after delay
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connectNode();
      }, 5000);
    }
  };

  ws.onerror = (event) => {
    log.node.warn("WebSocket error:", event);
  };
}

export function startNodeConnection() {
  log.node.warn("startNodeConnection called, gatewayUrl:", gatewayUrl.value);
  // Only start if we have a gateway URL
  if (gatewayUrl.value) {
    connectNode();
  } else {
    log.node.warn("No gateway URL, skipping node connection");
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Cleanup function for future use
function stopNodeConnection() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  nodeConnected.value = false;
}
