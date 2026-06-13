import { signal, type Signal } from "@preact/signals";

interface SessionSignalsMockOptions {
  isForActiveSession?: (sessionKey: string) => boolean;
  sessions?: Signal<unknown[]>;
  updateSession?: (sessionKey: string, updates: unknown) => void;
}

export function createSessionSignalsMock(options: SessionSignalsMockOptions = {}) {
  return {
    cleanupSessionEventSubscription: () => undefined,
    clearSessions: () => undefined,
    initSessionEventSubscription: () => undefined,
    isForActiveSession: options.isForActiveSession ?? (() => true),
    loadSessions: async () => undefined,
    sessions: options.sessions ?? signal([]),
    setActiveSession: () => undefined,
    updateSession: options.updateSession ?? (() => undefined),
  };
}

interface GatewayMockOptions {
  disconnect?: () => void;
  isConnected?: Signal<boolean> | { value: boolean };
  lastError?: Signal<string | null> | { value: string | null };
  mainSessionKey?: Signal<string | null> | { value: string | null };
  send?: (method: string, params?: unknown) => unknown;
}

export function createGatewayMock(options: GatewayMockOptions = {}) {
  return {
    connect: async () => undefined,
    disconnect: options.disconnect ?? (() => undefined),
    isConnected: options.isConnected ?? signal(true),
    lastError: options.lastError ?? signal<string | null>(null),
    mainSessionKey: options.mainSessionKey ?? signal<string | null>("main"),
    on: () => () => undefined,
    probeGateway: async () => ({ ok: true }),
    send:
      options.send ??
      ((method: string) => {
        throw new Error(`Unexpected gateway method: ${method}`);
      }),
    subscribe: () => () => undefined,
  };
}
