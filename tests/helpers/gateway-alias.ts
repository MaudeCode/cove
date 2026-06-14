import { mock } from "bun:test";
import { signal, type Signal } from "@preact/signals";
import { createGatewayMock } from "./module-mocks";

type GatewayEventHandler = (event: { event: string; payload?: unknown }) => void;
type NamedGatewayHandler = (payload: unknown) => void;

interface GatewayAliasMockState {
  connectedAt: Signal<number | null>;
  connect: (params: unknown) => Promise<unknown>;
  connectionState: Signal<string>;
  disconnect: () => void;
  gatewayConfigPath: Signal<string>;
  gatewayStateDir: Signal<string>;
  gatewayUptime: Signal<number | null>;
  gatewayUrl: Signal<string>;
  gatewayVersion: Signal<string>;
  isConnected: Signal<boolean>;
  lastError: Signal<string | null>;
  mainSessionKey: Signal<string | null>;
  namedHandlers: Map<string, Set<NamedGatewayHandler>>;
  presence: Signal<unknown[]>;
  probeGateway: (url: string, signal?: AbortSignal) => Promise<unknown>;
  reconnectAttempt: Signal<number>;
  send: (method: string, params?: unknown) => Promise<unknown>;
  subscriptions: GatewayEventHandler[];
  tickIntervalMs: Signal<number>;
}

const state: GatewayAliasMockState = {
  connectedAt: signal<number | null>(1_000),
  connect: async () => undefined,
  connectionState: signal("connected"),
  disconnect: () => undefined,
  gatewayConfigPath: signal("/config/openclaw.json"),
  gatewayStateDir: signal("/state"),
  gatewayUptime: signal<number | null>(90_000),
  gatewayUrl: signal("wss://gateway.local"),
  gatewayVersion: signal("2026.5.27"),
  isConnected: signal(true),
  lastError: signal<string | null>(null),
  mainSessionKey: signal<string | null>("main"),
  namedHandlers: new Map(),
  presence: signal([]),
  probeGateway: async () => ({ ok: true }),
  reconnectAttempt: signal(0),
  send: async (method: string) => {
    throw new Error(`Unexpected gateway method: ${method}`);
  },
  subscriptions: [],
  tickIntervalMs: signal(1000),
};

let installed = false;

export function installGatewayAliasMock(): GatewayAliasMockState {
  if (!installed) {
    installed = true;
    mock.module("@/lib/gateway", () => ({
      ...createGatewayMock({
        connectedAt: state.connectedAt,
        connect: (params: unknown) => state.connect(params),
        connectionState: state.connectionState,
        disconnect: () => state.disconnect(),
        gatewayConfigPath: state.gatewayConfigPath,
        gatewayStateDir: state.gatewayStateDir,
        gatewayUptime: state.gatewayUptime,
        gatewayUrl: state.gatewayUrl,
        gatewayVersion: state.gatewayVersion,
        isConnected: state.isConnected,
        lastError: state.lastError,
        mainSessionKey: state.mainSessionKey,
        on: (...args: unknown[]) => {
          const [event, handler] = args as [string, NamedGatewayHandler];
          const handlers = state.namedHandlers.get(event) ?? new Set<NamedGatewayHandler>();
          handlers.add(handler);
          state.namedHandlers.set(event, handlers);
          return () => {
            handlers.delete(handler);
            if (handlers.size === 0) {
              state.namedHandlers.delete(event);
            }
          };
        },
        presence: state.presence,
        probeGateway: (url: string, signal?: AbortSignal) => state.probeGateway(url, signal),
        reconnectAttempt: state.reconnectAttempt,
        send: (method: string, params?: unknown) => state.send(method, params),
        subscribe: (handler: unknown) => {
          const typedHandler = handler as GatewayEventHandler;
          state.subscriptions.push(typedHandler);
          return () => {
            state.subscriptions = state.subscriptions.filter((item) => item !== typedHandler);
          };
        },
        tickIntervalMs: state.tickIntervalMs,
      }),
    }));
  }

  return state;
}

export function resetGatewayAliasMock(): GatewayAliasMockState {
  state.connectedAt.value = 1_000;
  state.connect = async () => undefined;
  state.connectionState.value = "connected";
  state.disconnect = () => undefined;
  state.gatewayConfigPath.value = "/config/openclaw.json";
  state.gatewayStateDir.value = "/state";
  state.gatewayUptime.value = 90_000;
  state.gatewayUrl.value = "wss://gateway.local";
  state.gatewayVersion.value = "2026.5.27";
  state.isConnected.value = true;
  state.lastError.value = null;
  state.mainSessionKey.value = "main";
  state.namedHandlers.clear();
  state.presence.value = [];
  state.probeGateway = async () => ({ ok: true });
  state.reconnectAttempt.value = 0;
  state.subscriptions = [];
  state.tickIntervalMs.value = 1000;
  state.send = async (method: string) => {
    throw new Error(`Unexpected gateway method: ${method}`);
  };
  return state;
}
