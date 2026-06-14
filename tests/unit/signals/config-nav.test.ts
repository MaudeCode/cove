import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import "../../helpers/dom";

let configNav: typeof import("../../../src/signals/configNav");

beforeAll(async () => {
  configNav = await import("../../../src/signals/configNav");
});

describe("configNav signals", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/config");
    localStorage.clear();
    configNav.selectedPath.value = [];
    configNav.expandedNav.value = new Set(["gateway", "agents", "channels"]);
    configNav.mobileViewingDetail.value = false;
  });

  test("parses section query params into string and numeric path segments", () => {
    window.history.replaceState(null, "", "/config?section=agents.list.2.tools");

    expect(configNav.parseParamToPath()).toEqual(["agents", "list", 2, "tools"]);
  });

  test("parses missing and empty section query params as the root path", () => {
    window.history.replaceState(null, "", "/config");
    expect(configNav.parseParamToPath()).toEqual([]);

    window.history.replaceState(null, "", "/config?section=");
    expect(configNav.parseParamToPath()).toEqual([]);
  });

  test("serializes paths back to section query params", () => {
    expect(configNav.pathToParam(["agents", "list", 2, "tools"])).toBe("agents.list.2.tools");
    expect(configNav.pathToParam([])).toBe("");
  });

  test("selectedPath syncs to URL and resets mobile detail state", () => {
    configNav.mobileViewingDetail.value = true;

    configNav.selectedPath.value = ["gateway", "controlUi"];

    expect(window.location.search).toBe("?section=gateway.controlUi");
    expect(configNav.mobileViewingDetail.value).toBe(false);
  });

  test("selectedPath clears section query params for the root path", () => {
    window.history.replaceState(null, "", "/config?section=gateway.controlUi");

    configNav.selectedPath.value = [];

    expect(window.location.search).toBe("");
  });

  test("popstate updates selectedPath from URL query params", () => {
    window.history.replaceState(null, "", "/config?section=agents.list.1");

    window.dispatchEvent(new Event("popstate"));

    expect(configNav.selectedPath.value).toEqual(["agents", "list", 1]);
  });

  test("selecting nested paths auto-expands every parent path", () => {
    configNav.expandedNav.value = new Set();

    configNav.selectedPath.value = ["agents", "list", 2, "tools"];

    expect([...configNav.expandedNav.value].sort()).toEqual([
      "agents",
      "agents.list",
      "agents.list.2",
    ]);
  });

  test("expanded nav persists to localStorage", () => {
    configNav.expandedNav.value = new Set(["agents", "agents.list"]);

    expect(JSON.parse(localStorage.getItem("cove:config:expandedNav") ?? "[]")).toEqual([
      "agents",
      "agents.list",
    ]);
  });

  test("loadPersistedExpandedNav reads valid storage and falls back on invalid storage", () => {
    localStorage.setItem("cove:config:expandedNav", JSON.stringify(["agents", "agents.list"]));
    expect([...configNav.loadPersistedExpandedNav()]).toEqual(["agents", "agents.list"]);

    localStorage.setItem("cove:config:expandedNav", "{bad json");
    expect([...configNav.loadPersistedExpandedNav()]).toEqual(["gateway", "agents", "channels"]);

    localStorage.removeItem("cove:config:expandedNav");
    expect([...configNav.loadPersistedExpandedNav()]).toEqual(["gateway", "agents", "channels"]);
  });

  test("expandedNav initializes from persisted storage at module load", async () => {
    localStorage.setItem("cove:config:expandedNav", JSON.stringify(["agents", "agents.list"]));

    const cacheBustedPath = "../../../src/signals/configNav.ts?persisted-expanded-nav";
    const freshConfigNav = (await import(
      cacheBustedPath
    )) as typeof import("../../../src/signals/configNav");

    expect([...freshConfigNav.expandedNav.value]).toEqual(["agents", "agents.list"]);
  });
});
