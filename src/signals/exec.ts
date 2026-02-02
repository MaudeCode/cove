/**
 * Exec Approval Signals
 *
 * Manages the queue of pending exec approval requests.
 * Subscribes to gateway exec.approval events.
 */

import { signal, computed } from "@preact/signals";
import { subscribe, send, isConnected } from "@/lib/gateway";
import { log } from "@/lib/logger";
import type { ExecApprovalItem, ExecApprovalRequest, ExecApprovalDecision } from "@/types/exec";

// ============================================
// Signals
// ============================================

/** Queue of pending exec approval requests */
export const execApprovalQueue = signal<ExecApprovalItem[]>([]);

/** Currently active (first in queue) approval request */
export const activeApproval = computed(() => execApprovalQueue.value[0] ?? null);

/** Number of pending approvals */
export const pendingCount = computed(() => execApprovalQueue.value.length);

/** Whether we're currently processing a decision */
export const execApprovalBusy = signal(false);

/** Last error from approval decision */
export const execApprovalError = signal<string | null>(null);

// ============================================
// Queue Management
// ============================================

/**
 * Add a new approval request to the queue
 */
function enqueueApproval(request: ExecApprovalRequest): void {
  const item: ExecApprovalItem = {
    request,
    expiresAtMs: request.expiresAtMs,
    receivedAt: Date.now(),
  };

  execApprovalQueue.value = [...execApprovalQueue.value, item];
  log.exec.info(`Exec approval queued: ${request.command} (${pendingCount.value} pending)`);
}

/**
 * Remove an approval request from the queue
 */
function dequeueApproval(requestId: string): void {
  execApprovalQueue.value = execApprovalQueue.value.filter(
    (item) => item.request.requestId !== requestId,
  );
}

/**
 * Remove expired requests from the queue
 */
function pruneExpired(): void {
  const now = Date.now();
  const before = execApprovalQueue.value.length;
  execApprovalQueue.value = execApprovalQueue.value.filter((item) => item.expiresAtMs > now);
  const pruned = before - execApprovalQueue.value.length;
  if (pruned > 0) {
    log.exec.info(`Pruned ${pruned} expired exec approval(s)`);
  }
}

// ============================================
// Decision Handling
// ============================================

/**
 * Handle user's decision on an exec approval request
 */
export async function handleExecApprovalDecision(decision: ExecApprovalDecision): Promise<void> {
  const active = activeApproval.value;
  if (!active) {
    log.exec.warn("No active approval to decide on");
    return;
  }

  execApprovalBusy.value = true;
  execApprovalError.value = null;

  try {
    const method = decision === "deny" ? "exec.deny" : "exec.approve";
    const params: Record<string, unknown> = {
      requestId: active.request.requestId,
    };

    // For allow-always, include the allowlist flag
    if (decision === "allow-always") {
      params.allowlist = true;
    }

    await send(method, params);

    // Remove from queue on success
    dequeueApproval(active.request.requestId);
    log.exec.info(`Exec ${decision}: ${active.request.command}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send decision";
    execApprovalError.value = message;
    log.exec.error(`Exec approval error: ${message}`);
  } finally {
    execApprovalBusy.value = false;
  }
}

// ============================================
// Gateway Event Subscription
// ============================================

let unsubscribe: (() => void) | null = null;
let pruneInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start listening for exec approval events
 */
export function initExecApproval(): void {
  // Clean up any existing subscription
  cleanupExecApproval();

  // Subscribe to gateway events
  unsubscribe = subscribe((event) => {
    if (event.event === "exec.approval" && event.payload) {
      const request = event.payload as ExecApprovalRequest;

      // Only queue if not expired
      if (request.expiresAtMs > Date.now()) {
        enqueueApproval(request);
      } else {
        log.exec.debug("Ignoring already-expired approval request");
      }
    }
  });

  // Start periodic pruning of expired requests
  pruneInterval = setInterval(pruneExpired, 1000);

  log.exec.info("Exec approval system initialized");
}

/**
 * Stop listening and clear queue
 */
export function cleanupExecApproval(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (pruneInterval) {
    clearInterval(pruneInterval);
    pruneInterval = null;
  }
  execApprovalQueue.value = [];
  execApprovalBusy.value = false;
  execApprovalError.value = null;
}

// Auto-cleanup when disconnected
let prevConnected = false;
isConnected.subscribe((connected) => {
  if (prevConnected && !connected) {
    // Went from connected to disconnected
    cleanupExecApproval();
  }
  prevConnected = connected;
});
