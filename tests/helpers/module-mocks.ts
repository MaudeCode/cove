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

interface QueryParamMockOptions {
  initialized?: Signal<boolean> | { value: boolean };
  param?: Signal<string | null> | { value: string | null };
  paramSet?: Signal<Set<unknown>> | { value: Set<unknown> };
}

export function createQueryParamMock(options: QueryParamMockOptions = {}) {
  return {
    pushQueryState: () => undefined,
    toggleSetValue: (target: { value: Set<unknown> }, value: unknown) => {
      const next = new Set(target.value);
      const wasPresent = next.has(value);
      if (wasPresent) {
        next.delete(value);
      } else {
        next.add(value);
      }
      target.value = next;
      return !wasPresent;
    },
    useInitFromParam: () => undefined,
    useQueryParam: () => [
      options.param ?? signal<string | null>(null),
      () => undefined,
      options.initialized ?? signal(true),
    ],
    useQueryParamSet: () => [
      options.paramSet ?? signal(new Set<unknown>()),
      () => undefined,
      options.initialized ?? signal(true),
    ],
    useSyncFilterToParam: () => undefined,
    useSyncToParam: () => undefined,
  };
}

interface UpdateSignalsMockOptions {
  initUpdateSubscription?: () => void;
}

export function createUpdateSignalsMock(options: UpdateSignalsMockOptions = {}) {
  const updateAvailable = signal<{
    channel: string;
    currentVersion: string;
    latestVersion: string;
  } | null>(null);
  const dismissedUpdateVersion = signal<string | null>(null);

  return {
    dismissUpdate: () => {
      const update = updateAvailable.value;
      if (!update) return;
      dismissedUpdateVersion.value = update.latestVersion;
      localStorage.setItem("cove:dismissed-update-version", update.latestVersion);
    },
    dismissedUpdateVersion,
    initUpdateSubscription: options.initUpdateSubscription ?? (() => undefined),
    isUpdateDismissed: () => dismissedUpdateVersion.value === updateAvailable.value?.latestVersion,
    reset: () => {
      updateAvailable.value = null;
      dismissedUpdateVersion.value = null;
    },
    updateAvailable,
  };
}
