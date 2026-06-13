import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { clearAuth, getAuth, getSessionCredential, saveAuth } from "../../../src/lib/storage";
import { installStorageMocks } from "../../helpers/storage";

let restoreStorage: (() => void) | undefined;

beforeEach(() => {
  restoreStorage = installStorageMocks();
});

afterEach(() => {
  restoreStorage?.();
  restoreStorage = undefined;
});

describe("auth storage", () => {
  test("remember-me stores credentials in localStorage and clears stale session credentials", () => {
    sessionStorage.setItem("cove:session-auth", JSON.stringify({ credential: "stale-session" }));

    saveAuth({
      url: "wss://gateway.example.test",
      authMode: "token",
      rememberMe: true,
      credential: "remembered-token",
    });

    expect(localStorage.getItem("cove:auth")).toBe(
      JSON.stringify({
        url: "wss://gateway.example.test",
        authMode: "token",
        rememberMe: true,
      }),
    );
    expect(localStorage.getItem("cove:credential")).toBe(JSON.stringify("remembered-token"));
    expect(sessionStorage.getItem("cove:session-auth")).toBeNull();
    expect(getSessionCredential()).toBe("remembered-token");
  });

  test("non-remembered auth stores credentials in sessionStorage and clears stale remembered credentials", () => {
    localStorage.setItem("cove:credential", JSON.stringify("stale-remembered"));

    saveAuth({
      url: "wss://gateway.example.test",
      authMode: "password",
      rememberMe: false,
      credential: "session-password",
    });

    expect(localStorage.getItem("cove:auth")).toBe(
      JSON.stringify({
        url: "wss://gateway.example.test",
        authMode: "password",
        rememberMe: false,
      }),
    );
    expect(localStorage.getItem("cove:credential")).toBeNull();
    expect(sessionStorage.getItem("cove:session-auth")).toBe(
      JSON.stringify({ credential: "session-password" }),
    );
    expect(getSessionCredential()).toBe("session-password");
  });

  test("getAuth migrates legacy embedded credentials out of persisted auth", () => {
    localStorage.setItem(
      "cove:auth",
      JSON.stringify({
        url: "wss://gateway.example.test",
        authMode: "token",
        rememberMe: true,
        credential: "legacy-token",
      }),
    );

    expect(getAuth()).toEqual({
      url: "wss://gateway.example.test",
      authMode: "token",
      rememberMe: true,
    });
    expect(localStorage.getItem("cove:auth")).toBe(
      JSON.stringify({
        url: "wss://gateway.example.test",
        authMode: "token",
        rememberMe: true,
      }),
    );
    expect(localStorage.getItem("cove:credential")).toBe(JSON.stringify("legacy-token"));
    expect(sessionStorage.getItem("cove:session-auth")).toBeNull();
    expect(getSessionCredential()).toBe("legacy-token");
  });

  test("clearAuth removes auth preferences and credentials from both storage scopes", () => {
    localStorage.setItem(
      "cove:auth",
      JSON.stringify({
        url: "wss://gateway.example.test",
        authMode: "token",
        rememberMe: true,
      }),
    );
    localStorage.setItem("cove:credential", JSON.stringify("remembered-token"));
    sessionStorage.setItem("cove:session-auth", JSON.stringify({ credential: "session-token" }));

    clearAuth();

    expect(localStorage.getItem("cove:auth")).toBeNull();
    expect(localStorage.getItem("cove:credential")).toBeNull();
    expect(sessionStorage.getItem("cove:session-auth")).toBeNull();
    expect(getAuth()).toBeNull();
    expect(getSessionCredential()).toBeNull();
  });
});
