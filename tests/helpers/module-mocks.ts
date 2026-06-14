import { computed, signal, type ReadonlySignal, type Signal } from "@preact/signals";

type SignalValue<T> = Signal<T> | ReadonlySignal<T> | { readonly value: T };

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

export interface GatewayMockOptions {
  connectedAt?: SignalValue<number | null>;
  connectionState?: SignalValue<string>;
  connect?: (params: unknown) => unknown;
  disconnect?: () => void;
  gatewayConfigPath?: SignalValue<string | null>;
  gatewayStateDir?: SignalValue<string | null>;
  gatewayUptime?: SignalValue<number | null>;
  gatewayUrl?: SignalValue<string | null>;
  gatewayVersion?: SignalValue<string | null>;
  isConnected?: SignalValue<boolean>;
  lastError?: SignalValue<string | null>;
  mainSessionKey?: SignalValue<string | null>;
  on?: (...args: unknown[]) => () => void;
  presence?: SignalValue<unknown[]>;
  probeGateway?: (url: string, signal?: AbortSignal) => unknown;
  reconnectAttempt?: SignalValue<number>;
  send?: (method: string, params?: unknown) => unknown;
  sendUnknown?: (method: string, params?: unknown) => unknown;
  subscribe?: (handler: unknown) => () => void;
  tickIntervalMs?: SignalValue<number | null>;
}

export type GatewayHarnessCall = {
  method: string;
  params: unknown;
};

type QueuedGatewayResponses = {
  queuedResponses: unknown[];
};

export interface GatewayTestHarness {
  calls: GatewayHarnessCall[];
  connectedAt: Signal<number | null>;
  connectionState: Signal<string>;
  gatewayConfigPath: Signal<string | null>;
  gatewayStateDir: Signal<string | null>;
  gatewayUptime: Signal<number | null>;
  gatewayUrl: Signal<string | null>;
  gatewayVersion: Signal<string | null>;
  isConnected: SignalValue<boolean>;
  lastError: Signal<string | null>;
  mainSessionKey: Signal<string | null>;
  presence: Signal<unknown[]>;
  reconnectAttempt: Signal<number>;
  responses: Map<string, unknown | QueuedGatewayResponses>;
  subscribers: Array<(event: unknown) => void>;
  tickIntervalMs: Signal<number | null>;
  module: (overrides?: GatewayMockOptions) => ReturnType<typeof createGatewayMock>;
  queueResponse: (method: string, ...responses: unknown[]) => void;
  reset: () => void;
  send: (method: string, params?: unknown) => Promise<unknown>;
  sendUnknown: (method: string, params?: unknown) => Promise<unknown>;
  setResponse: (method: string, response: unknown) => void;
  subscribe: (handler: unknown) => () => void;
}

export function createGatewayMock(options: GatewayMockOptions = {}) {
  const connectedAt = options.connectedAt ?? signal<number | null>(1_000);
  const connectionState = options.connectionState ?? signal("connected");
  const isConnected = options.isConnected ?? computed(() => connectionState.value === "connected");
  const lastError = options.lastError ?? signal<string | null>(null);
  const gatewayVersion = options.gatewayVersion ?? signal<string | null>("2026.5.27");
  const gatewayUrl = options.gatewayUrl ?? signal<string | null>("wss://gateway.local");
  const connectionId = signal("conn_1");
  const mainSessionKey = options.mainSessionKey ?? signal<string | null>("main");
  const capabilities = signal(["chat", "logs"]);
  const tickIntervalMs = options.tickIntervalMs ?? signal<number | null>(1000);
  const presence = options.presence ?? signal([]);
  const reconnectAttempt = options.reconnectAttempt ?? signal(0);
  const connect = options.connect ?? (async () => undefined);
  const disconnect = options.disconnect ?? (() => undefined);
  const subscribe = options.subscribe ?? (() => () => undefined);
  const on = options.on ?? (() => () => undefined);
  const send =
    options.send ??
    ((method: string) => {
      throw new Error(`Unexpected gateway method: ${method}`);
    });

  return {
    connectedAt,
    connect,
    connectionState,
    disconnect,
    gateway: {
      capabilities,
      connectedAt,
      connect,
      connectionId,
      disconnect,
      error: lastError,
      isConnected,
      mainSessionKey,
      on,
      presence,
      reconnectAttempt,
      send,
      state: connectionState,
      subscribe,
      tickIntervalMs,
      url: gatewayUrl,
      version: gatewayVersion,
    },
    gatewayConfigPath: options.gatewayConfigPath ?? signal<string | null>("/config/openclaw.json"),
    gatewayStateDir: options.gatewayStateDir ?? signal<string | null>("/state"),
    gatewayUptime: options.gatewayUptime ?? signal<number | null>(90_000),
    gatewayUrl,
    gatewayVersion,
    isConnected,
    lastError,
    mainSessionKey,
    on,
    presence,
    probeGateway: options.probeGateway ?? (async () => ({ ok: true })),
    reconnectAttempt,
    send,
    sendUnknown:
      options.sendUnknown ?? ((method: string, params?: unknown) => send(method, params)),
    subscribe,
    tickIntervalMs,
  };
}

