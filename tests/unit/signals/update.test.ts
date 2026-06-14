import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { installGatewayAliasMock, resetGatewayAliasMock } from "../../helpers/gateway-alias";
import { installStorageMocks } from "../../helpers/storage";

const gateway = installGatewayAliasMock();
let importCounter = 0;
let restoreStorage: (() => void) | undefined;

beforeEach(() => {
  restoreStorage?.();
  restoreStorage = installStorageMocks();
  resetGatewayAliasMock();
});

afterEach(() => {
  restoreStorage?.();
  restoreStorage = undefined;
});

describe("update signals", () => {
  test("initializes the update subscription only once and accepts available/null payloads", async () => {
    const update = await importUpdate();

    update.initUpdateSubscription();
    update.initUpdateSubscription();

    expect(gateway.subscriptions).toHaveLength(1);

    gateway.subscriptions[0]({
      event: "update.available",
      payload: {
        updateAvailable: {
          currentVersion: "2026.3.1",
          latestVersion: "2026.3.2",
          channel: "stable",
        },
      },
    });

    expect(update.updateAvailable.value).toEqual({
      currentVersion: "2026.3.1",
      latestVersion: "2026.3.2",
      channel: "stable",
    });
    expect(update.isUpdateDismissed()).toBe(false);

    gateway.subscriptions[0]({
      event: "other.event",
      payload: {
        updateAvailable: {
          currentVersion: "ignored",
          latestVersion: "ignored",
          channel: "stable",
        },
      },
    });

    expect(update.updateAvailable.value).toEqual({
      currentVersion: "2026.3.1",
      latestVersion: "2026.3.2",
      channel: "stable",
    });

    gateway.subscriptions[0]({ event: "update.available", payload: { updateAvailable: null } });

    expect(update.updateAvailable.value).toBeNull();
    expect(update.isUpdateDismissed()).toBe(false);
  });

  test("normalizes malformed update payloads to no update", async () => {
    const update = await importUpdate();

    update.initUpdateSubscription();
    gateway.subscriptions[0]({
      event: "update.available",
      payload: {
        updateAvailable: {
          currentVersion: "2026.3.1",
          latestVersion: "2026.3.2",
          channel: "stable",
        },
      },
    });

    expect(update.updateAvailable.value?.latestVersion).toBe("2026.3.2");

    gateway.subscriptions[0]({ event: "update.available", payload: {} });
    expect(update.updateAvailable.value).toBeNull();

    gateway.subscriptions[0]({
      event: "update.available",
      payload: { updateAvailable: { latestVersion: "2026.3.3" } },
    });
    expect(update.updateAvailable.value).toBeNull();
  });

  test("persists dismissed update versions and reloads dismissal state", async () => {
    let update = await importUpdate();
    update.updateAvailable.value = {
      currentVersion: "2026.3.1",
      latestVersion: "2026.3.2",
      channel: "stable",
    };

    update.dismissUpdate();

    expect(update.isUpdateDismissed()).toBe(true);
    expect(localStorage.getItem("cove:dismissed-update-version")).toBe("2026.3.2");

    update = await importUpdate();
    update.updateAvailable.value = {
      currentVersion: "2026.3.1",
      latestVersion: "2026.3.2",
      channel: "stable",
    };

    expect(update.isUpdateDismissed()).toBe(true);

    update.updateAvailable.value = {
      currentVersion: "2026.3.2",
      latestVersion: "2026.3.3",
      channel: "stable",
    };

    expect(update.isUpdateDismissed()).toBe(false);
  });
});

async function importUpdate() {
  // @ts-ignore Query suffix gives each test fresh module state.
  return import(`../../../src/signals/update.ts?unit=${importCounter++}`);
}
