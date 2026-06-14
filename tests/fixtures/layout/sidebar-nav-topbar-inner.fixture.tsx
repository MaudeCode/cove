/** @jsxImportSource preact */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { computed, signal } from "@preact/signals";
import { render as rawRender } from "@testing-library/preact";
import type { ComponentChildren } from "preact";
import { fireEvent, renderComponent, screen, setViewport } from "../../helpers/dom";
import { installUiComponentAliases } from "../../helpers/module-aliases";

const routeCalls: string[] = [];
let routerUrl = "/";

const sidebarOpen = signal(false);
const previousRoute = signal("/");
const canvasPanelOpen = signal(false);
const showNewChatModal = signal(false);
const isSearchOpen = signal(false);
const canvasNodeEnabled = signal(false);
const appMode = signal<"single" | "multi">("single");
const isMultiChatMode = computed(() => appMode.value === "multi");
const activeRuns = signal(new Map());
const connectionState = signal("connected");
const isConnected = signal(true);
const gatewayVersion = signal("dev");
const mainSessionKey = signal("agent:main:main");
const activeSessionKey = signal("agent:main:main");
const newChatSettings = signal({ defaultAgentId: "main", useDefaults: true });

(globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = "test";

mock.module("preact-router", () => ({
  getCurrentUrl: () => routerUrl,
  route: (url: string) => {
    routeCalls.push(url);
    routerUrl = url;
  },
}));

mock.module("@/lib/i18n", () => ({ t: (key: string) => key }));
mock.module("@/lib/logger", () => ({ log: { ui: { error: () => undefined } } }));
mock.module("@/lib/constants", () => import("../../../src/lib/constants"));
mock.module("@/lib/navigation", () => import("../../../src/lib/navigation"));
mock.module("@/lib/gateway", () => ({
  connectionState,
  gatewayVersion,
  isConnected,
  mainSessionKey,
  send: async () => undefined,
}));
mock.module("@/signals/ui", () => ({
  canvasPanelOpen,
  closeSidebarOnMobile: () => {
    if (window.innerWidth < 1024) sidebarOpen.value = false;
  },
  previousRoute,
  showNewChatModal,
  sidebarOpen,
}));
mock.module("@/signals/settings", () => ({
  canvasNodeEnabled,
  isMultiChatMode,
  newChatSettings,
}));
mock.module("@/signals/chat", () => ({
  activeRuns,
  getStreamingRun: () => null,
  isSearchOpen,
}));
mock.module("@/signals/sessions", () => ({
  activeSessionKey,
  loadSessions: async () => undefined,
  removeSessionAnimated: async () => undefined,
  updateSession: () => undefined,
}));
mock.module("@/components/sessions/SessionRenameModal", () => ({
  SessionRenameModal: () => null,
}));
mock.module("@/components/sessions/SessionDeleteModal", () => ({
  SessionDeleteModal: () => null,
}));
mock.module("@/components/chat/NewChatModal", () => ({
  NewChatModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="new-chat-modal" /> : null,
}));
mock.module("../../../src/components/layout/SessionFilters", () => ({
  SessionFilters: () => <div data-testid="session-filters" />,
}));
mock.module("../../../src/components/layout/SessionList", () => ({
  SessionList: () => <div data-testid="session-list" />,
}));
mock.module("@/components/chat/HeartbeatIndicator", () => ({
  HeartbeatIndicator: () => <span data-testid="heartbeat-indicator" />,
}));
mock.module("@/components/usage/UsageBadge", () => ({
  UsageBadge: () => <span data-testid="usage-badge" />,
}));
mock.module("@/components/ui/CoveLogo", () => ({
  CoveLogo: () => <span data-testid="cove-logo" />,
}));
mock.module("@/components/ui/Tooltip", () => ({
  Tooltip: ({ children }: { children: ComponentChildren }) => <>{children}</>,
}));

await installUiComponentAliases();

const sidebarModule = await import("../../../src/components/layout/Sidebar");
const navModule = await import("../../../src/components/layout/NavSection");
const topBarModule = await import("../../../src/components/layout/TopBar");
const constants = await import("../../../src/lib/constants");

const { currentPath, Sidebar } = sidebarModule;
const { NavSections } = navModule;
const { TopBar } = topBarModule;
const { EXTERNAL_URLS } = constants;

describe("Sidebar navigation and TopBar", () => {
  beforeEach(() => {
    routeCalls.length = 0;
    routerUrl = "/";
    setViewport(390, 844);
    sidebarOpen.value = false;
    previousRoute.value = "/";
    canvasPanelOpen.value = false;
    showNewChatModal.value = false;
    isSearchOpen.value = false;
    canvasNodeEnabled.value = false;
    appMode.value = "single";
    activeRuns.value = new Map();
    connectionState.value = "connected";
    isConnected.value = true;
    gatewayVersion.value = "dev";
    mainSessionKey.value = "agent:main:main";
    activeSessionKey.value = "agent:main:main";
    newChatSettings.value = { defaultAgentId: "main", useDefaults: true };
    currentPath.value = "/";
  });

  test("marks the current internal nav item active and routes clicked items", () => {
    currentPath.value = "/usage";
    renderComponent(<NavSections expanded />);

    const usageButton = screen.getByRole("button", { name: "common.usage" });
    expect(usageButton.className).toContain("text-[var(--color-accent)]");

    fireEvent.click(screen.getByRole("button", { name: "common.overview" }));

    expect(currentPath.value).toBe("/overview");
    expect(routeCalls).toEqual(["/overview"]);
    expect(sidebarOpen.value).toBe(false);
  });

  test("renders resource nav items as safe external links without routing", () => {
    renderComponent(<NavSections expanded />);

    const docsLink = screen.getByRole("link", { name: "common.docs" });
    expect(docsLink.getAttribute("href")).toBe(EXTERNAL_URLS.docs);
    expect(docsLink.getAttribute("target")).toBe("_blank");
    expect(docsLink.getAttribute("rel")).toBe("noopener noreferrer");

    fireEvent.click(docsLink);

    expect(routeCalls).toEqual([]);
  });

  test("renders single-chat sidebar with chat shortcut and expanded navigation", () => {
    renderComponent(<Sidebar />);

    const chatButton = screen.getByRole("button", { name: "nav.chat" });
    expect(chatButton.className).toContain("text-[var(--color-accent)]");
    expect(screen.queryByTestId("session-filters")).toBeNull();
    expect(
      screen.getByRole("button", { name: "nav.sections.control" }).getAttribute("aria-expanded"),
    ).toBe("true");

    fireEvent.click(chatButton);

    expect(currentPath.value).toBe("/chat");
    expect(routeCalls).toEqual(["/chat"]);
  });

  test("renders multi-chat sidebar with sessions, pinned nav, and new-chat modal", async () => {
    appMode.value = "multi";
    newChatSettings.value = { defaultAgentId: "main", useDefaults: false };

    renderComponent(<Sidebar />);

    expect(screen.getByTestId("session-filters")).toBeTruthy();
    expect(screen.getByTestId("session-list")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "nav.sections.control" }).getAttribute("aria-expanded"),
    ).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "common.newChat" }));

    expect(showNewChatModal.value).toBe(true);
    expect(await screen.findByTestId("new-chat-modal")).toBeTruthy();
  });

  test("persists section state independently for multi and single modes", () => {
    const first = renderComponent(<NavSections />);
    const multiControlHeader = screen.getByRole("button", { name: "nav.sections.control" });

    expect(multiControlHeader.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(multiControlHeader);
    expect(multiControlHeader.getAttribute("aria-expanded")).toBe("true");
    expect(localStorage.getItem("cove:nav-sections-multi")).toBe(
      JSON.stringify({ "nav.sections.control": true }),
    );

    first.unmount();
    document.body.replaceChildren();
    const single = rawRender(<NavSections expanded />, {
      container: document.body.appendChild(document.createElement("div")),
    });
    const singleControlHeader = screen.getByRole("button", { name: "nav.sections.control" });

    expect(singleControlHeader.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(singleControlHeader);
    expect(singleControlHeader.getAttribute("aria-expanded")).toBe("false");
    expect(localStorage.getItem("cove:nav-sections-single")).toBe(
      JSON.stringify({ "nav.sections.control": false }),
    );
    expect(localStorage.getItem("cove:nav-sections-multi")).toBe(
      JSON.stringify({ "nav.sections.control": true }),
    );

    single.unmount();
    document.body.replaceChildren();
    rawRender(<NavSections />, {
      container: document.body.appendChild(document.createElement("div")),
    });

    expect(
      screen.getByRole("button", { name: "nav.sections.control" }).getAttribute("aria-expanded"),
    ).toBe("true");

    document.body.replaceChildren();
    rawRender(<NavSections expanded />, {
      container: document.body.appendChild(document.createElement("div")),
    });

    expect(
      screen.getByRole("button", { name: "nav.sections.control" }).getAttribute("aria-expanded"),
    ).toBe("false");
  });

  test("settings button opens settings and returns to the previous route from settings", () => {
    previousRoute.value = "/usage";
    renderComponent(<TopBar />);

    fireEvent.click(screen.getByRole("button", { name: "nav.settings" }));
    expect(routeCalls).toEqual(["/settings"]);

    fireEvent.click(screen.getByRole("button", { name: "nav.settings" }));
    expect(routeCalls).toEqual(["/settings", "/usage"]);
  });

  test("top bar toggles sidebar, canvas panel, and chat search controls", () => {
    canvasNodeEnabled.value = true;
    renderComponent(<TopBar />);

    fireEvent.click(screen.getByRole("button", { name: "accessibility.sidebarToggle" }));
    expect(sidebarOpen.value).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "common.canvas" }));
    expect(canvasPanelOpen.value).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "chat.search" }));
    expect(isSearchOpen.value).toBe(true);
  });
});
