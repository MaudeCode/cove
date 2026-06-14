import type { Message } from "@/types/messages";

/**
 * Tracks reset-command runs whose final messages should be reconciled from
 * chat.history instead of appended from the streaming event path.
 */

const MAX_SUPPRESSED_RESET_RUNS = 100;

type ResetRunState = {
  historyStatus: "pending" | "failed";
  deferredFinal?: Message;
};

const resetRuns = new Map<string, ResetRunState>();
const suppressedResetFinalRunIds = new Set<string>();

function rememberSuppressedResetFinal(runId: string): void {
  suppressedResetFinalRunIds.add(runId);

  if (suppressedResetFinalRunIds.size <= MAX_SUPPRESSED_RESET_RUNS) return;

  const oldest = suppressedResetFinalRunIds.values().next().value;
  if (oldest) {
    suppressedResetFinalRunIds.delete(oldest);
  }
}

export function registerResetRun(runId: string | undefined): void {
  if (!runId) return;
  resetRuns.set(runId, { historyStatus: "pending" });
  suppressedResetFinalRunIds.delete(runId);
}

export function consumeResetRun(runId: string): boolean {
  const wasResetRun = resetRuns.delete(runId);
  if (wasResetRun) {
    rememberSuppressedResetFinal(runId);
  }
  return wasResetRun;
}

export function clearResetRuns(): void {
  for (const runId of resetRuns.keys()) {
    rememberSuppressedResetFinal(runId);
  }
  resetRuns.clear();
}

export function markResetHistorySucceeded(runId: string | undefined): void {
  if (!runId) return;
  if (resetRuns.delete(runId)) {
    rememberSuppressedResetFinal(runId);
  }
}

export function markResetHistoryFailed(runId: string | undefined): Message | undefined {
  if (!runId) return undefined;

  const state = resetRuns.get(runId);
  if (!state) return undefined;

  if (state.deferredFinal) {
    resetRuns.delete(runId);
    rememberSuppressedResetFinal(runId);
    return state.deferredFinal;
  }

  state.historyStatus = "failed";
  return undefined;
}

export function reconcileResetFinal(
  runId: string,
  finalMessage: Message | undefined,
): "not-reset" | "drop" | "defer" | "append" {
  if (suppressedResetFinalRunIds.has(runId)) {
    return "drop";
  }

  const state = resetRuns.get(runId);
  if (!state) {
    return "not-reset";
  }

  if (state.historyStatus === "failed") {
    resetRuns.delete(runId);
    rememberSuppressedResetFinal(runId);
    return "append";
  }

  state.deferredFinal = finalMessage;
  return "defer";
}
