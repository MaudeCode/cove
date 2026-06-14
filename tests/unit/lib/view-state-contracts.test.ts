import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import { resetDomState } from "../../helpers/dom";

const fontCalls = {
  code: [] as string[],
  ui: [] as string[],
};
const nodeCalls = {
  start: 0,
  stop: 0,
};
const routeCalls: string[] = [];
const nodePairingStatus = signal<"unpaired" | "pending" | "paired">("unpaired");
const nodeConnected = signal(false);
const aliasAppMode = signal<"single" | "multi">("single");
const aliasCanvasNodeEnabled = signal(false);
const aliasTimeFormat = signal<"relative" | "local">("relative");

const themeTypes = await import("../../../src/types/theme");
mock.module("@/types/theme", () => themeTypes);
const themes = await import("../../../src/lib/themes");
mock.module("@/lib/themes", () => themes);
const storage = await import("../../../src/lib/storage");
mock.module("@/lib/storage", () => storage);
const locales = await import("../../../src/locales");
mock.module("@/locales", () => locales);
mock.module("@/signals/settings", () => ({
  appMode: aliasAppMode,
  canvasNodeEnabled: aliasCanvasNodeEnabled,
  timeFormat: aliasTimeFormat,
}));
const i18n = await import("../../../src/lib/i18n");
mock.module("@/lib/i18n", () => i18n);

mock.module("@/lib/font-loader", () => ({
  loadCodeFontFamily: (font: string) => {
    fontCalls.code.push(font);
  },
  loadUiFontFamily: (font: string) => {
    fontCalls.ui.push(font);
  },
}));

mock.module("@/lib/node-connection", () => ({
  canvasBlobUrl: signal<string | null>(null),
  canvasContent: signal<string | null>(null),
  canvasContentType: signal<string | null>(null),
  canvasUrl: signal<string | null>(null),
  canvasVisible: signal(false),
  nodeConnected,
  nodePairingStatus,
  pendingCanvasEval: signal(null),
  pendingCanvasSnapshot: signal(null),
  standaloneCanvasOpen: signal(false),
  startNodeConnection: () => {
    nodeCalls.start++;
  },
  stopNodeConnection: () => {
    nodeCalls.stop++;
  },
}));

mock.module("preact-router", () => ({
  route: (path: string) => {
    routeCalls.push(path);
  },
}));

beforeEach(() => {
  resetDomState();
  fontCalls.code.length = 0;
  fontCalls.ui.length = 0;
  nodeCalls.start = 0;
  nodeCalls.stop = 0;
  routeCalls.length = 0;
  nodePairingStatus.value = "unpaired";
  nodeConnected.value = false;
  aliasAppMode.value = "single";
  aliasCanvasNodeEnabled.value = false;
  aliasTimeFormat.value = "relative";
  document.head.innerHTML = '<meta name="theme-color" content="#ffffff">';
});

afterEach(() => {
  resetDomState();
});

