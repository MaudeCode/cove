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

/** Auth configuration for connecting */
export interface AuthConfig {
  /** Auth mode */
  mode: "password" | "token";

  /** Password (if mode is 'password') */
  password?: string;

  /** Token (if mode is 'token') */
  token?: string;
}

/** Hello response after successful auth */
export interface HelloPayload {
  version?: string;
  sessionKey?: string;
  capabilities?: string[];
}
