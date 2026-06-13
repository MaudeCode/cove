/** @jsxImportSource preact */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import { fireEvent, renderComponent, screen, waitFor } from "../../../helpers/dom";
import { createSessionSignalsMock } from "../../../helpers/module-mocks";
import { installFakeTimers, type FakeTimers } from "../../../helpers/timers";

type Deferred<T> = {
  promise: Promise<T>;
  reject: (error: unknown) => void;
  resolve: (value: T) => void;
};

const calls = {
  completeOnboarding: 0,
  connect: [] as unknown[],
  disconnect: 0,
  initChat: [] as string[],
  initExecApproval: 0,
  initSessionEventSubscription: 0,
  loadAssistantIdentity: 0,
  loadModels: 0,
  loadSessions: 0,
  probeGateway: [] as Array<{ signal?: AbortSignal; url: string }>,
  saveAuth: [] as unknown[],
  setActiveSession: [] as string[],
  setPendingTour: [] as boolean[],
  startUsagePolling: 0,
};
const appMode = signal<"single" | "multi">("single");
const canvasNodeEnabled = signal(false);
const lastError = signal<string | null>(null);
let timers: FakeTimers;
let probeGatewayImpl: (
  url: string,
  signal?: AbortSignal,
) => Promise<{ error?: string; ok: boolean }>;
let connectImpl: () => Promise<void>;
let loadSessionsImpl: () => Promise<void>;

mock.module("@/lib/i18n", () => ({ t: (key: string) => key }));
mock.module("@/lib/logger", () => ({ log: { auth: { error: () => undefined } } }));
mock.module("@/signals/settings", () => ({ appMode, canvasNodeEnabled }));
mock.module("@/lib/node-connection", () => ({
  nodeConnected: signal(false),
  nodePairingStatus: signal("unpaired"),
  startNodeConnection: () => undefined,
  stopNodeConnection: () => undefined,
}));
mock.module("@/lib/gateway", () => ({
  connect: (params: unknown) => {
    calls.connect.push(params);
    return connectImpl();
  },
  disconnect: () => {
    calls.disconnect++;
  },
  lastError,
  probeGateway: (url: string, signal?: AbortSignal) => {
    calls.probeGateway.push({ signal, url });
    return probeGatewayImpl(url, signal);
  },
}));
mock.module("@/lib/chat/init", () => ({
  initChat: async (session: string) => {
    calls.initChat.push(session);
  },
}));
mock.module("@/signals/sessions", () => ({
  ...createSessionSignalsMock(),
  initSessionEventSubscription: () => {
    calls.initSessionEventSubscription++;
  },
  loadSessions: () => {
    calls.loadSessions++;
    return loadSessionsImpl();
  },
  setActiveSession: (session: string) => {
    calls.setActiveSession.push(session);
  },
}));
mock.module("@/signals/identity", () => ({
  loadAssistantIdentity: async () => {
    calls.loadAssistantIdentity++;
  },
}));
mock.module("@/signals/usage", () => ({
  startUsagePolling: () => {
    calls.startUsagePolling++;
  },
}));
mock.module("@/signals/models", () => ({
  loadModels: () => {
    calls.loadModels++;
  },
}));
mock.module("@/signals/exec", () => ({
  initExecApproval: () => {
    calls.initExecApproval++;
  },
}));
mock.module("@/lib/storage", () => ({
  completeOnboarding: () => {
    calls.completeOnboarding++;
  },
  saveAuth: (params: unknown) => {
    calls.saveAuth.push(params);
  },
  setPendingTour: (show: boolean) => {
    calls.setPendingTour.push(show);
  },
}));

mockUi();

const { WelcomeWizard } =
  // @ts-ignore Query suffix isolates the wizard from other module-cache mocks.
  await import("../../../../src/components/onboarding/WelcomeWizard.tsx?unit=welcome");

beforeEach(() => {
  timers = installFakeTimers();
  for (const key of Object.keys(calls) as Array<keyof typeof calls>) {
    if (Array.isArray(calls[key])) {
      (calls[key] as unknown[]).length = 0;
    } else {
      (calls[key] as number) = 0;
    }
  }
  appMode.value = "single";
  canvasNodeEnabled.value = false;
  lastError.value = null;
  probeGatewayImpl = async () => ({ ok: true });
  connectImpl = async () => undefined;
  loadSessionsImpl = async () => undefined;
});

