import { describe, expect, test } from "bun:test";
import { signal } from "@preact/signals";
import { createGatewaySendRecorder } from "../../helpers/gateway";
import { createMemoryStorage, installStorageMocks } from "../../helpers/storage";
import { resetSignals } from "../../helpers/signals";
import { installFakeTimers } from "../../helpers/timers";

describe("shared test helpers", () => {
  test("resets signals to their baseline values", () => {
    const count = signal(1);
    const label = signal("ready");

    count.value = 2;
    label.value = "dirty";

    resetSignals([
      [count, 1],
      [label, "ready"],
    ]);

    expect(count.value).toBe(1);
    expect(label.value).toBe("ready");
  });

  test("records mocked gateway send calls and method responses", async () => {
    const gateway = createGatewaySendRecorder({
      "config.get": { raw: "{}" },
    });

    await expect(gateway.send("config.get", { scope: "global" })).resolves.toEqual({
      raw: "{}",
    });

    expect(gateway.calls).toEqual([["config.get", { scope: "global" }]]);
  });

  test("creates isolated memory storage", () => {
    const storage = createMemoryStorage({ token: "abc" });

    storage.setItem("theme", "dark");
    storage.removeItem("token");

    expect(storage.getItem("theme")).toBe("dark");
    expect(storage.getItem("token")).toBeNull();
    expect(storage.length).toBe(1);
    expect(storage.key(0)).toBe("theme");
  });

  test("installs restorable local and session storage mocks", () => {
    const restore = installStorageMocks({
      localStorage: { token: "local" },
      sessionStorage: { token: "session" },
    });

    try {
      expect(localStorage.getItem("token")).toBe("local");
      expect(sessionStorage.getItem("token")).toBe("session");

      localStorage.setItem("theme", "dark");

      expect(localStorage.getItem("theme")).toBe("dark");
      expect(sessionStorage.getItem("theme")).toBeNull();
    } finally {
      restore();
    }
  });

  test("runs scheduled callbacks with fake timers", () => {
    const timers = installFakeTimers();
    const calls: string[] = [];

    try {
      setTimeout(() => calls.push("timeout"), 20);
      const interval = setInterval(() => calls.push("interval"), 10);

      timers.advanceBy(10);
      timers.advanceBy(10);
      clearInterval(interval);
      timers.advanceBy(20);

      expect(calls).toEqual(["interval", "timeout", "interval"]);
    } finally {
      timers.uninstall();
    }
  });

  test("runs all pending timeout callbacks with fake timers", () => {
    const timers = installFakeTimers();
    const calls: string[] = [];

    try {
      setTimeout(() => calls.push("later"), 20);
      setTimeout(() => calls.push("sooner"), 10);

      timers.runAll();

      expect(calls).toEqual(["sooner", "later"]);
      expect(timers.now()).toBe(20);
    } finally {
      timers.uninstall();
    }
  });

  test("rejects uncleared intervals in runAll without looping forever", () => {
    const timers = installFakeTimers();
    const calls: string[] = [];

    try {
      setInterval(() => calls.push("interval"), 10);

      expect(() => timers.runAll()).toThrow(
        "Cannot run all fake timers while intervals are pending.",
      );
      expect(calls).toEqual([]);
    } finally {
      timers.uninstall();
    }
  });
});
