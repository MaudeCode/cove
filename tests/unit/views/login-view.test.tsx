/** @jsxImportSource preact */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { fireEvent, renderComponent, screen, waitFor } from "../../helpers/dom";
import { installI18nMock } from "../../helpers/i18n";
import { createGatewayMock } from "../../helpers/module-mocks";
import { MockInput, installUiMocks } from "../../helpers/ui-mocks";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const calls = {
  connect: [] as unknown[],
  initConnectedApp: 0,
  initPostConnectApp: 0,
  order: [] as string[],
  saveAuth: [] as unknown[],
  startCanvasNodeConnectionIfEnabled: 0,
};
const lastError = signal<string | null>(null);
let connectImpl: () => Promise<void>;
let initPostConnectImpl: () => Promise<void>;

installI18nMock({ t: (key: string) => key });
mock.module("@/lib/logger", () => ({ log: { auth: { error: () => undefined } } }));
mock.module("@/lib/gateway", () => ({
  ...createGatewayMock({
    connect: (params: unknown) => {
      calls.connect.push(params);
      return connectImpl();
    },
    lastError,
  }),
}));
mock.module(
  "@/lib/login-error-classification",
  () => import("../../../src/lib/login-error-classification"),
);
mock.module("@/lib/connected-app", () => ({
  initConnectedApp: async () => {
    calls.initConnectedApp++;
  },
  initPostConnectApp: async () => {
    calls.initPostConnectApp++;
    calls.order.push("initPostConnectApp");
    await initPostConnectImpl();
  },
  startCanvasNodeConnectionIfEnabled: () => {
    calls.startCanvasNodeConnectionIfEnabled++;
    calls.order.push("startCanvasNodeConnectionIfEnabled");
  },
}));
mock.module("@/signals/agents", () => ({
  loadAgents: async () => undefined,
}));
mock.module("@/lib/storage", () => ({
  completeOnboarding: () => undefined,
  getAuth: () => null,
  getSessionCredential: () => null,
  saveAuth: (params: unknown) => {
    calls.saveAuth.push(params);
    calls.order.push("saveAuth");
  },
  setPendingTour: () => undefined,
}));

installUiMocks({
  "@/components/ui/CoveLogo": () => ({ CoveLogo: () => <div /> }),
  "@/components/ui/FormField": () => ({
    FormField: ({
      children,
      htmlFor,
      label,
    }: {
      children: ComponentChildren;
      htmlFor?: string;
      label: string;
    }) => (
      <label htmlFor={htmlFor}>
        {label}
        {children}
      </label>
    ),
  }),
  "@/components/ui/PasswordInput": () => ({
    PasswordInput: MockInput,
  }),
});

const { LoginView } =
  // @ts-ignore Query suffix isolates this view from other module-cache mocks.
  await import("../../../src/views/LoginView.tsx?unit=manual-login");

beforeEach(() => {
  calls.connect.length = 0;
  calls.initConnectedApp = 0;
  calls.initPostConnectApp = 0;
  calls.order.length = 0;
  calls.saveAuth.length = 0;
  calls.startCanvasNodeConnectionIfEnabled = 0;
  lastError.value = null;
  connectImpl = async () => undefined;
  initPostConnectImpl = async () => undefined;
});

