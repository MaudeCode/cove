import { beforeEach, describe, expect, mock, test } from "bun:test";
import { getConfigPatchReplacePaths } from "../../src/lib/config/patch-replace-paths";

type SendCall = [method: string, params: unknown];

let sendCalls: SendCall[] = [];

const send = mock(async (method: string, params: unknown) => {
  sendCalls.push([method, params]);

  if (method === "config.patch") {
    return {
      ok: true,
      config: JSON.parse((params as { raw: string }).raw),
      path: "/tmp/config.json",
    };
  }

  if (method === "config.get") {
    return { hash: "hash-after-save" };
  }

  throw new Error(`Unexpected gateway method: ${method}`);
});

mock.module("@/lib/gateway", () => ({
  mainSessionKey: { value: null },
  send,
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
} = await import("../../src/signals/config");

describe("saveConfig", () => {
  beforeEach(() => {
    sendCalls = [];
    originalConfig.value = {};
    draftConfig.value = {};
    baseHash.value = null;
    configExists.value = false;
    validationErrors.value = {};
    isSaving.value = false;
    error.value = null;
  });

  test("sends replacePaths with config.patch when saving destructive array edits", async () => {
    originalConfig.value = { allowedTools: ["read", "write"] };
    draftConfig.value = { allowedTools: ["read"] };
    baseHash.value = "hash-before-save";
    configExists.value = true;

    await expect(saveConfig()).resolves.toBe(true);

    expect(sendCalls[0]).toEqual([
      "config.patch",
      {
        raw: JSON.stringify({ allowedTools: ["read"] }),
        baseHash: "hash-before-save",
        replacePaths: ["allowedTools"],
      },
    ]);
  });
});
