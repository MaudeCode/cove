/**
 * Logout Utility
 *
 * Handles disconnecting from gateway and clearing credentials.
 */

import { route } from "preact-router";
import { disconnect } from "@/lib/gateway";
import { cleanupChat } from "@/lib/chat/init";
import { clearSessions } from "@/signals/sessions";
import { clearAuth } from "@/lib/storage";

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
  clearSessions();

  // Disconnect from gateway
  disconnect();

  // Clear saved credentials if requested
  if (clearCredentials) {
    clearSavedCredentials();
  }

  // Navigate to home (which will show login since disconnected)
  route("/");
}