export function createGatewayTestHarness(options: GatewayMockOptions = {}): GatewayTestHarness {
  const calls: GatewayHarnessCall[] = [];
  const responses = new Map<string, unknown | QueuedGatewayResponses>();
  const subscribers: Array<(event: unknown) => void> = [];
  const connectedAt = signalValue(options.connectedAt, 1_000);
  const connectionState = signalValue(options.connectionState, "connected");
  const gatewayConfigPath = signalValue(options.gatewayConfigPath, "/config/openclaw.json");
  const gatewayStateDir = signalValue(options.gatewayStateDir, "/state");
  const gatewayUptime = signalValue(options.gatewayUptime, 90_000);
  const gatewayUrl = signalValue(options.gatewayUrl, "wss://gateway.local");
  const gatewayVersion = signalValue(options.gatewayVersion, "2026.5.27");
  const isConnected = options.isConnected
    ? signalValue(options.isConnected, true)
    : computed(() => connectionState.value === "connected");
  const explicitIsConnected = options.isConnected ? (isConnected as Signal<boolean>) : null;
  const lastError = signalValue(options.lastError, null);
  const mainSessionKey = signalValue(options.mainSessionKey, "main");
  const presence = signalValue(options.presence, []);
  const reconnectAttempt = signalValue(options.reconnectAttempt, 0);
  const tickIntervalMs = signalValue(options.tickIntervalMs, 1000);
  const initialValues = {
    connectedAt: connectedAt.value,
    connectionState: connectionState.value,
    gatewayConfigPath: gatewayConfigPath.value,
    gatewayStateDir: gatewayStateDir.value,
    gatewayUptime: gatewayUptime.value,
    gatewayUrl: gatewayUrl.value,
    gatewayVersion: gatewayVersion.value,
    isConnected: explicitIsConnected?.value,
    lastError: lastError.value,
    mainSessionKey: mainSessionKey.value,
    presence: [...presence.value],
    reconnectAttempt: reconnectAttempt.value,
    tickIntervalMs: tickIntervalMs.value,
  };
  const send = async (method: string, params?: unknown): Promise<unknown> => {
    calls.push({ method, params });
    return takeResponse(responses, method, params, { strict: true });
  };
  const sendUnknown = async (method: string, params?: unknown): Promise<unknown> => {
    calls.push({ method, params });
    return takeResponse(responses, method, params, { strict: true });
  };
  const subscribe = (handler: unknown) => {
    const typedHandler = handler as (event: unknown) => void;
    subscribers.push(typedHandler);
    return () => {
      const index = subscribers.indexOf(typedHandler);
      if (index >= 0) subscribers.splice(index, 1);
    };
  };

  return {
    calls,
    connectedAt,
    connectionState,
    gatewayConfigPath,
    gatewayStateDir,
    gatewayUptime,
    gatewayUrl,
    gatewayVersion,
    isConnected,
    lastError,
    mainSessionKey,
    presence,
    reconnectAttempt,
    responses,
    subscribers,
    tickIntervalMs,
    module: (overrides: GatewayMockOptions = {}) =>
      createGatewayMock({
        connectedAt,
        connectionState,
        gatewayConfigPath,
        gatewayStateDir,
        gatewayUptime,
        gatewayUrl,
        gatewayVersion,
        isConnected,
        lastError,
        mainSessionKey,
        presence,
        reconnectAttempt,
        send,
        sendUnknown,
        subscribe,
        tickIntervalMs,
        ...options,
        ...overrides,
      }),
    queueResponse: (method: string, ...queuedResponses: unknown[]) => {
      responses.set(method, { queuedResponses });
    },
    reset: () => {
      calls.length = 0;
      responses.clear();
      subscribers.length = 0;
      connectedAt.value = initialValues.connectedAt;
      connectionState.value = initialValues.connectionState;
      gatewayConfigPath.value = initialValues.gatewayConfigPath;
      gatewayStateDir.value = initialValues.gatewayStateDir;
      gatewayUptime.value = initialValues.gatewayUptime;
      gatewayUrl.value = initialValues.gatewayUrl;
      gatewayVersion.value = initialValues.gatewayVersion;
      if (explicitIsConnected) {
        explicitIsConnected.value = initialValues.isConnected ?? true;
      }
      lastError.value = initialValues.lastError;
      mainSessionKey.value = initialValues.mainSessionKey;
      presence.value = [...initialValues.presence];
      reconnectAttempt.value = initialValues.reconnectAttempt;
      tickIntervalMs.value = initialValues.tickIntervalMs;
    },
    send,
    sendUnknown,
    setResponse: (method: string, response: unknown) => {
      responses.set(method, response);
    },
    subscribe,
  };
}

function signalValue<T>(value: SignalValue<T> | undefined, fallback: T): Signal<T> {
  return value && "value" in value ? (value as Signal<T>) : signal(fallback);
}

function takeResponse(
  responses: Map<string, unknown | QueuedGatewayResponses>,
  method: string,
  params: unknown,
  options: { strict: boolean },
): unknown {
  if (!responses.has(method)) {
    if (options.strict) {
      throw new Error(`Unexpected gateway method: ${method}`);
    }
    return undefined;
  }
  const entry = responses.get(method);
  if (isQueuedGatewayResponses(entry)) {
    if (entry.queuedResponses.length === 0) {
      if (options.strict) {
        throw new Error(`Unexpected extra gateway method call: ${method}`);
      }
      return undefined;
    }
    const response = entry.queuedResponses.shift();
    if (response instanceof Error) throw response;
    return response;
  }
  const response = entry;
  if (typeof response === "function") {
    return (response as (method: string, params: unknown) => unknown)(method, params);
  }
  if (response instanceof Error) throw response;
  return response;
}

function isQueuedGatewayResponses(entry: unknown): entry is QueuedGatewayResponses {
  return Boolean(
    entry &&
    typeof entry === "object" &&
    "queuedResponses" in entry &&
    Array.isArray((entry as QueuedGatewayResponses).queuedResponses),
  );
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
