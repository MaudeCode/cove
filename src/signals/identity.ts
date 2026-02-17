/**
 * Identity Signals
 *
 * Assistant and user identity state.
 */

import { signal } from "@preact/signals";
import { send, gatewayUrl } from "@/lib/gateway";
import { log } from "@/lib/logger";

/**
 * Resolve avatar URL to absolute URL.
 * - HTTP URLs and data URIs are returned as-is
 * - Relative paths (like /avatar/main) are prefixed with gateway URL
 * - Emoji strings are returned as-is (for fallback display)
 */
function resolveAvatarUrl(avatar: string | null | undefined): string | null {
  if (!avatar) return null;

  // Already absolute URL or data URI
  if (avatar.startsWith("http://") || avatar.startsWith("https://") || avatar.startsWith("data:")) {
    return avatar;
  }

  // Relative path starting with / - prefix with gateway URL
  if (avatar.startsWith("/")) {
    const wsUrl = gatewayUrl.value;
    if (wsUrl) {
      const httpUrl = wsUrl.replace(/^ws/, "http");
      return `${httpUrl}${avatar}`;
    }
  }

  // Emoji or other string - return as-is for fallback display
  return avatar;
}

// ============================================
// Defaults
// ============================================

const DEFAULT_ASSISTANT_NAME = "Assistant";
const DEFAULT_ASSISTANT_AVATAR = "🤖";
const DEFAULT_USER_NAME = "You";

// ============================================
// Signals
// ============================================

/** Assistant identity */
export const assistantName = signal<string>(DEFAULT_ASSISTANT_NAME);
export const assistantAvatar = signal<string | null>(DEFAULT_ASSISTANT_AVATAR);
const assistantAgentId = signal<string | null>(null);

/** User identity */
export const userName = signal<string>(DEFAULT_USER_NAME);
export const userAvatar = signal<string | null>(null);

/** Whether identity is loading */
const isLoadingIdentity = signal<boolean>(false);

// ============================================
// Actions
// ============================================

/**
 * Load assistant identity from gateway
 */
export async function loadAssistantIdentity(sessionKey?: string): Promise<void> {
  isLoadingIdentity.value = true;

  try {
    const params = sessionKey ? { sessionKey } : {};
    const result = await send("agent.identity.get", params);

    if (result) {
      if (result.name) {
        assistantName.value = result.name;
      }
      if (result.avatar) {
        // Resolve relative avatar URLs to absolute gateway URLs
        assistantAvatar.value = resolveAvatarUrl(result.avatar);
      }
      if (result.agentId) {
        assistantAgentId.value = result.agentId;
      }

      log.ui.info(
        "Loaded assistant identity:",
        assistantName.value,
        "avatar:",
        assistantAvatar.value,
      );
    }
  } catch (err) {
    log.ui.error("Failed to load assistant identity:", err);
    // Keep defaults on error
  } finally {
    isLoadingIdentity.value = false;
  }
}
