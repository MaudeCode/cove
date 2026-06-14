import type { GatewayEvent, GatewayResponse, HelloPayload } from "../../../src/types/gateway";

type HelloOverrides = Partial<Omit<HelloPayload, "features" | "policy" | "server" | "snapshot">> & {
  features?: Partial<HelloPayload["features"]>;
  policy?: Partial<HelloPayload["policy"]>;
  server?: Partial<HelloPayload["server"]>;
  snapshot?: Partial<Omit<HelloPayload["snapshot"], "sessionDefaults" | "stateVersion">> & {
    sessionDefaults?: Partial<NonNullable<HelloPayload["snapshot"]["sessionDefaults"]>>;
    stateVersion?: Partial<HelloPayload["snapshot"]["stateVersion"]>;
  };
};

export function connectChallengeFrame(payload: Record<string, unknown> = {}): GatewayEvent {
  return eventFrame("connect.challenge", {
    nonce: "test-nonce",
    ts: 1,
    ...payload,
  });
}

export function eventFrame(event: string, payload?: unknown): GatewayEvent {
  return {
    type: "event",
    event,
    payload,
  };
}

export function responseFrame(id: string, payload: unknown): GatewayResponse {
  return {
    type: "res",
    id,
    ok: true,
    payload,
  };
}

export function errorResponseFrame(
  id: string,
  error: NonNullable<GatewayResponse["error"]>,
): GatewayResponse {
  return {
    type: "res",
    id,
    ok: false,
    error,
  };
}

export function helloOkFrame(overrides: HelloOverrides = {}): HelloPayload {
  const defaultFrame: HelloPayload = {
    type: "hello-ok",
    protocol: 4,
    server: {
      version: "test-gateway",
      connId: "test-connection",
    },
    features: {
      methods: [],
      events: [],
    },
    snapshot: {
      presence: [],
      stateVersion: {
        health: 1,
        presence: 1,
      },
      sessionDefaults: {
        mainSessionKey: "agent:main:main",
      },
      uptimeMs: 0,
    },
    policy: {
      maxPayload: 1_000_000,
      maxBufferedBytes: 1_000_000,
      tickIntervalMs: 1000,
    },
  };
  const stateVersion = { ...defaultFrame.snapshot.stateVersion };

  for (const [key, value] of Object.entries(overrides.snapshot?.stateVersion ?? {})) {
    if (value !== undefined) {
      stateVersion[key] = value;
    }
  }

  return {
    ...defaultFrame,
    ...overrides,
    server: {
      ...defaultFrame.server,
      ...overrides.server,
    },
    features: {
      ...defaultFrame.features,
      ...overrides.features,
    },
    snapshot: {
      ...defaultFrame.snapshot,
      ...overrides.snapshot,
      stateVersion,
      sessionDefaults: {
        ...defaultFrame.snapshot.sessionDefaults,
        ...overrides.snapshot?.sessionDefaults,
      },
    },
    policy: {
      ...defaultFrame.policy,
      ...overrides.policy,
    },
  };
}