describe("WelcomeWizard", () => {
  test("debounces probes, aborts stale URL probes, and only advances after latest success", async () => {
    const firstProbe = deferred<{ error?: string; ok: boolean }>();
    const secondProbe = deferred<{ error?: string; ok: boolean }>();
    probeGatewayImpl = (_url, signal) => (signal ? firstProbe.promise : secondProbe.promise);
    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: "onboarding.getStarted" }));
    fireEvent.input(screen.getByLabelText("common.gatewayUrl"), {
      target: { value: "ws://one.example.test" },
    });
    timers.advanceBy(599);
    expect(calls.probeGateway).toEqual([]);

    timers.advanceBy(1);
    await flushPromises();
    expect(calls.probeGateway[0]?.url).toBe("ws://one.example.test");

    fireEvent.input(screen.getByLabelText("common.gatewayUrl"), {
      target: { value: "ws://two.example.test" },
    });
    expect(calls.probeGateway[0]?.signal?.aborted).toBe(true);

    firstProbe.resolve({ ok: true });
    await flushPromises();
    expect(
      (screen.getByRole("button", { name: "actions.continue" }) as HTMLButtonElement).disabled,
    ).toBe(true);

    probeGatewayImpl = () => secondProbe.promise;
    timers.advanceBy(600);
    await flushPromises();
    secondProbe.resolve({ ok: true });
    await flushPromises();

    const continueButton = screen.getByRole("button", { name: "actions.continue" });
    expect((continueButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(continueButton);
    expect(screen.getByText("onboarding.authTitle")).toBeTruthy();
  });

  test("successful connect saves auth and runs post-connect loaders before completion", async () => {
    const sessionsLoaded = deferred<void>();
    loadSessionsImpl = () => sessionsLoaded.promise;
    await renderReadyAuthStep();

    fireEvent.input(screen.getByLabelText("common.token"), { target: { value: "tok_test" } });
    fireEvent.click(screen.getByRole("button", { name: "actions.connect" }));
    await flushPromises();

    expect(calls.connect).toEqual([
      {
        autoReconnect: true,
        password: undefined,
        token: "tok_test",
        url: "ws://gateway.example.test",
      },
    ]);
    expect(calls.saveAuth).toHaveLength(0);
    expect(calls.completeOnboarding).toBe(0);
    expect(calls.loadSessions).toBe(1);
    expect(screen.queryByText("onboarding.success")).toBeNull();

    sessionsLoaded.resolve();
    await waitFor(() => expect(screen.getByText("onboarding.success")).toBeTruthy());

    expect(calls.initSessionEventSubscription).toBe(1);
    expect(calls.loadAssistantIdentity).toBe(1);
    expect(calls.setActiveSession).toEqual(["main"]);
    expect(calls.initChat).toEqual(["main"]);
    expect(calls.startUsagePolling).toBe(1);
    expect(calls.loadModels).toBe(1);
    expect(calls.initExecApproval).toBe(1);
    expect(calls.saveAuth).toHaveLength(1);
    expect(calls.completeOnboarding).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "actions.continue" }));
    expect(calls.setPendingTour).toEqual([true]);
  });

  test("post-connect loader failures do not complete onboarding", async () => {
    loadSessionsImpl = async () => {
      throw new Error("sessions unavailable");
    };
    await renderReadyAuthStep();

    fireEvent.input(screen.getByLabelText("common.token"), { target: { value: "tok_partial" } });
    fireEvent.click(screen.getByRole("button", { name: "actions.connect" }));
    await flushPromises();

    expect(calls.saveAuth).toHaveLength(0);
    expect(calls.loadSessions).toBe(1);
    expect(calls.completeOnboarding).toBe(0);
    expect(screen.getByText("onboarding.failed")).toBeTruthy();
    expect(screen.queryByText("onboarding.success")).toBeNull();
  });

  test("failed connect shows retry state without saving or running loaders", async () => {
    connectImpl = async () => {
      lastError.value = "gateway denied";
      throw new Error("gateway denied");
    };
    await renderReadyAuthStep();

    fireEvent.input(screen.getByLabelText("common.token"), { target: { value: "tok_retry" } });
    fireEvent.click(screen.getByRole("button", { name: "actions.connect" }));
    await flushPromises();

    expect(screen.getByText("onboarding.failed")).toBeTruthy();
    expect(screen.getByText("gateway denied")).toBeTruthy();
    expect(calls.saveAuth).toEqual([]);
    expect(calls.loadSessions).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "common.tryAgain" }));
    expect(calls.disconnect).toBe(1);
    expect(screen.getByText("onboarding.authTitle")).toBeTruthy();
    expect((screen.getByLabelText("common.token") as HTMLInputElement).value).toBe("tok_retry");
  });
});

