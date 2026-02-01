/* eslint-disable no-unused-vars */
/**
 * Identity Signals
 *
 * Assistant and user identity state.
 */

import { signal } from "@preact/signals";
import { send } from "@/lib/gateway";
import { log } from "@/lib/logger";

// ============================================
// Types
// ============================================

export interface AssistantIdentity {
  name: string;
  avatar: string | null;
  agentId: string | null;
}

interface UserIdentity {
  name: string;
  avatar: string | null;
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
    const result = await send<Partial<AssistantIdentity>>("agent.identity.get", params);

    if (result) {
      if (result.name) {
        assistantName.value = result.name;
      }
      if (result.avatar) {
        assistantAvatar.value = result.avatar;
      }
      if (result.agentId) {
        assistantAgentId.value = result.agentId;
      }

      log.ui.info("Loaded assistant identity:", assistantName.value);
    }
  } catch (err) {
    log.ui.error("Failed to load assistant identity:", err);
    // Keep defaults on error
  } finally {
    isLoadingIdentity.value = false;
  }
}

/**
 * Set user identity (from settings or login)
 */
function setUserIdentity(name: string, avatar?: string | null): void {
  userName.value = name || DEFAULT_USER_NAME;
  userAvatar.value = avatar ?? null;
}
