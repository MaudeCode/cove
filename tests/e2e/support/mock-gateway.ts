import type { Page } from "@playwright/test";

export async function installMockGateway(page: Page): Promise<void> {
  await page.addInitScript(() => {
    type GatewayRequest = {
      id: string;
      method: string;
      params?: unknown;
      type: "req";
    };

    type ConnectParams = {
      auth?: { password?: string; token?: string };
      client?: { id?: string; mode?: string };
      maxProtocol?: number;
      minProtocol?: number;
      role?: string;
      scopes?: string[];
    };

    const requests: GatewayRequest[] = [];
    const now = Date.now();

    const session = {
      key: "agent:main:main",
      label: "Main",
      displayName: "Main",
      kind: "direct",
      model: "test/model",
      updatedAt: now,
      totalTokens: 0,
      contextTokens: 200_000,
    };

    const results: Record<string, unknown> = {
      "agent.identity.get": {
        agentId: "main",
        name: "Test Assistant",
        avatar: "TC",
      },
      "agents.list": {
        defaultId: "main",
        mainKey: "agent:main:main",
        agents: [
          {
            id: "main",
            name: "main",
            identity: {
              name: "Test Assistant",
              emoji: "TC",
            },
          },
        ],
      },
      "chat.history": {
        sessionKey: "agent:main:main",
        messages: [],
      },
      "device.pair.list": {
        pending: [],
        paired: [
          {
            approvedAtMs: now,
            createdAtMs: now,
            deviceId: "device-1",
            displayName: "Laptop",
            platform: "macos",
            publicKey: "public-key",
            role: "operator",
            tokens: [
              {
                createdAtMs: now,
                role: "operator",
                scopes: [],
              },
            ],
          },
        ],
      },
      "device.token.revoke": {
        ok: true,
      },
      "device.token.rotate": {
        token: "one-time-token",
      },
      health: {
        ok: true,
        ts: now,
        durationMs: 0,
        heartbeatSeconds: 30,
        defaultAgentId: "main",
        agents: [],
        sessions: {
          path: "/tmp/cove-e2e-sessions",
          count: 1,
          recent: [{ key: "agent:main:main", updatedAt: now, age: 0 }],
          defaults: { model: "test/model" },
        },
        channels: {},
        channelOrder: [],
        channelLabels: {},
      },
      "models.list": {
        models: [],
      },
      "sessions.list": {
        count: 1,
        sessions: [session],
      },
      "sessions.subscribe": {
        ok: true,
      },
      status: {
        ok: true,
        sessions: {
          defaults: { model: "test/model" },
        },
      },
      "usage.status": {
        providers: [],
      },
    };

    function helloOk() {
      return {
        type: "hello-ok",
        protocol: 4,
        server: {
          version: "e2e-gateway",
          connId: "e2e-connection",
        },
        features: {
          methods: Object.keys(results),
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
          configPath: "/tmp/cove-e2e-config.json",
          stateDir: "/tmp/cove-e2e-state",
        },
        policy: {
          maxPayload: 1_000_000,
          maxBufferedBytes: 1_000_000,
          tickIntervalMs: 1000,
        },
      };
    }

    class MockGatewayWebSocket extends EventTarget {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;

      readonly CONNECTING = MockGatewayWebSocket.CONNECTING;
      readonly OPEN = MockGatewayWebSocket.OPEN;
      readonly CLOSING = MockGatewayWebSocket.CLOSING;
      readonly CLOSED = MockGatewayWebSocket.CLOSED;

      binaryType: BinaryType = "blob";
      bufferedAmount = 0;
      extensions = "";
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onopen: ((event: Event) => void) | null = null;
      protocol = "";
      readyState = MockGatewayWebSocket.CONNECTING;
      url: string;

      constructor(url: string | URL) {
        super();
        this.url = String(url);
        window.setTimeout(() => {
          this.readyState = MockGatewayWebSocket.OPEN;
          const openEvent = new Event("open");
          this.onopen?.(openEvent);
          this.dispatchEvent(openEvent);
          this.receive({
            type: "event",
            event: "connect.challenge",
            payload: { nonce: "e2e-nonce", ts: 1 },
          });
        }, 0);
      }

      close(code = 1000, reason = ""): void {
        if (this.readyState === MockGatewayWebSocket.CLOSED) return;
        this.readyState = MockGatewayWebSocket.CLOSED;
        const closeEvent = new CloseEvent("close", {
          code,
          reason,
          wasClean: true,
        });
        this.onclose?.(closeEvent);
        this.dispatchEvent(closeEvent);
      }

      send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
        const request = JSON.parse(String(data)) as GatewayRequest;
        requests.push(request);

        if (request.method === "connect") {
          const validationError = validateConnectParams(request.params);
          if (validationError) {
            this.receive({
              type: "res",
              id: request.id,
              ok: false,
              error: {
                code: "INVALID_CONNECT",
                message: validationError,
              },
            });
            return;
          }

          this.receive({
            type: "res",
            id: request.id,
            ok: true,
            payload: helloOk(),
          });
          return;
        }

        if (!(request.method in results)) {
          this.receive({
            type: "res",
            id: request.id,
            ok: false,
            error: {
              code: "METHOD_NOT_FOUND",
              message: `No mock result for ${request.method}`,
            },
          });
          return;
        }

        this.receive({
          type: "res",
          id: request.id,
          ok: true,
          payload: results[request.method],
        });
      }

      private receive(frame: unknown): void {
        const event = new MessageEvent("message", {
          data: JSON.stringify(frame),
        });
        this.onmessage?.(event);
        this.dispatchEvent(event);
      }
    }

    function validateConnectParams(params: unknown): string | null {
      if (!params || typeof params !== "object") return "connect params are required";

      const connect = params as ConnectParams;
      if (connect.minProtocol !== 4 || connect.maxProtocol !== 4) {
        return "connect protocol must be v4";
      }
      if (connect.client?.id !== "openclaw-control-ui") {
        return "connect client id must be openclaw-control-ui";
      }
      if (connect.client.mode !== "ui") {
        return "connect client mode must be ui";
      }
      if (connect.role !== "operator") {
        return "connect role must be operator";
      }
      for (const scope of ["operator.admin", "operator.read", "operator.write"]) {
        if (!connect.scopes?.includes(scope)) {
          return `connect scopes must include ${scope}`;
        }
      }
      if (!connect.auth?.token && !connect.auth?.password) {
        return "connect auth must include token or password";
      }

      return null;
    }

    Object.defineProperty(window, "__coveMockGatewayRequests", {
      configurable: true,
      value: requests,
    });
    window.WebSocket = MockGatewayWebSocket as unknown as typeof WebSocket;
  });
}

export async function mockGatewayMethods(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    (
      (window as unknown as { __coveMockGatewayRequests?: Array<{ method: string }> })
        .__coveMockGatewayRequests ?? []
    ).map((request) => request.method),
  );
}
