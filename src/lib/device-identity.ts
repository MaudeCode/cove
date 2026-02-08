/**
 * Device Identity
 *
 * Browser-based device identity using WebCrypto Ed25519.
 * Persists keys in localStorage for stable device ID across sessions.
 */

import { signal } from "@preact/signals";
import { log } from "./logger";

const STORAGE_KEY = "cove:device-identity";
const DISPLAY_NAME_KEY = "cove:device-display-name";

// User-configurable display name (reactive)
export const deviceDisplayName = signal<string | null>(
  typeof localStorage !== "undefined" ? localStorage.getItem(DISPLAY_NAME_KEY) : null,
);

/**
 * Set a custom display name for this device
 */
export function setDeviceDisplayName(name: string | null): void {
  if (name?.trim()) {
    localStorage.setItem(DISPLAY_NAME_KEY, name.trim());
    deviceDisplayName.value = name.trim();
  } else {
    localStorage.removeItem(DISPLAY_NAME_KEY);
    deviceDisplayName.value = null;
  }
}

export type DeviceIdentity = {
  deviceId: string;
  publicKeyBase64Url: string;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
};

type StoredIdentity = {
  version: 1;
  deviceId: string;
  publicKeyBase64Url: string;
  privateKeyJwk: JsonWebKey;
  publicKeyJwk: JsonWebKey;
  createdAtMs: number;
};

// Base64URL encoding/decoding
function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

// Derive deviceId from public key (SHA-256 hash of raw public key bytes)
async function deriveDeviceId(publicKey: CryptoKey): Promise<string> {
  const rawKey = await crypto.subtle.exportKey("raw", publicKey);
  const hash = await crypto.subtle.digest("SHA-256", rawKey);
  // Convert to hex string
  const hashArray = new Uint8Array(hash);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Generate new Ed25519 key pair
async function generateIdentity(): Promise<DeviceIdentity> {
  const keyPair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);

  const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const publicKeyBase64Url = base64UrlEncode(publicKeyRaw);
  const deviceId = await deriveDeviceId(keyPair.publicKey);

  return {
    deviceId,
    publicKeyBase64Url,
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
  };
}

// Store identity to localStorage
async function storeIdentity(identity: DeviceIdentity): Promise<void> {
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", identity.privateKey);
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", identity.publicKey);

  const stored: StoredIdentity = {
    version: 1,
    deviceId: identity.deviceId,
    publicKeyBase64Url: identity.publicKeyBase64Url,
    privateKeyJwk,
    publicKeyJwk,
    createdAtMs: Date.now(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  log.node.debug("Stored device identity:", identity.deviceId.slice(0, 16) + "...");
}

// Load identity from localStorage
async function loadIdentity(): Promise<DeviceIdentity | null> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const stored = JSON.parse(raw) as StoredIdentity;
    if (stored?.version !== 1) return null;

    // Import keys from JWK
    const privateKey = await crypto.subtle.importKey("jwk", stored.privateKeyJwk, "Ed25519", true, [
      "sign",
    ]);
    const publicKey = await crypto.subtle.importKey("jwk", stored.publicKeyJwk, "Ed25519", true, [
      "verify",
    ]);

    // Verify deviceId matches
    const derivedId = await deriveDeviceId(publicKey);
    if (derivedId !== stored.deviceId) {
      log.node.warn("Device ID mismatch, regenerating identity");
      return null;
    }

    log.node.debug("Loaded device identity:", stored.deviceId.slice(0, 16) + "...");

    return {
      deviceId: stored.deviceId,
      publicKeyBase64Url: stored.publicKeyBase64Url,
      privateKey,
      publicKey,
    };
  } catch (e) {
    log.node.warn("Failed to load device identity:", e);
    return null;
  }
}

// Load or create device identity
let cachedIdentity: DeviceIdentity | null = null;

export async function getDeviceIdentity(): Promise<DeviceIdentity> {
  if (cachedIdentity) return cachedIdentity;

  // Try to load from storage
  cachedIdentity = await loadIdentity();
  if (cachedIdentity) return cachedIdentity;

  // Generate new identity
  log.node.debug("Generating new device identity");
  cachedIdentity = await generateIdentity();
  await storeIdentity(cachedIdentity);

  return cachedIdentity;
}

// Build the auth payload string that gets signed
export function buildDeviceAuthPayload(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce?: string | null;
}): string {
  const version = params.nonce ? "v2" : "v1";
  const scopes = params.scopes.join(",");
  const token = params.token ?? "";
  const base = [
    version,
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
  ];
  if (version === "v2") {
    base.push(params.nonce ?? "");
  }
  return base.join("|");
}

// Sign a payload with the device's private key
export async function signPayload(identity: DeviceIdentity, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const signature = await crypto.subtle.sign("Ed25519", identity.privateKey, data);
  return base64UrlEncode(signature);
}

// Build the device object for connect params
export async function buildDeviceConnectParams(params: {
  clientId: string;
  clientMode: string;
  role: string;
  scopes?: string[];
  token?: string | null;
  nonce?: string | null;
}): Promise<{
  id: string;
  publicKey: string;
  signature: string;
  signedAt: number;
  nonce?: string;
}> {
  const identity = await getDeviceIdentity();
  const signedAt = Date.now();
  const scopes = params.scopes ?? [];

  const payload = buildDeviceAuthPayload({
    deviceId: identity.deviceId,
    clientId: params.clientId,
    clientMode: params.clientMode,
    role: params.role,
    scopes,
    signedAtMs: signedAt,
    token: params.token,
    nonce: params.nonce,
  });

  const signature = await signPayload(identity, payload);

  return {
    id: identity.deviceId,
    publicKey: identity.publicKeyBase64Url,
    signature,
    signedAt,
    ...(params.nonce ? { nonce: params.nonce } : {}),
  };
}

/**
 * Get the display name for this device (custom name or default)
 */
export async function getDeviceDisplayName(): Promise<string> {
  if (deviceDisplayName.value) {
    return deviceDisplayName.value;
  }
  const identity = await getDeviceIdentity();
  return `Cove Canvas (${identity.deviceId.slice(0, 8)})`;
}
