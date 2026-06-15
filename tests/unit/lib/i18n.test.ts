import { signal } from "@preact/signals";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { resetDomState } from "../../helpers/dom";

const timeFormat = signal<"relative" | "local">("relative");
const storage = await import("../../../src/lib/storage");
const locales = await import("../../../src/locales");
mock.module("@/lib/storage", () => storage);
mock.module("@/locales", () => locales);
mock.module("@/signals/settings", () => ({ timeFormat }));
mock.module("@/lib/logger", () => ({ log: { i18n: { warn: () => undefined } } }));

const i18n = await import("../../../src/lib/i18n");

const realNow = Date.now;

beforeEach(() => {
  resetDomState();
  Date.now = () => new Date("2026-06-13T12:00:00Z").getTime();
  timeFormat.value = "relative";
});

describe("i18n utilities", () => {
  test("handles plural and interpolation edge cases", () => {
    expect(i18n.t("overview.capabilitiesCount", { count: 2 })).toBe("2 methods");
    expect(i18n.t("debug.viewEventDetails", { event: "chat.message" })).toBe(
      "View chat.message event details",
    );
    expect(i18n.t("debug.viewEventDetails")).toBe("View {{event}} event details");
    expect(i18n.t("debug.viewEventDetails", {})).toBe("View {{event}} event details");
  });

  test("formats bytes, tokens, and durations at stable thresholds", () => {
    expect(i18n.formatBytes(1023)).toBe("1023 B");
    expect(i18n.formatBytes(1024)).toBe("1.0 KB");
    expect(i18n.formatBytes(1024 * 1024 - 1)).toBe("1024.0 KB");
    expect(i18n.formatBytes(1024 * 1024)).toBe("1.0 MB");

    expect(i18n.formatTokens(999)).toBe("999");
    expect(i18n.formatTokens(1000)).toBe("1.0K");
    expect(i18n.formatTokens(9999)).toBe("10.0K");
    expect(i18n.formatTokens(10000)).toBe("10K");

    expect(i18n.formatDuration(undefined)).toBe("—");
    expect(i18n.formatDuration(999)).toBe("999ms");
    expect(i18n.formatDuration(1000)).toBe("1.0s");
    expect(i18n.formatDuration(59999)).toBe("60.0s");
    expect(i18n.formatDuration(60000)).toBe("1m 0s");
  });

  test("formats compact local timestamps for today, same year, and older years", () => {
    timeFormat.value = "local";
    const now = new Date();
    const currentYear = now.getFullYear();

    const today = new Date(currentYear, now.getMonth(), now.getDate(), 6, 0, 0);
    const sameYear = new Date(currentYear, 0, 31, 6, 0, 0);
    const olderYear = new Date(currentYear - 1, 0, 31, 6, 0, 0);

    expect(i18n.formatTimestampCompact(today)).toBe(
      new Intl.DateTimeFormat("en", { timeStyle: "short" }).format(today),
    );
    expect(i18n.formatTimestampCompact(sameYear)).toBe(
      new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(sameYear),
    );
    expect(i18n.formatTimestampCompact(olderYear)).toBe(
      new Intl.DateTimeFormat("en", { month: "short", year: "2-digit" }).format(olderYear),
    );
  });
});

afterEach(() => {
  Date.now = realNow;
});
