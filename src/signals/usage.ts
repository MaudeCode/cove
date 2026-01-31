/**
 * Usage Signals
 *
 * Tracks provider usage (Anthropic, etc.) for display in the UI.
 * Only fetches when connected to gateway.
 */

import { signal, computed } from "@preact/signals";
import { gateway, isConnected } from "@/lib/gateway";
import { log } from "@/lib/logger";
import type { UsageSummary, ProviderUsageSnapshot, UsageWindow } from "@/types/usage";

// ============================================
// Configuration
// ============================================

/** How often to poll for usage updates (ms) */
const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** Cache key for localStorage */
const CACHE_KEY = "cove:usage-cache";

// ============================================
// State
// ============================================

/** Raw usage summary from gateway */
export const usageSummary = signal<UsageSummary | null>(null);

/** Whether we're currently fetching usage */
export const isLoadingUsage = signal(false);

/** Last fetch error */
export const usageError = signal<string | null>(null);

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
// Actions
// ============================================

/**
 * Fetch usage from gateway
 */
export async function fetchUsage(): Promise<void> {
  if (!isConnected.value) {
    log.usage.debug("Skipping usage fetch - not connected");
    return;
  }

  isLoadingUsage.value = true;
  usageError.value = null;

  try {
    const result = await gateway.send<UsageSummary>("usage.status");
    usageSummary.value = result;

    // Cache to localStorage
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(result));
    } catch {
      // Ignore storage errors
    }

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
export function stopUsagePolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    log.usage.debug("Usage polling stopped");
  }
}

/**
 * Load cached usage from localStorage
 */
export function loadCachedUsage(): void {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      usageSummary.value = JSON.parse(cached) as UsageSummary;
      log.usage.debug("Loaded cached usage");
    }
  } catch {
    // Ignore parse errors
  }
}

/**
 * Clear usage data
 */
export function clearUsage(): void {
  usageSummary.value = null;
  usageError.value = null;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Ignore
  }
}

// ============================================
// Initialize
// ============================================

// Load cache on module init
loadCachedUsage();
