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