describe("view-state system contracts", () => {
  test("theme system resolves system preference, applies DOM state, and persists cache", async () => {
    let prefersDark = true;
    let changeHandler: ((event: Event) => void) | undefined;
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) =>
      ({
        matches: prefersDark,
        media: query,
        onchange: null,
        addEventListener: (event: string, handler: EventListenerOrEventListenerObject) => {
          if (event === "change" && typeof handler === "function") {
            changeHandler = handler as (event: Event) => void;
          }
        },
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => true,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;

    localStorage.setItem(
      "cove:theme-preference",
      JSON.stringify({ selected: "system", lightTheme: "light", darkTheme: "dracula" }),
    );
    const theme = await import("../../../src/lib/theme");

    theme.initTheme();
    await flushSignals();

    expect(document.documentElement.getAttribute("data-appearance")).toBe("dark");
    expect(document.documentElement.style.getPropertyValue("--color-bg-primary")).toBeTruthy();
    expect(
      document.querySelector('meta[name="theme-color"]')?.getAttribute("content"),
    ).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("cove:theme-cache") ?? "{}").id).toBe("dracula");

    prefersDark = false;
    changeHandler?.(new Event("change"));
    await flushSignals();

    expect(document.documentElement.getAttribute("data-appearance")).toBe("light");
    expect(JSON.parse(localStorage.getItem("cove:theme-preference") ?? "{}").selected).toBe(
      "system",
    );
    window.matchMedia = originalMatchMedia;
  });

  test("settings persist preferences, apply fonts, and react to canvas storage events", async () => {
    localStorage.setItem("cove:font-size", JSON.stringify("lg"));
    const settings = await import("../../../src/signals/settings");
    await flushSignals();

    expect(document.documentElement.dataset.fontSize).toBe("lg");
    settings.fontSize.value = "sm";
    settings.fontFamily.value = "mono";
    settings.codeFontFamily.value = "system";
    await flushSignals();

    expect(JSON.parse(localStorage.getItem("cove:font-size") ?? "null")).toBe("sm");
    expect(document.documentElement.style.getPropertyValue("--font-family-override")).toContain(
      "JetBrains Mono",
    );
    expect(document.documentElement.style.getPropertyValue("--font-mono")).toContain(
      "ui-monospace",
    );
    expect(fontCalls.ui).toContain("mono");
    expect(fontCalls.code).toContain("system");

    dispatchStorageEvent("cove:canvas-node-enabled", "true");
    expect(settings.canvasNodeEnabled.value).toBe(true);
    expect(nodeCalls.start).toBe(1);

    dispatchStorageEvent("cove:canvas-node-enabled", "false");
    expect(settings.canvasNodeEnabled.value).toBe(false);
    expect(nodeCalls.stop).toBe(1);

    expect(settings.chatSteeringSettings.value.steerByDefault).toBe(false);
    expect(settings.chatSteeringSettings.value.steeringMode).toBe("soft");
    settings.chatSteeringSettings.value = { steerByDefault: true, steeringMode: "hard" };
    await flushSignals();
    expect(JSON.parse(localStorage.getItem("cove:chat-steering-settings") ?? "null")).toEqual({
      steerByDefault: true,
      steeringMode: "hard",
    });

    settings.resetToDefaults();
    expect(String(settings.fontSize.value)).toBe("md");
    expect(settings.appMode.value).toBe("single");
    expect(settings.chatSteeringSettings.value.steerByDefault).toBe(false);
    expect(settings.chatSteeringSettings.value.steeringMode).toBe("soft");
  });

  test("settings apply every font option and ignore unchanged canvas storage events", async () => {
    const settings = await import("../../../src/signals/settings");

    for (const option of settings.FONT_FAMILY_OPTIONS) {
      settings.fontFamily.value = option.value;
      await flushSignals();

      expect(fontCalls.ui).toContain(option.value);
      expect(document.documentElement.style.getPropertyValue("--font-family-override")).toBe(
        settings.UI_FONT_FAMILIES[option.value],
      );
    }

    for (const option of settings.CODE_FONT_FAMILY_OPTIONS) {
      settings.codeFontFamily.value = option.value;
      await flushSignals();

      expect(fontCalls.code).toContain(option.value);
      expect(document.documentElement.style.getPropertyValue("--font-mono")).toBe(
        settings.CODE_FONT_FAMILIES[option.value],
      );
    }

    nodeCalls.start = 0;
    nodeCalls.stop = 0;
    settings.canvasNodeEnabled.value = false;

    dispatchStorageEvent("cove:font-size", JSON.stringify("lg"));
    dispatchStorageEvent("cove:canvas-node-enabled", "false");
    dispatchStorageEvent("cove:canvas-node-enabled", null);

    expect(settings.canvasNodeEnabled.value).toBe(false);
    expect(nodeCalls.start).toBe(0);
    expect(nodeCalls.stop).toBe(0);
  });

  test("settings cross-tab canvas sync only starts or stops when the value changes", async () => {
    const settings = await import("../../../src/signals/settings");
    nodeCalls.start = 0;
    nodeCalls.stop = 0;
    settings.canvasNodeEnabled.value = false;

    dispatchStorageEvent("cove:canvas-node-enabled", "true");
    dispatchStorageEvent("cove:canvas-node-enabled", "true");
    dispatchStorageEvent("cove:canvas-node-enabled", "not-json");

    expect(settings.canvasNodeEnabled.value).toBe(true);
    expect(nodeCalls.start).toBe(1);
    expect(nodeCalls.stop).toBe(0);

    dispatchStorageEvent("cove:canvas-node-enabled", "false");

    expect(settings.canvasNodeEnabled.value).toBe(false);
    expect(nodeCalls.stop).toBe(1);
  });

  test("i18n translates, interpolates, pluralizes, and formats values", async () => {
    const i18n = await import("../../../src/lib/i18n");
    const realNow = Date.now;
    Date.now = () => new Date("2026-06-13T12:00:00Z").getTime();

    expect(i18n.t("actions.send")).toBe("Send");
    expect(i18n.t("chat.thinkingBlock.second", { count: 2 })).toBe("2 seconds");
    expect(i18n.t("connection.reconnectingAttempt", { count: 4 })).toContain("4");
    expect(i18n.t("missing.key")).toBe("missing.key");
    expect(i18n.formatTimestamp(new Date("2026-06-13T11:59:00Z"), { relative: true })).toContain(
      "minute",
    );
    expect(i18n.formatTimestampCompact(new Date("2026-06-13T06:00:00Z"))).toBe("6h");
    expect(i18n.formatBytes(1048576)).toBe("1.0 MB");
    expect(i18n.formatTokens(1500)).toBe("1.5K");
    expect(i18n.formatDuration(65000)).toBe("1m 5s");

    Date.now = realNow;
  });

  test("tour steps vary by app mode and canvas pairing state", async () => {
    const { getTourSteps } = await import("../../../src/lib/tour-steps");

    aliasCanvasNodeEnabled.value = false;
    expect(getTourSteps("single").map((step) => step.target)).toEqual([
      "[data-tour='chat-input']",
      "[data-tour='model-picker']",
      "[data-tour='settings']",
    ]);
    expect(getTourSteps("multi")[0]?.target).toBe("[data-tour='sessions']");

    aliasCanvasNodeEnabled.value = true;
    nodePairingStatus.value = "unpaired";
    nodeConnected.value = false;
    expect(
      getTourSteps("single")
        .map((step) => step.target)
        .slice(-2),
    ).toEqual(["[data-tour='pending-requests']", "[data-tour='canvas']"]);

    nodePairingStatus.value = "paired";
    nodeConnected.value = true;
    expect(
      getTourSteps("single")
        .map((step) => step.target)
        .slice(-1),
    ).toEqual(["[data-tour='canvas']"]);
  });
});

function dispatchStorageEvent(key: string, newValue: string | null): void {
  const event = new Event("storage");
  Object.defineProperty(event, "key", { value: key });
  Object.defineProperty(event, "newValue", { value: newValue });
  window.dispatchEvent(event);
}

async function flushSignals(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
