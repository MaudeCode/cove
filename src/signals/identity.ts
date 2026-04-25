/**
 * Identity Signals
 *
 * Assistant and user identity state.
 */

import { signal } from "@preact/signals";
import { send } from "@/lib/gateway";
import { log } from "@/lib/logger";

/**
 * Check whether an avatar value can be used directly as an image source.
 */
function isImageAvatar(avatar: string | null | undefined): boolean {
  return Boolean(
    avatar &&
    (avatar.startsWith("http://") || avatar.startsWith("https://") || avatar.startsWith("data:")),
  );
}

/**
 * Resolve avatar URL for display.
 *
 * OpenClaw may return relative /avatar/{agentId} paths from agent.identity.get.
 * Those HTTP endpoints require gateway auth, and <img> cannot attach the
 * Authorization header, so prefer the data URI already exposed via agents.list.
 */
async function resolveAvatarUrl(
  avatar: string | null | undefined,
  agentId: string | null | undefined,
): Promise<string | null> {
  if (!avatar) return null;

  if (isImageAvatar(avatar)) {
    return avatar;
  }

  if (avatar.startsWith("/") && agentId) {
    try {
      const result = await send("agents.list", {});
      const agent = result.agents.find((entry) => entry.id === agentId);
      const resolvedAvatar = agent?.identity?.avatarUrl ?? agent?.identity?.avatar;
      if (isImageAvatar(resolvedAvatar)) {
        return resolvedAvatar ?? null;
      }
    } catch (err) {
      log.ui.debug("Failed to resolve assistant avatar from agents.list:", err);
    }
    return null;
  }

  // Emoji or other short text fallback.
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
      if (result.agentId) {
        assistantAgentId.value = result.agentId;
      }
      if (result.avatar) {
        assistantAvatar.value = await resolveAvatarUrl(result.avatar, result.agentId);
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
