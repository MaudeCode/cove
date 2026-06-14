import { mock } from "bun:test";
import { signal } from "@preact/signals";

type GatewayEventHandler = (event: { event: string; payload?: unknown }) => void;
type NamedGatewayHandler = (payload: unknown) => void;

interface GatewayAliasMockState {
  connect: (params: unknown) => Promise<unknown>;
  disconnect: () => void;
  isConnected: ReturnType<typeof signal<boolean>>;
  lastError: ReturnType<typeof signal<string | null>>;
  mainSessionKey: ReturnType<typeof signal<string | null>>;
  namedHandlers: Map<string, Set<NamedGatewayHandler>>;
  probeGateway: (url: string, signal?: AbortSignal) => Promise<unknown>;
  send: (method: string, params?: unknown) => Promise<unknown>;
  subscriptions: GatewayEventHandler[];
}

const state: GatewayAliasMockState = {
  connect: async () => undefined,
  disconnect: () => undefined,
  isConnected: signal(false),
  lastError: signal<string | null>(null),
  mainSessionKey: signal<string | null>("main"),
  namedHandlers: new Map(),
  probeGateway: async () => ({ ok: true }),
  send: async (method: string) => {
    throw new Error(`Unexpected gateway method: ${method}`);
  },
  subscriptions: [],
};

let installed = false;

export function installGatewayAliasMock(): GatewayAliasMockState {
  if (!installed) {
    installed = true;
    mock.module("@/lib/gateway", () => ({
      connect: (params: unknown) => state.connect(params),
      disconnect: () => state.disconnect(),
      gateway: {
        send: (method: string, params?: unknown) => state.send(method, params),
      },
      isConnected: state.isConnected,
      lastError: state.lastError,
      mainSessionKey: state.mainSessionKey,
      on: (event: string, handler: NamedGatewayHandler) => {
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
      probeGateway: (url: string, signal?: AbortSignal) => state.probeGateway(url, signal),
      send: (method: string, params?: unknown) => state.send(method, params),
      subscribe: (handler: GatewayEventHandler) => {
        state.subscriptions.push(handler);
        return () => {
          state.subscriptions = state.subscriptions.filter((item) => item !== handler);
        };
      },
    }));
  }

  return state;
}

export function resetGatewayAliasMock(): GatewayAliasMockState {
  state.connect = async () => undefined;
  state.disconnect = () => undefined;
  state.isConnected.value = false;
  state.lastError.value = null;
  state.mainSessionKey.value = "main";
  state.namedHandlers.clear();
  state.probeGateway = async () => ({ ok: true });
  state.subscriptions = [];
  state.send = async (method: string) => {
    throw new Error(`Unexpected gateway method: ${method}`);
  };
  return state;
}
