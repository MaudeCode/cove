/**
 * Authentication State Management
 *
 * Manages:
 * - Saved credentials (localStorage)
 * - Auto-connect on load
 * - Login/logout flow
 *
 * Usage:
 *   import { auth, login, logout, savedCredentials } from '@/lib/auth'
 *
 *   await login({ url: 'ws://localhost:8095', password: 'secret' })
 *   logout()
 */

import { signal, computed } from "@preact/signals";
import { connect, disconnect, connectionState, isConnected } from "@/lib/gateway";

// ============================================
// Storage
// ============================================

const STORAGE_KEY = "cove:auth";

interface SavedCredentials {
  url: string;
  authMode: "password" | "token";
  // Note: We store credentials for convenience, but in production
  // you might want to use a more secure approach
  password?: string;
  token?: string;
  rememberMe: boolean;
}

// ============================================
// State
// ============================================

/** Saved credentials from localStorage */
export const savedCredentials = signal<SavedCredentials | null>(loadCredentials());

/** Whether we're currently attempting auto-login */
export const isAutoConnecting = signal<boolean>(false);

/** Whether user explicitly logged out (prevents auto-reconnect) */
export const userLoggedOut = signal<boolean>(false);

/** Whether auth is ready (checked saved creds) */
export const authReady = signal<boolean>(false);

/** Whether we have saved credentials */
export const hasSavedCredentials = computed(() => savedCredentials.value !== null);

// ============================================
// Credential Management
// ============================================

function loadCredentials(): SavedCredentials | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function saveCredentials(creds: SavedCredentials): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
    savedCredentials.value = creds;
  } catch {
    console.warn("[auth] Failed to save credentials");
  }
}

function clearCredentials(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    savedCredentials.value = null;
  } catch {
    // Ignore
  }
}

// ============================================
// Login / Logout
// ============================================

export interface LoginParams {
  url: string;
  authMode?: "password" | "token";
  password?: string;
  token?: string;
  rememberMe?: boolean;
}

/**
 * Login to the gateway
 */
export async function login(params: LoginParams): Promise<void> {
  const { url, authMode = "password", password, token, rememberMe = false } = params;

  userLoggedOut.value = false;

  await connect({
    url,
    authMode,
    password,
    token,
    autoReconnect: true,
  });

  // Save credentials if rememberMe is true
  if (rememberMe) {
    saveCredentials({
      url,
      authMode,
      password,
      token,
      rememberMe: true,
    });
  } else {
    // Clear any saved credentials if not remembering
    clearCredentials();
  }
}

/**
 * Logout from the gateway
 */
export function logout(): void {
  userLoggedOut.value = true;
  clearCredentials();
  disconnect();
}

/**
 * Attempt auto-login with saved credentials
 */
export async function autoConnect(): Promise<boolean> {
  const creds = savedCredentials.value;
  if (!creds || userLoggedOut.value) {
    authReady.value = true;
    return false;
  }

  isAutoConnecting.value = true;

  try {
    await login({
      url: creds.url,
      authMode: creds.authMode,
      password: creds.password,
      token: creds.token,
      rememberMe: creds.rememberMe,
    });
    return true;
  } catch (err) {
    console.warn("[auth] Auto-connect failed:", err);
    // Don't clear credentials on auto-connect failure
    // User might just be offline
    return false;
  } finally {
    isAutoConnecting.value = false;
    authReady.value = true;
  }
}

// ============================================
// Auth Object Export
// ============================================

export const auth = {
  /** Connection state (from gateway) */
  state: connectionState,

  /** Whether connected */
  isConnected,

  /** Saved credentials */
  savedCredentials,

  /** Whether auto-connecting */
  isAutoConnecting,

  /** Whether user explicitly logged out */
  userLoggedOut,

  /** Whether auth is ready */
  ready: authReady,

  /** Whether we have saved credentials */
  hasSavedCredentials,

  /** Login */
  login,

  /** Logout */
  logout,

  /** Auto-connect with saved credentials */
  autoConnect,

  /** Clear saved credentials */
  clearCredentials,
};

// Named export only (no default)
