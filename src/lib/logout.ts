/**
 * Logout Utility
 *
 * Handles disconnecting from gateway and clearing credentials.
 */

import { route } from "preact-router";
import { disconnect } from "@/lib/gateway";
import { cleanupChat } from "@/lib/chat/init";
import { clearSessions, cleanupSessionEventSubscription } from "@/signals/sessions";
import { clearAuth } from "@/lib/storage";
import { stopNodeConnection } from "@/lib/node-connection";

/**
 * Clear saved credentials from storage
 */
function clearSavedCredentials(): void {
  clearAuth();
}

/**
 * Logout from gateway
 *
 * @param clearCredentials - Whether to clear saved credentials (default: true)
 */
export function logout(clearCredentials = true): void {
  // Clean up chat state
  cleanupChat();

  // Clear session state
  cleanupSessionEventSubscription();
  clearSessions();

  // Disconnect from gateway
  disconnect();
  stopNodeConnection();

  // Clear saved credentials if requested
  if (clearCredentials) {
    clearSavedCredentials();
  }

  // Navigate to home (which will show login since disconnected)
  route("/");
}
