/**
 * Usage Signals
 *
 * Tracks provider usage (Anthropic, etc.) for display in the UI.
 * Only fetches when connected to gateway.
 */

import { signal, computed } from "@preact/signals";
import { gateway, isConnected } from "@/lib/gateway";
import { getUsageCache, setUsageCache } from "@/lib/storage";
import { log } from "@/lib/logger";
import type { UsageSummary, ProviderUsageSnapshot, UsageWindow } from "@/types/usage";

// ============================================
// Configuration
// ============================================

/** How often to poll for usage updates (ms) */
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================
// State
// ============================================

/** Raw usage summary from gateway */
const usageSummary = signal<UsageSummary | null>(loadCachedUsage());

/** Whether we're currently fetching usage */
const isLoadingUsage = signal(false);

/** Last fetch error */
const usageError = signal<string | null>(null);

/** Poll timer */
let pollTimer: ReturnType<typeof setInterval> | null = null;

// ============================================
// Computed Values
// ============================================

/** Anthropic usage data (if available) */
export const anthropicUsage = computed<ProviderUsageSnapshot | null>(() => {
  const summary = usageSummary.value;
  if (!summary) return null;
  return summary.providers.find((p) => p.provider === "anthropic") ?? null;
});

/** Whether Anthropic usage is available */
export const hasAnthropicUsage = computed(() => {
  const usage = anthropicUsage.value;
  return usage !== null && usage.windows.length > 0 && !usage.error;
});

/** Primary usage window to display (prefer "Week", fallback to first) */
export const primaryUsageWindow = computed<UsageWindow | null>(() => {
  const usage = anthropicUsage.value;
  if (!usage || usage.windows.length === 0) return null;

  // Prefer weekly window
  const weekly = usage.windows.find((w) => w.label === "Week");
  if (weekly) return weekly;

  // Fallback to first window
  return usage.windows[0];
});

// ============================================
// Cache
// ============================================

/**
 * Load cached usage from storage
 */
function loadCachedUsage(): UsageSummary | null {
  const cached = getUsageCache();
  if (cached) {
    log.usage.debug("Loaded cached usage");
    return cached;
  }
  return null;
}

// ============================================
// Actions
// ============================================

/**
 * Fetch usage from gateway
 */
async function fetchUsage(): Promise<void> {
  if (!isConnected.value) {
    log.usage.debug("Skipping usage fetch - not connected");
    return;
  }

  isLoadingUsage.value = true;
  usageError.value = null;

  try {
    const result = await gateway.send<UsageSummary>("usage.status");
    usageSummary.value = result;
    setUsageCache(result);
    log.usage.debug("Usage fetched:", result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch usage";
    usageError.value = message;
    log.usage.error("Usage fetch failed:", message);
  } finally {
    isLoadingUsage.value = false;
  }
}

/**
 * Start polling for usage updates
 */
export function startUsagePolling(): void {
  stopUsagePolling();

  // Fetch immediately
  fetchUsage();

  // Then poll periodically
  pollTimer = setInterval(() => {
    fetchUsage();
  }, POLL_INTERVAL_MS);

  log.usage.debug("Usage polling started");
}

/**
 * Stop polling for usage updates
 */
function stopUsagePolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    log.usage.debug("Usage polling stopped");
  }
}
