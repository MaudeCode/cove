/**
 * Auth Signals
 *
 * Global state for authentication and gateway connection.
 *
 * @see Phase 0.9 in ROADMAP.md for full spec
 */

import { signal, computed } from "@preact/signals";

export type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

/** Gateway WebSocket URL */
export const gatewayUrl = signal<string>("");

/** Auth token (if using token auth) */
export const authToken = signal<string | null>(null);

/** Current connection state */
export const connectionState = signal<ConnectionState>("disconnected");

/** Last connection error message */
export const connectionError = signal<string | null>(null);

/** Whether we're authenticated and connected */
export const isAuthenticated = computed(() => connectionState.value === "connected");
