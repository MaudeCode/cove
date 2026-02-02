/**
 * Exec Approval Signals
 *
 * Manages the queue of pending exec approval requests.
 * Subscribes to gateway exec.approval events.
 */

import { signal } from "@preact/signals";
import { subscribe, send, isConnected } from "@/lib/gateway";
import { log } from "@/lib/logger";
import type { ExecApprovalItem, ExecApprovalRequest, ExecApprovalDecision } from "@/types/exec";

// ============================================
// Signals
// ============================================

/** Queue of pending exec approval requests */
const execApprovalQueue = signal<ExecApprovalItem[]>([]);

/** Map of resolved approval IDs to their decisions (to prevent re-showing after approval) */
export const resolvedApprovalIds = signal<Map<string, string>>(new Map());

/** Prune resolved approvals older than 5 minutes to prevent memory buildup */
const RESOLVED_TTL_MS = 5 * 60 * 1000;
const resolvedTimestamps = new Map<string, number>();

function pruneResolvedApprovals(): void {
  const now = Date.now();
  const toRemove: string[] = [];
  for (const [id, timestamp] of resolvedTimestamps) {
    if (now - timestamp > RESOLVED_TTL_MS) {
      toRemove.push(id);
    }
  }
  if (toRemove.length > 0) {
    const newMap = new Map(resolvedApprovalIds.value);
    for (const id of toRemove) {
      newMap.delete(id);
      resolvedTimestamps.delete(id);
    }
    resolvedApprovalIds.value = newMap;
    log.exec.debug(`Pruned ${toRemove.length} old resolved approval(s)`);
  }
}

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
  log.exec.info(
    `Exec approval queued: ${request.command} (${execApprovalQueue.value.length} pending)`,
  );
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
 * Handle user's decision on an exec approval request (direct ID)
 * Used when approval info comes from tool result rather than queue
 */
export async function handleExecApprovalDecisionDirect(
  approvalId: string,
  decision: ExecApprovalDecision,
): Promise<void> {
  execApprovalBusy.value = true;
  execApprovalError.value = null;

  try {
    // Gateway method is exec.approval.resolve with { id, decision }
    await send("exec.approval.resolve", {
      id: approvalId,
      decision,
    });

    // Also remove from queue if it's there
    dequeueApproval(approvalId);

    // Track as resolved with decision to prevent re-showing on re-render
    const newMap = new Map(resolvedApprovalIds.value);
    newMap.set(approvalId, decision);
    resolvedApprovalIds.value = newMap;
    resolvedTimestamps.set(approvalId, Date.now());

    // Prune old resolved approvals
    pruneResolvedApprovals();

    log.exec.info(`Exec ${decision} (direct): id=${approvalId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to send decision";
    execApprovalError.value = message;
    log.exec.error(`Exec approval error: ${message}`);
    throw err;
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
  // Gateway sends: { id, request: { command, cwd, ... }, createdAtMs, expiresAtMs }
  unsubscribe = subscribe((event) => {
    if (event.event === "exec.approval.requested" && event.payload) {
      const payload = event.payload as {
        id: string;
        request: {
          command: string;
          cwd?: string | null;
          host?: string | null;
          security?: string | null;
          ask?: string | null;
          agentId?: string | null;
          resolvedPath?: string | null;
          sessionKey?: string | null;
        };
        createdAtMs: number;
        expiresAtMs: number;
      };

      // Flatten the payload into our request format
      const request: ExecApprovalRequest = {
        requestId: payload.id,
        command: payload.request.command,
        cwd: payload.request.cwd ?? undefined,
        host: payload.request.host ?? undefined,
        security: payload.request.security ?? undefined,
        ask: payload.request.ask ?? undefined,
        agentId: payload.request.agentId ?? undefined,
        resolvedPath: payload.request.resolvedPath ?? undefined,
        sessionKey: payload.request.sessionKey ?? undefined,
        expiresAtMs: payload.expiresAtMs,
      };

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
