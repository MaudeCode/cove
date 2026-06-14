/** @jsxImportSource preact */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { fireEvent, renderComponent, screen, waitFor } from "../../helpers/dom";
import { installI18nMock } from "../../helpers/i18n";
import {
  createGatewayTestHarness,
  createQueryParamMock,
  createSessionSignalsMock,
} from "../../helpers/module-mocks";
import { installUiMocks } from "../../helpers/ui-mocks";
import type { DevicePendingRequest, PairedDevice } from "../../../src/types/devices";
import type { ChannelsStatusResponse } from "../../../src/types/channels";
import type { SystemPresence } from "../../../src/types/presence";

const gatewayHarness = createGatewayTestHarness();
const sendCalls = gatewayHarness.calls;
const sessions = signal<unknown[]>([]);
const toastMessages: Array<[string, string]> = [];
const routeCalls: string[] = [];
const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
let importCounter = 0;

mock.module("@/lib/gateway", () => ({
  ...gatewayHarness.module({
    disconnect: () => {
      gatewayHarness.connectionState.value = "disconnected";
    },
  }),
}));
mock.module("@/signals/sessions", () => createSessionSignalsMock({ sessions }));
installI18nMock({
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
});
mock.module("@/lib/session-utils", () => ({
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));
mock.module("@/lib/utils", () => ({
  formatJson: (value: unknown) => JSON.stringify(value, null, 2),
  formatUptime: (ms: number) => `${ms}ms`,
  isAvatarUrl: (value?: string) => !!value?.startsWith("http"),
}));
mock.module("@/hooks/useQueryParam", () => createQueryParamMock());
installUiMocks({
  "@/components/ui/ChannelIcon": () => ({
    ChannelIcon: ({ channelId }: { channelId: string }) => <span>{channelId}</span>,
  }),
  "@/components/ui/ModalFooter": () => ({
    ModalFooter: ({
      cancelLabel = "actions.cancel",
      confirmDisabled,
      confirmLabel = "actions.confirm",
      onCancel,
      onConfirm,
    }: {
      cancelLabel?: string;
      confirmDisabled?: boolean;
      confirmLabel?: string;
      onCancel: () => void;
      onConfirm: () => void;
    }) => (
      <div>
        <button onClick={onCancel} type="button">
          {cancelLabel}
        </button>
        <button disabled={confirmDisabled} onClick={onConfirm} type="button">
          {confirmLabel}
        </button>
      </div>
    ),
    DeleteConfirmFooter: ({
      isDeleting,
      message,
      onCancel,
      onDelete,
    }: {
      isDeleting?: boolean;
      message: string;
      onCancel: () => void;
      onDelete: () => void;
    }) => (
      <div>
        <p>{message}</p>
        <button onClick={onCancel} type="button">
          actions.cancel
        </button>
        <button disabled={isDeleting} onClick={onDelete} type="button">
          actions.delete
        </button>
      </div>
    ),
  }),
  "@/components/ui/HintBox": () => ({
    HintBox: ({ children }: { children?: ComponentChildren }) => <div role="alert">{children}</div>,
  }),
  "@/components/ui/ListCard": () => ({
    ListCard: ({
      badges,
      meta,
      onClick,
      subtitle,
      title,
    }: {
      badges?: ComponentChildren;
      meta?: Array<{ value: string }>;
      onClick?: () => void;
      subtitle?: string;
      title: string;
    }) => {
      const content = (
        <>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
          {badges}
          {meta?.map((item) => (
            <span key={item.value}>{item.value}</span>
          ))}
        </>
      );

      return onClick ? (
        <button onClick={onClick} type="button">
          {content}
        </button>
      ) : (
        <article>{content}</article>
      );
    },
  }),
  "@/components/ui/StatCard": () => ({
    StatCard: ({
      label,
      onClick,
      subtext,
      value,
    }: {
      label: string;
      onClick?: () => void;
      subtext?: string;
      value: number | string;
    }) =>
      onClick ? (
        <button onClick={onClick} type="button">
          {label}:{value}
          {subtext}
        </button>
      ) : (
        <div>
          {label}:{value}
          {subtext}
        </div>
      ),
  }),
  "@/components/ui/Toast": () => ({
    toast: {
      error: (message: string) => toastMessages.push(["error", message]),
      success: (message: string) => toastMessages.push(["success", message]),
    },
  }),
});
mock.module("@/components/devices", () => import("../../../src/components/devices"));
mock.module("preact-router", () => ({
  route: (path: string) => routeCalls.push(path),
}));
mock.module("@/types/channels", () => import("../../../src/types/channels"));
mock.module("@/types/devices", () => import("../../../src/types/devices"));
mock.module("@/types/workspace", () => import("../../../src/types/workspace"));

describe("operational views", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    gatewayHarness.reset();
    toastMessages.length = 0;
    routeCalls.length = 0;
    gatewayHarness.gatewayUrl.value = "ws://gateway.local";
    gatewayHarness.reconnectAttempt.value = 2;
    sessions.value = [];
    installClipboard();
  });

  afterEach(() => {
    if (originalClipboardDescriptor) {
      Object.defineProperty(navigator, "clipboard", originalClipboardDescriptor);
    } else {
      delete (navigator as { clipboard?: Clipboard }).clipboard;
    }
  });

  test("DevicesView loads, filters, approves requests, and handles token copy fallback", async () => {
    gatewayHarness.queueResponse("device.pair.list", devicesResponse(), devicesResponse());
    gatewayHarness.queueResponse("device.pair.approve", {});
    gatewayHarness.queueResponse("device.token.rotate", { token: "rotated-secret" });
    installClipboard({ rejectWrites: true });
    const { DevicesView } = await importView("DevicesView");

    renderComponent(<DevicesView />);
    await waitFor(() => expect(screen.getAllByText("Laptop").length).toBeGreaterThan(0));

    expect(sendCalls[0]).toEqual({ method: "device.pair.list", params: {} });
    expect(screen.getByText("common.total:2")).toBeTruthy();
    expect(screen.getByText("common.operators:1")).toBeTruthy();
    expect(screen.getByText("common.nodes:1")).toBeTruthy();
    expect(screen.getByText("common.pending:1")).toBeTruthy();

    fireEvent.input(screen.getByPlaceholderText("devices.searchPlaceholder"), {
      target: { value: "node" },
    });
    expect(screen.getByText('devices.filteredCount:{"filtered":1,"total":2}')).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "devices.approve" }));
    await waitFor(() =>
      expect(sendCalls.some((call) => call.method === "device.pair.approve")).toBe(true),
    );
    expect(sendCalls).toContainEqual({
      method: "device.pair.approve",
      params: { requestId: "req_1" },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: 'devices.toggleDetails:{"name":"Node Host"}',
      }),
    );
    await waitFor(() => expect(screen.getByText("device-node")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "devices.rotateToken" }));
    fireEvent.click(screen.getByRole("button", { name: "devices.rotate" }));
    await waitFor(() => expect(screen.getByDisplayValue("rotated-secret")).toBeTruthy());
    expect(sendCalls).toContainEqual({
      method: "device.token.rotate",
      params: { deviceId: "device-node", role: "node" },
    });
    expect(toastMessages).toContainEqual(["error", 'status.copyFailed:{"label":"common.token"}']);
  });

  test("ChannelsView probes status, computes stats, routes config, and logs out an account", async () => {
    gatewayHarness.queueResponse(
      "channels.status",
      channelsResponse(),
      channelsResponse(),
      channelsResponse(),
    );
    gatewayHarness.queueResponse("common.logout", {});
    const { ChannelsView } = await importView("ChannelsView");

    renderComponent(<ChannelsView />);
    await waitFor(() => expect(screen.getByText("Slack")).toBeTruthy());

    expect(sendCalls[0]).toEqual({
      method: "channels.status",
      params: { probe: false, timeoutMs: 10000 },
    });
    expect(screen.getByText("common.total:2")).toBeTruthy();
    expect(screen.getByText("channels.stats.active:1")).toBeTruthy();
    expect(screen.getByText("channels.stats.errors:1")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "channels.configure" })[0]);
    expect(routeCalls).toEqual(["/config#channels.slack"]);

    fireEvent.click(screen.getAllByRole("button", { name: "common.logout" })[0]);
    expect(screen.getByRole("dialog", { name: "channels.logoutTitle" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "common.logout" }).at(-1)!);

    await waitFor(() =>
      expect(sendCalls.some((call) => call.method === "common.logout")).toBe(true),
    );
    expect(sendCalls).toContainEqual({
      method: "common.logout",
      params: { accountId: "slack-main", channel: "slack" },
    });

    fireEvent.click(screen.getByRole("button", { name: "channels.probe" }));
    await waitFor(() =>
      expect(
        sendCalls.some(
          (call) =>
            call.method === "channels.status" &&
            JSON.stringify(call.params) === JSON.stringify({ probe: true, timeoutMs: 15000 }),
        ),
      ).toBe(true),
    );
    expect(screen.getByText("channels.stats.active:1")).toBeTruthy();
  });

  test("StatusView isolates partial dashboard failures and reports secure-context warnings", async () => {
    gatewayHarness.queueResponse("cron.status", {
      enabled: true,
      jobs: 3,
      nextWakeAtMs: Date.now() + 90_000,
    });
    gatewayHarness.queueResponse("channels.status", new Error("channels down"));
    gatewayHarness.queueResponse("skills.status", {
      skills: [{ eligible: true }, { eligible: false }],
    });
    gatewayHarness.presence.value = [{ id: "web" }];
    sessions.value = [{ key: "one" }, { key: "two" }];
    const { StatusView } = await importView("StatusView");

    renderComponent(<StatusView />);
    await waitFor(() => expect(sendCalls.map((call) => call.method)).toContain("skills.status"));

    expect(sendCalls.map((call) => call.method)).toEqual([
      "cron.status",
      "channels.status",
      "skills.status",
    ]);
    expect(screen.getByText("Cron:EnabledNext wake: 1m")).toBeTruthy();
    expect(screen.getByText("Channels:—No channels configured")).toBeTruthy();
    expect(
      screen.getByText(
        (_content: string, element: Element | null) =>
          element?.textContent === "Skills:11/2 active",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Instances:1Connected clients")).toBeTruthy();
    expect(screen.getByText("Sessions:2Active sessions")).toBeTruthy();
    expect(screen.getByText("Insecure WebSocket")).toBeTruthy();
  });

  test("InstancesView loads presence, computes gateway/client stats, and formats idle thresholds", async () => {
    gatewayHarness.queueResponse("system-presence", [
      presenceFixture({ host: "gateway", mode: "gateway", lastInputSeconds: 30 }),
      presenceFixture({ host: "web", mode: "webchat", lastInputSeconds: 120 }),
      presenceFixture({ host: "mobile", mode: "mobile", lastInputSeconds: 7200 }),
    ]);
    const { InstancesView } = await importView("InstancesView");

    renderComponent(<InstancesView />);
    await waitFor(() => expect(screen.getAllByText("gateway").length).toBeGreaterThan(0));

    expect(sendCalls[0]).toEqual({ method: "system-presence", params: {} });
    expect(screen.getByText("common.total:3")).toBeTruthy();
    expect(screen.getByText("instances.stats.gateways:1")).toBeTruthy();
    expect(screen.getByText("instances.stats.clients:2")).toBeTruthy();
    expect(screen.getByText('instances.idleSeconds:{"count":30}')).toBeTruthy();
    expect(screen.getByText('instances.idleMinutes:{"count":2}')).toBeTruthy();
    expect(screen.getByText('instances.idleHours:{"count":2}')).toBeTruthy();
  });
});