describe("LoginView", () => {
  test("manual login uses the shared post-connect bootstrap before saving credentials", async () => {
    const bootstrapReady = deferred<void>();
    initPostConnectImpl = () => bootstrapReady.promise;

    renderComponent(<LoginView />);

    fireEvent.input(screen.getByLabelText("common.gatewayUrl"), {
      target: { value: "ws://gateway.example.test" },
    });
    fireEvent.input(screen.getByLabelText("common.token"), { target: { value: "tok_manual" } });
    fireEvent.click(screen.getByRole("button", { name: "actions.connect" }));
    await flushPromises();

    expect(calls.connect).toEqual([
      {
        autoReconnect: true,
        password: undefined,
        token: "tok_manual",
        url: "ws://gateway.example.test",
      },
    ]);
    expect(calls.initPostConnectApp).toBe(1);
    expect(calls.initConnectedApp).toBe(0);
    expect(calls.startCanvasNodeConnectionIfEnabled).toBe(0);
    expect(calls.saveAuth).toEqual([]);

    bootstrapReady.resolve();
    await waitFor(() => expect(calls.saveAuth).toHaveLength(1));
    expect(calls.saveAuth[0]).toEqual({
      authMode: "token",
      credential: "tok_manual",
      rememberMe: true,
      url: "ws://gateway.example.test",
    });
    expect(calls.startCanvasNodeConnectionIfEnabled).toBe(1);
    expect(calls.order).toEqual([
      "initPostConnectApp",
      "saveAuth",
      "startCanvasNodeConnectionIfEnabled",
    ]);
  });

  test("surfaces expired token guidance without echoing the token", async () => {
    connectImpl = async () => {
      throw Object.assign(new Error("Token tok_live_secret expired"), {
        code: "AUTH_TOKEN_EXPIRED",
      });
    };

    renderComponent(<LoginView />);

    fireEvent.input(screen.getByLabelText("common.gatewayUrl"), {
      target: { value: "ws://gateway.example.test" },
    });
    fireEvent.input(screen.getByLabelText("common.token"), {
      target: { value: "tok_live_secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "actions.connect" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "The saved token has expired. Generate a new operator token in OpenClaw and try again.",
        ),
      ).toBeTruthy();
    });
    expect(document.body.textContent).not.toContain("tok_live_secret");
    expect(calls.saveAuth).toEqual([]);
  });

  test("surfaces wrong-password guidance for password login failures", async () => {
    connectImpl = async () => {
      throw Object.assign(new Error("Invalid password"), {
        code: "AUTH_FAILED",
      });
    };

    renderComponent(<LoginView />);

    fireEvent.input(screen.getByLabelText("common.gatewayUrl"), {
      target: { value: "ws://gateway.example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Auth Mode" }));
    fireEvent.click(screen.getAllByRole("option")[1]);
    fireEvent.input(screen.getByLabelText("common.password"), {
      target: { value: "password-secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "actions.connect" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "The gateway rejected the password. Re-enter the gateway password and try again.",
        ),
      ).toBeTruthy();
    });
    expect(document.body.textContent).not.toContain("password-secret");
    expect(calls.saveAuth).toEqual([]);
  });

  test("surfaces gateway-unavailable guidance for network failures", async () => {
    connectImpl = async () => {
      throw new Error("WebSocket error - check console for details");
    };

    renderComponent(<LoginView />);

    fireEvent.input(screen.getByLabelText("common.gatewayUrl"), {
      target: { value: "ws://gateway.example.test" },
    });
    fireEvent.input(screen.getByLabelText("common.token"), { target: { value: "tok_network" } });
    fireEvent.click(screen.getByRole("button", { name: "actions.connect" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Cove could not reach the gateway. Check that OpenClaw is running and that the WebSocket URL is reachable.",
        ),
      ).toBeTruthy();
    });
  });

  test("surfaces structured gateway remediation with collapsed redacted diagnostics", async () => {
    connectImpl = async () => {
      throw Object.assign(new Error("Operator auth is disabled for token tok_structured_secret"), {
        code: "AUTH_CONFIG_DISABLED",
        details: {
          configPath: "/tmp/openclaw.json",
          password: "password-secret",
          token: "tok_structured_secret",
        },
        remediation: "Enable operator auth in the gateway config.",
      });
    };

    renderComponent(<LoginView />);

    fireEvent.input(screen.getByLabelText("common.gatewayUrl"), {
      target: { value: "ws://gateway.example.test" },
    });
    fireEvent.input(screen.getByLabelText("common.token"), {
      target: { value: "tok_structured_secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "actions.connect" }));

    await waitFor(() => {
      expect(screen.getByText("Enable operator auth in the gateway config.")).toBeTruthy();
    });
    expect(screen.getByText("Diagnostic details")).toBeTruthy();
    const diagnostics = screen.getByText("Diagnostic details").closest("details");
    expect(diagnostics).toBeTruthy();
    expect(diagnostics?.hasAttribute("open")).toBe(false);
    expect(screen.getByText(/configPath/)).toBeTruthy();
    expect(document.body.textContent).toContain('"password": "[redacted]"');
    expect(document.body.textContent).toContain('"token": "[redacted]"');
    expect(document.body.textContent).not.toContain("tok_structured_secret");
    expect(document.body.textContent).not.toContain("password-secret");
  });

  test("clears classified gateway failures when the credential changes", async () => {
    connectImpl = async () => {
      lastError.value = "Token tok_stale_secret expired";
      throw Object.assign(new Error("Token tok_stale_secret expired"), {
        code: "AUTH_TOKEN_EXPIRED",
      });
    };

    renderComponent(<LoginView />);

    fireEvent.input(screen.getByLabelText("common.gatewayUrl"), {
      target: { value: "ws://gateway.example.test" },
    });
    fireEvent.input(screen.getByLabelText("common.token"), {
      target: { value: "tok_stale_secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "actions.connect" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "The saved token has expired. Generate a new operator token in OpenClaw and try again.",
        ),
      ).toBeTruthy();
    });

    fireEvent.input(screen.getByLabelText("common.token"), {
      target: { value: "tok_new_secret" },
    });

    expect(
      screen.queryByText(
        "The saved token has expired. Generate a new operator token in OpenClaw and try again.",
      ),
    ).toBeNull();
    expect(document.body.textContent).not.toContain("tok_stale_secret");
  });

  test("renders classified fallback errors from gateway lastError", () => {
    lastError.value = "Connection closed";

    renderComponent(<LoginView />);

    expect(
      screen.getByText(
        "Cove could not reach the gateway. Check that OpenClaw is running and that the WebSocket URL is reachable.",
      ),
    ).toBeTruthy();
  });
});

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function flushPromises(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await Promise.resolve();
  }
}
