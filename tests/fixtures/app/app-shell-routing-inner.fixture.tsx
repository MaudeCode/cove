/** @jsxImportSource preact */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import { route } from "preact-router";
import type { ComponentChildren } from "preact";
import { renderComponent, screen, waitFor } from "../../helpers/dom";
import { createGatewayMock } from "../../helpers/module-mocks";

type StoredAuth = {
  authMode: "password" | "token";
  rememberMe: boolean;
  url: string;
};

const gatewayConnected = signal(false);
const connectionState = signal("disconnected");
const gatewayVersion = signal("dev");
const mainSessionKey = signal("agent:main:main");
const appMode = signal<"multi" | "single">("single");
const isMultiChatMode = signal(false);
const canvasNodeEnabled = signal(false);
const newChatSettings = signal({ defaultAgentId: "main", useDefaults: true });
const currentPath = signal("/");
const previousRoute = signal("/");
const sidebarOpen = signal(false);
const sidebarWidth = signal(280);
const sidebarResizing = signal(false);
const canvasPanelOpen = signal(false);
const commandPaletteOpen = signal(false);
const showNewChatModal = signal(false);

const storageState = {
  auth: null as StoredAuth | null,
  completedOnboarding: false,
  credential: null as string | null,
  pendingTour: false,
};

const storage = await import("../../../src/lib/storage");

const calls = {
  connect: [] as unknown[],
  initI18n: 0,
  initPostConnectApp: 0,
  initTheme: 0,
};

mock.module("@/lib/theme", () => ({
  initTheme: () => {
    calls.initTheme++;
  },
}));

mock.module("@/lib/i18n", () => ({
  initI18n: () => {
    calls.initI18n++;
  },
  t: (key: string) => key,
}));

mock.module("@/lib/storage", () => ({
  ...storage,
  consumePendingTour: () => {
    const pending = storageState.pendingTour;
    storageState.pendingTour = false;
    return pending;
  },
  getAuth: () => storageState.auth,
  getSidebarWidth: () => sidebarWidth.value,
  getSessionCredential: () => storageState.credential,
  hasCompletedOnboarding: () => storageState.completedOnboarding,
  initStorage: () => undefined,
  setSessionCredential: (credential: string) => {
    storageState.credential = credential || null;
  },
  setSidebarWidth: (width: number) => {
    sidebarWidth.value = width;
  },
}));

mock.module("@/lib/gateway", () => ({
  ...createGatewayMock({
    connect: async (params: unknown) => {
      calls.connect.push(params);
    },
    connectionState,
    gatewayVersion,
    isConnected: gatewayConnected,
    mainSessionKey,
    send: async () => undefined,
  }),
}));

mock.module("@/lib/connected-app", () => ({
  initPostConnectApp: async () => {
    calls.initPostConnectApp++;
  },
}));

mock.module("@/signals/settings", () => ({
  appMode,
  canvasNodeEnabled,
  isMultiChatMode,
  newChatSettings,
}));

mock.module("@/lib/node-connection", () => ({}));

mock.module("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: ComponentChildren }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

mock.module("@/components/layout/Sidebar", () => ({
  currentPath,
}));

mock.module("@/signals/ui", () => ({
  LG_BREAKPOINT: 1024,
  SIDEBAR_MAX_WIDTH: 480,
  SIDEBAR_MIN_WIDTH: 200,
  SIDEBAR_WIDTH_MOBILE: 288,
  canvasPanelOpen,
  closeSidebarOnMobile: () => {
    if (window.innerWidth < 1024) sidebarOpen.value = false;
  },
  previousRoute,
  showNewChatModal,
  sidebarOpen,
  sidebarResizing,
  sidebarWidth,
}));

mock.module("@/components/ui/Toast", () => ({
  ToastContainer: () => <div data-testid="toast-container" />,
  toast: {
    error: () => undefined,
  },
}));

mock.module("@/components/ui/Tooltip", () => ({
  TooltipProvider: ({ children }: { children: ComponentChildren }) => <>{children}</>,
}));

mock.module("@/components/ui/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: ComponentChildren }) => <>{children}</>,
}));

mock.module("@/components/onboarding/WelcomeWizard", () => ({
  WelcomeWizard: () => <section data-testid="welcome-wizard">welcome</section>,
}));

mock.module("@/components/tour/SpotlightTour", () => ({
  SpotlightTour: () => <section data-testid="spotlight-tour" />,
}));

mock.module("@/lib/tour-steps", () => ({
  getTourSteps: () => [],
}));

mock.module("@/components/command", () => ({
  CommandPalette: () => <div data-testid="command-palette" />,
  commandPaletteOpen,
  useCommandPaletteShortcut: () => undefined,
}));

mock.module("@/components/canvas/CanvasPanel", () => ({
  CanvasPanel: () => <section data-testid="canvas-panel" />,
}));

mockView("@/views/ChatView", "ChatView");
mockView("@/views/LoginView", "LoginView");
mockView("@/views/StatusView", "StatusView");
mockView("@/views/CronView", "CronView");
mockView("@/views/ConfigView", "ConfigView");
mockView("@/views/SettingsView", "SettingsView");
mockView("@/views/DebugView", "DebugView");
mockView("@/views/LogsView", "LogsView");
mockView("@/views/DevicesView", "DevicesView");
mockView("@/views/SkillsView", "SkillsView");
mockView("@/views/agents", "AgentsView");
mockView("@/views/WorkspaceEditorView", "WorkspaceEditorView");
mockView("@/views/UsageView", "UsageView");
mockView("@/views/ChannelsView", "ChannelsView");
mockView("@/views/InstancesView", "InstancesView");
mockView("@/views/SessionsAdminView", "SessionsAdminView");
mockView("@/views/CanvasView", "CanvasView");

