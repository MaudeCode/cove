/**
 * Agents Signal
 *
 * State management for available OpenClaw agents.
 */

import { signal, computed } from "@preact/signals";
import type { Agent } from "@/types/agents";
import { send } from "@/lib/gateway";
import { log } from "@/lib/logger";

// ============================================================================
// State
// ============================================================================

/** List of available agents */
export const agents = signal<Agent[]>([]);

/** Default agent ID from config */
export const defaultAgentId = signal<string>("main");

/** Main session key from config */
export const mainSessionKey = signal<string>("main");

/** Loading state */
export const agentsLoading = signal(false);

/** Error state */
export const agentsError = signal<string | null>(null);

// ============================================================================
// Computed
// ============================================================================

/** Agent options for dropdowns (id + formatted label) */
export const agentOptions = computed(() => {
  return agents.value.map((agent) => ({
    value: agent.id,
    label: `${agent.identity?.emoji || "🤖"} ${agent.identity?.name || agent.name || agent.id}`,
  }));
});

// ============================================================================
// Actions
// ============================================================================

/**
 * Load agents from gateway
 */
export async function loadAgents(): Promise<void> {
  if (agentsLoading.value) {
    log.gateway.debug("loadAgents: already loading, skipping");
    return;
  }

  agentsLoading.value = true;
  agentsError.value = null;

  try {
    log.gateway.debug("loadAgents: fetching from gateway");
    const response = await send("agents.list", {});

    if (response && Array.isArray(response.agents)) {
      agents.value = response.agents;
      defaultAgentId.value = response.defaultId || "main";
      mainSessionKey.value = response.mainKey || "main";

      log.gateway.info("loadAgents: loaded", {
        count: response.agents.length,
        defaultId: response.defaultId,
        agents: response.agents.map((a) => a.id),
      });
    } else {
      throw new Error("Invalid response from agents.list");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load agents";
    log.gateway.error("loadAgents: error", { error: message });
    agentsError.value = message;

    // Set a fallback agent so UI doesn't break
    if (agents.value.length === 0) {
      agents.value = [{ id: "main", identity: { name: "Main", emoji: "🤖" } }];
      defaultAgentId.value = "main";
    }
  } finally {
    agentsLoading.value = false;
  }
}
