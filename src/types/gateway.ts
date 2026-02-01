/**
 * Gateway Protocol Types
 *
 * Matches OpenClaw's WebSocket protocol.
 */

/** Request message sent to gateway */
export interface GatewayRequest {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
}

/** Response message from gateway */
export interface GatewayResponse {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    message: string;
    code?: string;
  };
}

/** Event message from gateway */
export interface GatewayEvent {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
}

/** Union of all gateway messages */
export type GatewayMessage = GatewayRequest | GatewayResponse | GatewayEvent;

/** Hello response after successful auth (hello-ok payload) */
export interface HelloPayload {
  type: "hello-ok";
  protocol: number;
  server: {
    version: string;
    commit?: string;
    host?: string;
    connId: string;
  };
  features: {
    methods: string[];
    events: string[];
  };
  snapshot: {
    presence: unknown[];
    stateVersion: {
      presence: number;
      health: number;
    };
    health?: unknown;
    sessionDefaults?: {
      defaultAgentId?: string;
      mainKey?: string;
      mainSessionKey?: string;
      scope?: string;
    };
    uptimeMs?: number;
    configPath?: string;
    stateDir?: string;
  };
  canvasHostUrl?: string;
  auth?: {
    deviceToken: string;
    role: string;
    scopes: string[];
    issuedAtMs?: number;
  };
  policy: {
    maxPayload: number;
    maxBufferedBytes: number;
    tickIntervalMs: number;
  };
}
