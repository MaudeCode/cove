/** @jsxImportSource preact */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, renderComponent, screen, waitFor } from "../../helpers/dom";
import { installI18nMock } from "../../helpers/i18n";
import { createGatewayTestHarness, createQueryParamMock } from "../../helpers/module-mocks";
import { installUiMocks } from "../../helpers/ui-mocks";

type GatewayEvent = {
  event: string;
  payload: unknown;
};

const gatewayHarness = createGatewayTestHarness();
const gatewaySubscribers = gatewayHarness.subscribers as Array<(event: GatewayEvent) => void>;
const originalAppVersionDescriptor = Object.getOwnPropertyDescriptor(globalThis, "__APP_VERSION__");
let importCounter = 0;

mock.module("@/lib/gateway", () => ({
  ...gatewayHarness.module(),
}));
mock.module("@/hooks/useQueryParam", () => createQueryParamMock());
installI18nMock({
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
});
mock.module("@/lib/utils", () => ({
  formatJson: (value: unknown) => JSON.stringify(value, null, 2),
  formatUptime: (ms: number) => `${ms}ms`,
  isAvatarUrl: (value?: string) => !!value?.startsWith("http"),
}));
mock.module("@/components/debug/JsonBlock", () => ({
  JsonBlock: ({ value }: { value: string }) => <pre>{value}</pre>,
}));
mock.module("@/components/debug/ManualRpcPanel", () => ({
  ManualRpcPanel: () => <section>manual rpc</section>,
}));
mock.module("@/components/debug/SnapshotsPanel", () => ({
  SnapshotsPanel: () => <section>snapshots</section>,
}));
installUiMocks();

beforeEach(() => {
  document.body.replaceChildren();
  (globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = "test";
  gatewayHarness.reset();
  gatewayHarness.presence.value = [{ id: "web" }];
  gatewayHarness.reconnectAttempt.value = 1;
});

afterEach(() => {
  if (originalAppVersionDescriptor) {
    Object.defineProperty(globalThis, "__APP_VERSION__", originalAppVersionDescriptor);
  } else {
    delete (globalThis as { __APP_VERSION__?: string }).__APP_VERSION__;
  }
});

describe("DebugView event log", () => {
  test("subscribes to gateway events, keeps newest 100, and clears the log", async () => {
    const { DebugView } = await importDebugView();

    renderComponent(<DebugView />);
    expect(screen.getByText("debug.noEvents")).toBeTruthy();
    expect(screen.getByRole("button", { name: "common.clear" })).toHaveProperty("disabled", true);
    expect(gatewaySubscribers).toHaveLength(1);

    for (let index = 1; index <= 101; index++) {
      emitEvent(`event-${index}`, { index });
    }

    await waitFor(() => expect(screen.getAllByText("event-101").length).toBeGreaterThan(0));
    expect(screen.getAllByText("event-2").length).toBeGreaterThan(0);
    expect(screen.queryByText("event-1")).toBeNull();
    expect(screen.getByText("100")).toBeTruthy();

    const newest = screen.getAllByRole("button", { name: /event-101 event/ })[0];
    fireEvent.click(newest);
    expect(screen.getAllByText(/"index": 101/).length).toBeGreaterThan(0);

    const clear = screen.getByRole("button", { name: "common.clear" });
    expect(clear).toHaveProperty("disabled", false);
    fireEvent.click(clear);

    expect(screen.getByText("debug.noEvents")).toBeTruthy();
  });

  test("pause toggle blocks new events and resumes recording", async () => {
    const { DebugView } = await importDebugView();

    renderComponent(<DebugView />);
    const toggle = screen.getByRole("switch");
    expect(toggle.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    emitEvent("paused.event", { ok: true });
    expect(screen.queryByText("paused.event")).toBeNull();

    fireEvent.click(toggle);
    emitEvent("resumed.event", { ok: true });

    await waitFor(() => expect(screen.getAllByText("resumed.event").length).toBeGreaterThan(0));
    expect(screen.queryByText("paused.event")).toBeNull();
  });
});

function emitEvent(event: string, payload: unknown) {
  for (const handler of gatewaySubscribers) {
    handler({ event, payload });
  }
}

async function importDebugView(): Promise<typeof import("../../../src/views/DebugView")> {
  // @ts-ignore Query suffix gives each test fresh module state.
  return import(`../../../src/views/DebugView.tsx?unit=${importCounter++}`);
}
