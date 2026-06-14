/**
 * Chat Cleanup Registry
 *
 * Lets chat submodules register teardown hooks without coupling init to them.
 */

const cleanupHandlers = new Set<() => void>();

export function registerChatCleanup(handler: () => void): () => void {
  cleanupHandlers.add(handler);
  return () => cleanupHandlers.delete(handler);
}

export function runChatCleanups(): void {
  for (const handler of cleanupHandlers) {
    handler();
  }
}
