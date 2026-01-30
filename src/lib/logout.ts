/**
 * Logout Utility
 *
 * Handles disconnecting from gateway and clearing credentials.
 */

import { disconnect } from "@/lib/gateway";
import { cleanupChat } from "@/lib/chat";
import { clearSessions } from "@/signals/sessions";
import { activeView } from "@/signals/ui";

/**
 * Clear saved credentials from localStorage
 */
export function clearSavedCredentials(): void {
  localStorage.removeItem("cove:gateway-url");
  localStorage.removeItem("cove:auth-mode");
  localStorage.removeItem("cove:auth-credential");
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

  // Navigate to chat view (which will show login since disconnected)
  activeView.value = "chat";
}