describe("App route and shell gating", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    gatewayConnected.value = false;
    connectionState.value = "disconnected";
    gatewayVersion.value = "dev";
    mainSessionKey.value = "agent:main:main";
    appMode.value = "single";
    isMultiChatMode.value = false;
    canvasNodeEnabled.value = false;
    newChatSettings.value = { defaultAgentId: "main", useDefaults: true };
    currentPath.value = "/";
    previousRoute.value = "/";
    sidebarOpen.value = false;
    sidebarWidth.value = 280;
    sidebarResizing.value = false;
    canvasPanelOpen.value = false;
    commandPaletteOpen.value = false;
    showNewChatModal.value = false;
    storageState.auth = null;
    storageState.completedOnboarding = false;
    storageState.credential = null;
    storageState.pendingTour = false;
    for (const key of Object.keys(calls) as Array<keyof typeof calls>) {
      if (Array.isArray(calls[key])) {
        (calls[key] as unknown[]).length = 0;
      } else {
        (calls[key] as number) = 0;
      }
    }
  });

  test("renders onboarding inside the app shell for first-run users", async () => {
    await renderApp("onboarding");

    expect(screen.getByTestId("app-shell")).toBeTruthy();
    expect(screen.getByTestId("welcome-wizard")).toBeTruthy();
    expect(screen.queryByTestId("login-view")).toBeNull();
    expect(screen.queryByTestId("canvas-view")).toBeNull();
  });

  test("renders login inside the app shell after onboarding when disconnected", async () => {
    storageState.completedOnboarding = true;

    await renderApp("login");

    expect(screen.getByTestId("app-shell")).toBeTruthy();
    expect(screen.getByTestId("login-view")).toBeTruthy();
    expect(screen.queryByTestId("welcome-wizard")).toBeNull();
  });

  test("auto-connect uses the shared post-connect bootstrap for saved credentials", async () => {
    storageState.completedOnboarding = true;
    storageState.auth = {
      authMode: "token",
      rememberMe: true,
      url: "ws://gateway.example.test",
    };
    storageState.credential = "tok_saved";

    await renderApp("auto-connect");

    await waitFor(() =>
      expect(calls.connect).toEqual([
        {
          autoReconnect: true,
          token: "tok_saved",
          url: "ws://gateway.example.test",
        },
      ]),
    );
    expect(calls.initPostConnectApp).toBe(1);
  });

  test("bypasses app shell and auth gating on the standalone canvas route", async () => {
    window.history.replaceState(null, "", "/canvas");

    await renderApp("canvas");

    expect(screen.getByTestId("canvas-view")).toBeTruthy();
    expect(screen.queryByTestId("app-shell")).toBeNull();
    expect(screen.queryByTestId("welcome-wizard")).toBeNull();
    expect(screen.queryByTestId("login-view")).toBeNull();
    expect(screen.queryByTestId("toast-container")).toBeNull();
    expect(screen.queryByTestId("command-palette")).toBeNull();
  });

  test("uses the chat fallback route for unknown connected paths", async () => {
    window.history.replaceState(null, "", "/not-a-real-route");
    gatewayConnected.value = true;
    storageState.auth = {
      authMode: "token",
      rememberMe: true,
      url: "ws://gateway.example.test",
    };

    await renderApp("fallback");

    await waitFor(() => expect(screen.getByTestId("chat-view")).toBeTruthy());
    expect(screen.getByTestId("app-shell")).toBeTruthy();
    expect(currentPath.value).toBe("/not-a-real-route");
    expect(screen.queryByTestId("login-view")).toBeNull();
    expect(screen.queryByTestId("welcome-wizard")).toBeNull();
  });

  test("records the previous route when the app router opens settings", async () => {
    gatewayConnected.value = true;
    storageState.completedOnboarding = true;
    storageState.auth = {
      authMode: "token",
      rememberMe: true,
      url: "ws://gateway.example.test",
    };

    await renderApp("settings-route");

    await waitFor(() => expect(screen.getByTestId("chat-view")).toBeTruthy());

    route("/usage");

    await waitFor(() => expect(screen.getByTestId("usage-view")).toBeTruthy());

    route("/settings");

    await waitFor(() => expect(screen.getByTestId("settings-view")).toBeTruthy());
    expect(previousRoute.value).toBe("/usage");

    route(previousRoute.value);

    await waitFor(() => expect(screen.getByTestId("usage-view")).toBeTruthy());
  });
});

async function renderApp(cacheKey: string): Promise<void> {
  const { App } = await import(`../../../src/app.tsx?unit=${cacheKey}`);
  renderComponent(<App />);
  await flushEffects();
}

function mockView(specifier: string, exportName: string): void {
  mock.module(specifier, () => ({
    [exportName]: (props: { default?: boolean }) => {
      const testId = `${kebabCase(exportName)}${props.default ? "-default" : ""}`;
      return <section data-testid={testId}>{testId}</section>;
    },
  }));
}

function kebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function flushEffects(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
