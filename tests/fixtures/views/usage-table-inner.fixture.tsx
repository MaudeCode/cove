/** @jsxImportSource preact */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { ComponentChildren } from "preact";
import { installUiComponentAliases } from "../../helpers/module-aliases";
import { createGatewayMock, createQueryParamMock } from "../../helpers/module-mocks";
import { fireEvent, renderComponent, screen, within } from "../../helpers/dom";
import type {
  SessionUsageEntry,
  SessionsUsageResult,
  UsageTotals,
} from "../../../src/types/server-stats";

await installUiComponentAliases();

const gatewayCalls: { method: string; params: unknown }[] = [];
const storage = await import("../../../src/lib/storage");

mock.module("@/components/ui/ListCard", () => import("../../../src/components/ui/ListCard"));
mock.module("@/components/ui/Modal", () => ({
  Modal: ({
    children,
    open,
    title,
  }: {
    children: ComponentChildren;
    open: boolean;
    title?: string;
  }) =>
    open ? (
      <section aria-label={title} role="dialog">
        {children}
      </section>
    ) : null,
}));
mock.module("@/components/ui/TabNav", () => ({
  TabNav: ({
    activeId,
    items,
    onChange,
  }: {
    activeId: string;
    items: { id: string; label: string }[];
    onChange: (id: string) => void;
  }) => (
    <div role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === activeId}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  ),
}));
mock.module("@/components/ui/Badge", () => ({
  Badge: ({ children }: { children?: ComponentChildren }) => <span>{children}</span>,
}));
mock.module("@/types/server-stats", () => import("../../../src/types/server-stats"));
mock.module(
  "@/views/usage/useUsageViewState",
  () => import("../../../src/views/usage/useUsageViewState"),
);
mock.module("@/lib/i18n", () => ({
  formatTimestamp: () => "relative-time",
  t: (key: string, params?: Record<string, unknown>) =>
    key === "actions.next"
      ? "Next"
      : key === "actions.previous"
        ? "Previous"
        : key === "usage.sessions.cost"
          ? "Cost"
          : key === "usage.sessions.viewDetails"
            ? `View details for ${String(params?.name ?? "")}`
            : key === "common.sessionDetails"
              ? "Session Details"
              : key === "usage.detail.tabs.timeline"
                ? "Timeline"
                : key === "usage.detail.tabs.messages"
                  ? "Messages"
                  : key === "common.overview"
                    ? "Overview"
                    : key,
}));
mock.module("@/lib/gateway", () => ({
  ...createGatewayMock({
    isConnected: { value: true },
    send: async (method: string, params?: unknown) => {
      gatewayCalls.push({ method, params });
      if (method === "sessions.usage.timeseries") {
        const key = (params as { key?: string } | undefined)?.key ?? "unknown";
        return {
          sessionId: key,
          points: [{ timestamp: 1, cumulativeTokens: 1, cumulativeCost: 1 }],
        };
      }
      if (method === "sessions.usage.logs") {
        const key = (params as { key?: string } | undefined)?.key ?? "unknown";
        return { logs: [{ timestamp: 1, role: "user", content: key, tokens: 1 }] };
      }
      return null;
    },
  }),
}));
mock.module("@/lib/logger", () => ({
  log: {
    usage: {
      warn: () => undefined,
    },
  },
}));
mock.module("@/lib/storage", () => ({
  ...storage,
  getSessionsUsageCache: () => null,
  setSessionsUsageCache: () => undefined,
}));
mock.module("@/lib/session-utils", () => ({
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));
mock.module("@/components/ui/Toast", () => ({
  toast: {
    error: () => undefined,
  },
}));
mock.module("@/hooks/useQueryParam", () => createQueryParamMock());

const usageState = await import("../../../src/views/usage/useUsageViewState");
const { UsageSessionTable } = await import("../../../src/views/usage/UsageSessionTable");
const { UsageSessionDetailModal } =
  await import("../../../src/views/usage/UsageSessionDetailModal");

describe("UsageSessionTable", () => {
  beforeEach(() => {
    resetUsageState(
      sessionsResult([
        sessionEntry("alpha", { totalCost: 1, totalTokens: 10, updatedAt: 1 }),
        sessionEntry("bravo", { totalCost: 6, totalTokens: 60, updatedAt: 2 }),
        sessionEntry("charlie", { totalCost: 3, totalTokens: 30, updatedAt: 3 }),
        sessionEntry("delta", { totalCost: 4, totalTokens: 40, updatedAt: 4 }),
        sessionEntry("echo", { totalCost: 5, totalTokens: 50, updatedAt: 5 }),
        sessionEntry("foxtrot", { totalCost: 2, totalTokens: 20, updatedAt: 6 }),
      ]),
    );
  });

  test("sorts, paginates, clicks rows, and supports keyboard row selection", () => {
    renderComponent(<UsageSessionTable />);
    const table = document.querySelector("table");
    expect(table).not.toBeNull();

    expect(firstDesktopSession()).toContain("FOXTROT");

    fireEvent.click(screen.getAllByRole("button", { name: "Next" }).at(-1)!);
    expect(usageState.sessionsPage.value).toBe(1);
    expect(firstDesktopSession()).toContain("ALPHA");

    fireEvent.click(screen.getAllByRole("button", { name: "Previous" }).at(-1)!);
    expect(usageState.sessionsPage.value).toBe(0);
    expect(firstDesktopSession()).toContain("FOXTROT");

    fireEvent.click(within(table!).getByRole("button", { name: "Cost" }));
    expect(usageState.sessionsSortBy.value).toBe("cost");
    expect(usageState.sessionsSortDesc.value).toBe(true);
    expect(usageState.sessionsPage.value).toBe(0);
    expect(firstDesktopSession()).toContain("BRAVO");

    fireEvent.click(within(table!).getByRole("button", { name: "Cost" }));
    expect(usageState.sessionsSortDesc.value).toBe(false);
    expect(firstDesktopSession()).toContain("ALPHA");

    const alphaRow = desktopRows()[0];
    fireEvent.click(alphaRow);
    expect(alphaRow.className).toContain("bg-[var(--color-accent)]/10");

    fireEvent.keyDown(alphaRow, { key: " " });
    expect(alphaRow.className).not.toContain("bg-[var(--color-accent)]/10");
  });
});

describe("UsageSessionDetailModal", () => {
  beforeEach(() => {
    resetUsageState(sessionsResult([sessionEntry("alpha"), sessionEntry("beta")]));
  });

  test("loads detail tabs through the rendered modal effect once per tab and session", async () => {
    usageState.selectedSession.value = sessionEntry("alpha");
    const rendered = renderComponent(<UsageSessionDetailModal />);
    await flushEffects();
    expect(gatewayCalls).toEqual([]);

    fireEvent.click(screen.getByRole("tab", { name: "Timeline" }));
    await flushEffects();
    expect(gatewayCalls).toEqual([
      { method: "sessions.usage.timeseries", params: { key: "alpha" } },
    ]);

    fireEvent.click(screen.getByRole("tab", { name: "Messages" }));
    await flushEffects();
    expect(gatewayCalls).toEqual([
      { method: "sessions.usage.timeseries", params: { key: "alpha" } },
      { method: "sessions.usage.logs", params: { key: "alpha", limit: 100 } },
    ]);

    usageState.selectedSession.value = sessionEntry("beta");
    rendered.rerender(<UsageSessionDetailModal />);
    await flushEffects();
    expect(gatewayCalls).toEqual([
      { method: "sessions.usage.timeseries", params: { key: "alpha" } },
      { method: "sessions.usage.logs", params: { key: "alpha", limit: 100 } },
      { method: "sessions.usage.logs", params: { key: "beta", limit: 100 } },
    ]);

    fireEvent.click(screen.getByRole("tab", { name: "Timeline" }));
    await flushEffects();
    expect(gatewayCalls).toEqual([
      { method: "sessions.usage.timeseries", params: { key: "alpha" } },
      { method: "sessions.usage.logs", params: { key: "alpha", limit: 100 } },
      { method: "sessions.usage.logs", params: { key: "beta", limit: 100 } },
      { method: "sessions.usage.timeseries", params: { key: "beta" } },
    ]);
  });
});

function firstDesktopSession(): string {
  return desktopRows()[0]?.textContent ?? "";
}

function desktopRows(): HTMLTableRowElement[] {
  return Array.from(document.querySelectorAll("tbody tr"));
}

function resetUsageState(sessions: SessionsUsageResult): void {
  gatewayCalls.length = 0;
  usageState.selectedSession.value = null;
  usageState.detailTab.value = "overview";
  usageState.sessionTimeseries.value = null;
  usageState.sessionLogs.value = [];
  usageState.isLoadingTimeseries.value = false;
  usageState.isLoadingLogs.value = false;
  usageState.sessionsSortBy.value = "recent";
  usageState.sessionsSortDesc.value = true;
  usageState.sessionsPage.value = 0;
  usageState.sessionsUsage.value = sessions;
}

function sessionsResult(sessions: SessionUsageEntry[]): SessionsUsageResult {
  return {
    sessions,
    totals: totals(),
    startDate: "2026-06-06",
    endDate: "2026-06-13",
  };
}

function sessionEntry(
  key: string,
  usageOverrides: Partial<UsageTotals> & { updatedAt?: number } = {},
): SessionUsageEntry {
  const { updatedAt, ...usage } = usageOverrides;
  return {
    key,
    label: key.toUpperCase(),
    model: "anthropic/claude-sonnet",
    updatedAt: updatedAt ?? 1,
    usage: totals(usage),
  };
}

function flushEffects(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function totals(overrides: Partial<UsageTotals> = {}): UsageTotals {
  return {
    input: 1,
    output: 2,
    totalTokens: 3,
    cacheRead: 4,
    cacheWrite: 5,
    totalCost: 0.01,
    ...overrides,
  };
}
