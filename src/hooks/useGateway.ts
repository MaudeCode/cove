/**
 * Gateway Hook
 *
 * Provides reactive access to gateway state and methods in components.
 *
 * Usage:
 *   import { useGateway } from '@/hooks/useGateway'
 *
 *   function MyComponent() {
 *     const { isConnected, state, send } = useGateway()
 *     // ...
 *   }
 */

import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import {
  connectionState,
  isConnected,
  lastError,
  gatewayVersion,
  sessionKey,
  capabilities,
  reconnectAttempt,
  connect,
  disconnect,
  send,
  subscribe,
  on,
  type RequestOptions,
} from "@/lib/gateway";

/**
 * Hook for accessing gateway state and methods
 */
export function useGateway() {
  return {
    // State (signals - reactive)
    state: connectionState,
    isConnected,
    error: lastError,
    version: gatewayVersion,
    sessionKey,
    capabilities,
    reconnectAttempt,

    // Methods
    connect,
    disconnect,
    send,
    subscribe,
    on,
  };
}

/**
 * Hook for subscribing to gateway events
 *
 * Automatically unsubscribes on unmount.
 */
export function useGatewayEvent(eventType: string, handler: (payload: unknown) => void) {
  useEffect(() => {
    return on(eventType, handler);
  }, [eventType, handler]);
}

/**
 * Hook for subscribing to all gateway events
 *
 * Automatically unsubscribes on unmount.
 */
export function useGatewayEvents(handler: Parameters<typeof subscribe>[0]) {
  useEffect(() => {
    return subscribe(handler);
  }, [handler]);
}

/**
 * Hook for making gateway requests with loading state
 */
export function useGatewayRequest<T = unknown>(
  method: string,
  params?: unknown,
  options?: RequestOptions,
) {
  const loading = useSignal(false);
  const error = useSignal<Error | null>(null);
  const data = useSignal<T | null>(null);

  const execute = async () => {
    loading.value = true;
    error.value = null;

    try {
      const result = await send<T>(method, params, options);
      data.value = result;
      return result;
    } catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err));
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    loading,
    error,
    data,
    execute,
  };
}

// Named export only (no default)
