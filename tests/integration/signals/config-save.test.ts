import { beforeEach, describe, expect, mock, test } from "bun:test";
import { getConfigPatchReplacePaths } from "../../../src/lib/config/patch-replace-paths";
import { createGatewaySendRecorder } from "../../helpers/gateway";
import { resetSignals } from "../../helpers/signals";

const gateway = createGatewaySendRecorder({
  "config.patch": (_method: string, params: unknown) => {
    return {
      ok: true,
      config: JSON.parse((params as { raw: string }).raw),
      path: "/tmp/config.json",
    };
  },
  "config.get": { hash: "hash-after-save" },
});

mock.module("@/lib/gateway", () => ({
  mainSessionKey: { value: null },
  send: gateway.send,
}));

mock.module("@/lib/session-utils", () => ({
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

mock.module("@/lib/config/schema-utils", () => ({
  setValueAtPath: () => {
    throw new Error("setValueAtPath is not used by saveConfig tests");
  },
}));

mock.module("@/lib/config/patch-replace-paths", () => ({
  getConfigPatchReplacePaths,
}));

const {
  baseHash,
  configExists,
  draftConfig,
  error,
  isSaving,
  originalConfig,
  saveConfig,
  validationErrors,
} = await import("../../../src/signals/config");

describe("saveConfig", () => {
  beforeEach(() => {
    gateway.clear();
    resetSignals([
      [originalConfig, {}],
      [draftConfig, {}],
      [baseHash, null],
      [configExists, false],
      [validationErrors, {}],
      [isSaving, false],
      [error, null],
    ]);
  });

  test("sends replacePaths with config.patch when saving destructive array edits", async () => {
    originalConfig.value = { allowedTools: ["read", "write"] };
    draftConfig.value = { allowedTools: ["read"] };
    baseHash.value = "hash-before-save";
    configExists.value = true;

    await expect(saveConfig()).resolves.toBe(true);

    expect(gateway.calls[0]).toEqual([
      "config.patch",
      {
        raw: JSON.stringify({ allowedTools: ["read"] }),
        baseHash: "hash-before-save",
        replacePaths: ["allowedTools"],
      },
    ]);
  });
});
