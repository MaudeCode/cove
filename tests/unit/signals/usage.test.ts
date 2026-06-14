import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { installGatewayAliasMock, resetGatewayAliasMock } from "../../helpers/gateway-alias";
import { installStorageMocks } from "../../helpers/storage";
import { installFakeTimers, type FakeTimers } from "../../helpers/timers";

const gateway = installGatewayAliasMock();
const gatewayCalls: string[] = [];
const gatewayResponses: unknown[] = [];
let importCounter = 0;
let restoreStorage: (() => void) | undefined;
let timers: FakeTimers;

const storage = await import("../../../src/lib/storage");

mock.module("@/lib/storage", () => storage);
mock.module("@/lib/logger", () => ({
  log: {
    usage: {
      debug: () => undefined,
      error: () => undefined,
    },
  },
}));

beforeEach(() => {
  const state = resetGatewayAliasMock();
  restoreStorage = installStorageMocks();
  timers = installFakeTimers(1_700_000_000_000);
  state.isConnected.value = false;
  state.send = async (method: string) => {
    gatewayCalls.push(method);
    const response = gatewayResponses.shift();
    if (response instanceof Error) throw response;
    return response;
  };
  gatewayCalls.length = 0;
  gatewayResponses.length = 0;
});

afterEach(() => {
  timers.uninstall();
  restoreStorage?.();
});

describe("usage signals", () => {
  test("hydrates cached Anthropic usage and selects the weekly window", async () => {
    storage.setUsageCache({
      updatedAt: 1,
      providers: [
        {
          provider: "anthropic",
          displayName: "Anthropic",
          windows: [
            { label: "5h", usedPercent: 20 },
            { label: "Week", usedPercent: 60, resetAt: 2 },
          ],
        },
      ],
    });
    const usage = await importUsage();

    expect(usage.anthropicUsage.value?.displayName).toBe("Anthropic");
    expect(usage.hasAnthropicUsage.value).toBe(true);
    expect(usage.primaryUsageWindow.value).toEqual({ label: "Week", usedPercent: 60, resetAt: 2 });
  });

  test("falls back to the first Anthropic window and hides errored usage", async () => {
    storage.setUsageCache({
      updatedAt: 1,
      providers: [
        {
          provider: "anthropic",
          displayName: "Anthropic",
          windows: [{ label: "5h", usedPercent: 20 }],
          error: "rate limited",
        },
      ],
    });
    const usage = await importUsage();

    expect(usage.primaryUsageWindow.value).toEqual({ label: "5h", usedPercent: 20 });
    expect(usage.hasAnthropicUsage.value).toBe(false);
  });

  test("polls usage only while connected and persists fresh snapshots", async () => {
    gateway.isConnected.value = true;
    gatewayResponses.push(
      { updatedAt: 2, providers: [] },
      { updatedAt: 3, providers: [] },
      { updatedAt: 4, providers: [] },
    );
    const usage = await importUsage();

    usage.startUsagePolling();
    await flushPromises();

    expect(gatewayCalls).toEqual(["usage.status"]);
    expect(storage.getUsageCache()?.updatedAt).toBe(2);

    timers.advanceBy(5 * 60 * 1000);
    await flushPromises();

    expect(gatewayCalls).toEqual(["usage.status", "usage.status"]);
    expect(storage.getUsageCache()?.updatedAt).toBe(3);

    gateway.isConnected.value = false;
    timers.advanceBy(5 * 60 * 1000);
    await flushPromises();

    expect(gatewayCalls).toEqual(["usage.status", "usage.status"]);
  });

  test("restarting polling clears the previous interval", async () => {
    gateway.isConnected.value = true;
    gatewayResponses.push(
      { updatedAt: 1, providers: [] },
      { updatedAt: 2, providers: [] },
      { updatedAt: 3, providers: [] },
    );
    const usage = await importUsage();

    usage.startUsagePolling();
    await flushPromises();
    usage.startUsagePolling();
    await flushPromises();
    timers.advanceBy(5 * 60 * 1000);
    await flushPromises();

    expect(gatewayCalls).toEqual(["usage.status", "usage.status", "usage.status"]);
    expect(storage.getUsageCache()?.updatedAt).toBe(3);
  });

  test("does not fetch while disconnected", async () => {
    const usage = await importUsage();

    usage.startUsagePolling();
    await flushPromises();

    expect(gatewayCalls).toEqual([]);
  });
});

async function importUsage() {
  // @ts-ignore Query suffix gives each test fresh module state.
  return import(`../../../src/signals/usage.ts?unit=${importCounter++}`);
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
