import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { resetDomState } from "../../helpers/dom";

const themeTypes = await import("../../../src/types/theme");
mock.module("@/types/theme", () => themeTypes);
const themes = await import("../../../src/lib/themes");
mock.module("@/lib/themes", () => themes);
const storage = await import("../../../src/lib/storage");
mock.module("@/lib/storage", () => storage);

const lightTheme = themes.getTheme("light")!;
const draculaTheme = themes.getTheme("dracula")!;

const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  resetDomState();
  document.head.innerHTML = '<meta name="theme-color" content="#ffffff">';
  localStorage.setItem(
    "cove:theme-preference",
    JSON.stringify({ selected: "system", lightTheme: "light", darkTheme: "dracula" }),
  );
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  resetDomState();
});

describe("theme utilities", () => {
  test("falls back to the light system theme when matchMedia is unavailable", async () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: undefined,
    });
    const theme = await import("../../../src/lib/theme");
    theme.setTheme("system");
    theme.setLightTheme("light");
    theme.setDarkTheme("dracula");

    expect(() => theme.initTheme()).not.toThrow();
    await flushSignals();

    expect(document.documentElement.getAttribute("data-appearance")).toBe("light");
    expect(document.documentElement.style.getPropertyValue("--color-bg-primary")).toBe(
      lightTheme.colors["--color-bg-primary"],
    );
    expect(JSON.parse(localStorage.getItem("cove:theme-cache") ?? "{}").id).toBe("light");
  });

  test("applies exact theme DOM attributes, CSS variables, and meta color", async () => {
    window.matchMedia = createMatchMedia(true);
    const theme = await import("../../../src/lib/theme");
    theme.setTheme("system");
    theme.setLightTheme("light");
    theme.setDarkTheme("dracula");

    theme.initTheme();
    await flushSignals();

    expect(document.documentElement.getAttribute("data-appearance")).toBe("dark");
    expect(document.documentElement.style.getPropertyValue("--color-bg-primary")).toBe(
      draculaTheme.colors["--color-bg-primary"],
    );
    expect(document.documentElement.style.getPropertyValue("--color-accent")).toBe(
      draculaTheme.colors["--color-accent"],
    );
    expect(document.documentElement.style.getPropertyValue("--shadow-md")).toBe(
      draculaTheme.colors["--shadow-md"],
    );
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(
      draculaTheme.colors["--color-bg-primary"],
    );
  });

  test("applies the theme without a theme-color meta tag", async () => {
    document.head.replaceChildren();
    window.matchMedia = createMatchMedia(false);
    const theme = await import("../../../src/lib/theme");
    theme.setTheme("system");
    theme.setLightTheme("light");
    theme.setDarkTheme("dracula");

    expect(() => theme.initTheme()).not.toThrow();
    await flushSignals();

    expect(document.documentElement.getAttribute("data-appearance")).toBe("light");
    expect(document.querySelector('meta[name="theme-color"]')).toBeNull();
  });

  test("initializes with legacy media query lists that have no listener API", async () => {
    window.matchMedia = ((query: string) =>
      ({
        matches: true,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => true,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;
    const theme = await import("../../../src/lib/theme");
    theme.setTheme("system");
    theme.setLightTheme("light");
    theme.setDarkTheme("dracula");

    expect(() => theme.initTheme()).not.toThrow();
    await flushSignals();

    expect(document.documentElement.getAttribute("data-appearance")).toBe("dark");
    expect(document.documentElement.style.getPropertyValue("--color-bg-primary")).toBe(
      draculaTheme.colors["--color-bg-primary"],
    );
  });
});

function createMatchMedia(matches: boolean): typeof window.matchMedia {
  return ((query: string) =>
    ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => true,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

async function flushSignals(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
