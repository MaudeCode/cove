import { describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import { GatewayRpcError } from "../../../src/lib/gateway";

mock.module("@/lib/gateway", () => ({
  mainSessionKey: signal("agent:main:main"),
}));
mock.module("@/lib/utils", () => ({
  capitalize: (value: string) => value.charAt(0).toUpperCase() + value.slice(1),
}));

const { getErrorMessage } = await import("../../../src/lib/session-utils");

describe("session utility errors", () => {
  test("getErrorMessage keeps UI-facing gateway RPC text compatible", () => {
    const error = new GatewayRpcError({
      code: "CONFIG_INVALID",
      message: "Configuration is invalid",
      scope: "global",
      remediation: "Fix the configuration and retry.",
      diagnostics: { path: "agents.main" },
    });

    expect(getErrorMessage(error)).toBe("Configuration is invalid");
  });
});