async function importView(name: "ChannelsView" | "DevicesView" | "InstancesView" | "StatusView") {
  // @ts-ignore Query suffix gives each test fresh module state.
  return import(`../../../src/views/${name}.tsx?unit=${importCounter++}`);
}

function devicesResponse() {
  return {
    paired: [
      deviceFixture({
        deviceId: "device-operator",
        displayName: "Laptop",
        platform: "web",
        role: "operator",
      }),
      deviceFixture({
        deviceId: "device-node",
        displayName: "Node Host",
        platform: "linux",
        role: "node",
        tokens: [{ createdAtMs: 1, role: "node", scopes: ["node"] }],
      }),
    ],
    pending: [
      {
        deviceId: "pending-device",
        displayName: "Phone",
        publicKey: "pub",
        remoteIp: "127.0.0.1",
        requestId: "req_1",
        role: "operator",
        ts: 1,
      } satisfies DevicePendingRequest,
    ],
  };
}

function deviceFixture(overrides: Partial<PairedDevice> = {}): PairedDevice {
  return {
    approvedAtMs: 2,
    createdAtMs: 1,
    deviceId: "device",
    publicKey: "pub",
    ...overrides,
  };
}

function channelsResponse(): ChannelsStatusResponse {
  return {
    ts: 1,
    channelOrder: ["slack", "discord"],
    channelLabels: { discord: "Discord", slack: "Slack" },
    channelDetailLabels: {},
    channelSystemImages: {},
    channelMeta: [],
    channels: {},
    channelAccounts: {
      discord: [{ accountId: "discord-main", lastError: "token expired" }],
      slack: [
        {
          accountId: "slack-main",
          connected: true,
          lastInboundAt: Date.now(),
          name: "Ops",
        },
      ],
    },
    channelDefaultAccountId: {},
  };
}

function presenceFixture(overrides: Partial<SystemPresence> = {}): SystemPresence {
  return {
    instanceId: "instance",
    text: "instance",
    ts: 1,
    ...overrides,
  };
}

function installClipboard(options: { rejectWrites?: boolean } = {}) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: mock(async () => {
        if (options.rejectWrites) throw new Error("copy failed");
      }),
    },
  });
}