function renderWizard(): void {
  renderComponent(<WelcomeWizard onComplete={() => undefined} onSkip={() => undefined} />);
}

async function renderReadyAuthStep(): Promise<void> {
  renderWizard();
  fireEvent.click(screen.getByRole("button", { name: "onboarding.getStarted" }));
  fireEvent.input(screen.getByLabelText("common.gatewayUrl"), {
    target: { value: "ws://gateway.example.test" },
  });
  timers.advanceBy(600);
  await flushPromises();
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "actions.continue" }) as HTMLButtonElement).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "actions.continue" }));
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, reject, resolve };
}

async function flushPromises(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

afterEach(() => {
  timers.uninstall();
});

function mockUi(): void {
  mock.module("@/components/ui/Button", () => ({
    Button: ({
      children,
      disabled,
      onClick,
    }: {
      children: preact.ComponentChildren;
      disabled?: boolean;
      onClick: () => void;
    }) => (
      <button type="button" disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
  }));
  mock.module("@/components/ui/Input", () => ({
    Input: (props: preact.JSX.HTMLAttributes<HTMLInputElement>) => <input {...props} />,
  }));
  mock.module("@/components/ui/PasswordInput", () => ({
    PasswordInput: (props: preact.JSX.HTMLAttributes<HTMLInputElement>) => <input {...props} />,
  }));
  mock.module("@/components/ui/Dropdown", () => ({
    Dropdown: ({ onChange, value }: { onChange: (value: string) => void; value: string }) => (
      <select
        aria-label="onboarding.authMethod"
        value={value}
        onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
      >
        <option value="token">common.token</option>
        <option value="password">common.password</option>
      </select>
    ),
  }));
  mock.module("@/components/ui/Toggle", () => ({
    Toggle: ({
      checked,
      label,
      onChange,
    }: {
      checked: boolean;
      label?: string;
      onChange: (checked: boolean) => void;
    }) => (
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
        {label}
      </button>
    ),
  }));
  mock.module("@/components/ui/Card", () => ({
    Card: ({ children }: { children: preact.ComponentChildren }) => <section>{children}</section>,
  }));
  mock.module("@/components/ui/FormField", () => ({
    FormField: ({
      children,
      htmlFor,
      label,
    }: {
      children: preact.ComponentChildren;
      htmlFor?: string;
      label: string;
    }) => (
      <label htmlFor={htmlFor}>
        {label}
        {children}
      </label>
    ),
  }));
  mock.module("@/components/ui/CoveLogo", () => ({ CoveLogo: () => <div /> }));
  mock.module("@/components/ui/Spinner", () => ({ Spinner: () => <span>spinner</span> }));
  mock.module("@/components/ui/LinkButton", () => ({
    LinkButton: ({
      children,
      disabled,
      onClick,
    }: {
      children: preact.ComponentChildren;
      disabled?: boolean;
      onClick: () => void;
    }) => (
      <button type="button" disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
  }));
  mock.module("@/components/ui/HintBox", () => ({ HintBox: () => <div /> }));
  mock.module("@/components/ui/StatusIcon", () => ({ StatusIcon: () => <span /> }));
  mock.module("@/components/ui/Tooltip", () => ({
    Tooltip: ({ children }: { children: preact.ComponentChildren }) => <span>{children}</span>,
  }));
}
