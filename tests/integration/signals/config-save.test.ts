import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { getConfigPatchReplacePaths } from "../../../src/lib/config/patch-replace-paths";
import {
  createGatewaySendRecorder,
  integrationGatewayMock,
  setIntegrationGatewaySend,
} from "../../helpers/gateway";
import { resetSignals } from "../../helpers/signals";

const defaultConfigGet = {
  config: {
    allowedTools: ["read", "write"],
    nested: { enabled: true, limit: 3 },
  },
  exists: true,
  hash: "hash-before-save",
  path: "/tmp/config.json",
  raw: "{}",
  valid: true,
};

const defaultSchema = {
  generatedAt: "2026-06-13T00:00:00.000Z",
  schema: {
    properties: {
      allowedTools: { type: "array" },
      nested: { type: "object" },
    },
    type: "object",
  },
  uiHints: {
    allowedTools: { label: "Allowed tools" },
  },
  version: "2026.6.13",
};

const gateway = createGatewaySendRecorder({
  "config.get": defaultConfigGet,
  "config.schema": defaultSchema,
});

mock.module("@/lib/gateway", () => ({
  isConnected: integrationGatewayMock.isConnected,
  mainSessionKey: { value: null },
  send: (method: string, params?: unknown) => integrationGatewayMock.send(method, params),
}));

mock.module("@/lib/session-utils", () => ({
  getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

mock.module("@/lib/i18n", () => ({
  formatBytes: (value: number) => `${value} B`,
  formatTimestampCompact: (value: number) => String(value),
  formatTokens: (value: number) => String(value),
  t: (key: string) => key,
}));

mock.module("@/lib/config/patch-replace-paths", () => ({
  getConfigPatchReplacePaths,
}));

const {
  baseHash,
  canSave,
  configExists,
  configPath,
  configValid,
  draftConfig,
  draftRevision,
  error,
  isDirty,
  isLoading,
  isSaving,
  loadConfig,
  originalConfig,
  saveConfig,
  schema,
  schemaVersion,
  searchQuery,
  uiHints,
  validationErrors,
} = await import("../../../src/signals/config");

describe("config signals", () => {
  afterAll(() => {
    mock.restore();
  });

  beforeEach(() => {
    gateway.clear();
    integrationGatewayMock.isConnected.value = false;
    setIntegrationGatewaySend(gateway.send);
    gateway.setResponse("config.get", defaultConfigGet);
    gateway.setResponse("config.schema", defaultSchema);
    gateway.setResponse("config.patch", (_method: string, params: unknown) => {
      const patch = JSON.parse((params as { raw: string }).raw) as Record<string, unknown>;
      return {
        config: applyMergePatch(originalConfig.value, patch),
        ok: true,
        path: "/tmp/config.json",
      };
    });
    resetConfigSignals();
  });

  test("loads config and schema in parallel and stores response metadata", async () => {
    let resolveConfig!: (value: unknown) => void;
    let resolveSchema!: (value: unknown) => void;
    const configPromise = new Promise((resolve) => {
      resolveConfig = resolve;
    });
    const schemaPromise = new Promise((resolve) => {
      resolveSchema = resolve;
    });
    gateway.setResponse("config.get", () => configPromise);
    gateway.setResponse("config.schema", () => schemaPromise);

    const loading = loadConfig();
    await Promise.resolve();

    expect(isLoading.value).toBe(true);
    expect(gateway.calls).toEqual([
      ["config.get", {}],
      ["config.schema", {}],
    ]);

    resolveConfig(defaultConfigGet);
    resolveSchema(defaultSchema);
    await loading;

    expect(schema.value).toEqual(defaultSchema.schema);
    expect(uiHints.value).toEqual(defaultSchema.uiHints);
    expect(schemaVersion.value).toBe("2026.6.13");
    expect(originalConfig.value).toEqual(defaultConfigGet.config);
    expect(draftConfig.value).toEqual(defaultConfigGet.config);
    expect(draftConfig.value).not.toBe(originalConfig.value);
    expect(draftRevision.value).toBe(1);
    expect(baseHash.value).toBe("hash-before-save");
    expect(configPath.value).toBe("/tmp/config.json");
    expect(configExists.value).toBe(true);
    expect(configValid.value).toBe(true);
    expect(validationErrors.value).toEqual({});
    expect(error.value).toBeNull();
    expect(isLoading.value).toBe(false);
  });

  test("resetDraft restores original config and advances draft revision", async () => {
    const { resetDraft } = await import("../../../src/signals/config");
    originalConfig.value = { nested: { limit: 3 } };
    draftConfig.value = { nested: { limit: 4 } };
    validationErrors.value = { "nested.limit": "Invalid" };

    resetDraft();

    expect(draftConfig.value).toEqual({ nested: { limit: 3 } });
    expect(draftConfig.value).not.toBe(originalConfig.value);
    expect(validationErrors.value).toEqual({});
    expect(draftRevision.value).toBe(1);
  });

  test("records load failures and stops loading", async () => {
    schema.value = { type: "object", title: "Existing schema" };
    uiHints.value = { existing: { label: "Existing" } };
    originalConfig.value = { existing: true };
    draftConfig.value = { existing: false };
    baseHash.value = "old-hash";
    configPath.value = "/tmp/old-config.json";
    configExists.value = true;
    configValid.value = false;
    schemaVersion.value = "old-version";
    gateway.setResponse("config.schema", () => {
      throw new Error("schema unavailable");
    });

    await loadConfig();

    expect(gateway.calls.map(([method]) => method)).toEqual(["config.get", "config.schema"]);
    expect(error.value).toBe("schema unavailable");
    expect(isLoading.value).toBe(false);
    expect(schema.value).toEqual({ type: "object", title: "Existing schema" });
    expect(uiHints.value).toEqual({ existing: { label: "Existing" } });
    expect(originalConfig.value).toEqual({ existing: true });
    expect(draftConfig.value).toEqual({ existing: false });
    expect(baseHash.value).toBe("old-hash");
    expect(configPath.value).toBe("/tmp/old-config.json");
    expect(configExists.value).toBe(true);
    expect(configValid.value).toBe(false);
    expect(schemaVersion.value).toBe("old-version");
  });

  test("tracks dirty and canSave state with validation and saving gates", () => {
    originalConfig.value = { nested: { enabled: true } };
    draftConfig.value = { nested: { enabled: true } };

    expect(isDirty.value).toBe(false);
    expect(canSave.value).toBe(false);

    draftConfig.value = { nested: { enabled: false } };
    expect(isDirty.value).toBe(true);
    expect(canSave.value).toBe(true);

    validationErrors.value = { "nested.enabled": "Invalid" };
    expect(canSave.value).toBe(false);
    expect(isDirty.value).toBe(true);

    validationErrors.value = {};
    isSaving.value = true;
    expect(canSave.value).toBe(false);
  });

  test("tracks validation errors even when the draft is otherwise unchanged", () => {
    originalConfig.value = { nested: { limit: 3 } };
    draftConfig.value = { nested: { limit: 3 } };

    validationErrors.value = { "nested.limit": "config.validation.mustBeNumber" };

    expect(isDirty.value).toBe(false);
    expect(canSave.value).toBe(false);
    expect(Object.keys(validationErrors.value)).toHaveLength(1);
  });

  test("does not save unchanged configs", async () => {
    originalConfig.value = { model: "same" };
    draftConfig.value = { model: "same" };
    baseHash.value = "hash-before-save";
    configExists.value = true;

    await expect(saveConfig()).resolves.toBe(false);

    expect(isDirty.value).toBe(false);
    expect(canSave.value).toBe(false);
    expect(gateway.calls).toEqual([]);
  });

  test("does not save when validation errors block canSave", async () => {
    originalConfig.value = { model: "old" };
    draftConfig.value = { model: "new" };
    validationErrors.value = { model: "Invalid model" };
    baseHash.value = "hash-before-save";
    configExists.value = true;

    await expect(saveConfig()).resolves.toBe(false);

    expect(gateway.calls).toEqual([]);
    expect(error.value).toBeNull();
  });

  test("blocks existing config saves without a base hash", async () => {
    originalConfig.value = { model: "old" };
    draftConfig.value = { model: "new" };
    baseHash.value = null;
    configExists.value = true;

    await expect(saveConfig()).resolves.toBe(false);

    expect(gateway.calls).toEqual([]);
    expect(error.value).toBe("Missing base hash. Reload and try again.");
  });

  test("sends nested patches without replacePaths for non-destructive edits", async () => {
    originalConfig.value = {
      model: "old",
      nested: { enabled: true, limit: 3 },
    };
    draftConfig.value = {
      model: "old",
      nested: { enabled: false, limit: 3 },
    };
    baseHash.value = "hash-before-save";
    configExists.value = true;

    await expect(saveConfig()).resolves.toBe(true);

    expect(gateway.calls[0]).toEqual([
      "config.patch",
      {
        raw: JSON.stringify({ nested: { enabled: false } }),
        baseHash: "hash-before-save",
      },
    ]);
  });

  test("sends deleted object keys as null merge-patch values", async () => {
    originalConfig.value = {
      model: "old",
      nested: { enabled: true, removeMe: "yes" },
    };
    draftConfig.value = {
      model: "old",
      nested: { enabled: true },
    };
    baseHash.value = "hash-before-save";
    configExists.value = true;

    await expect(saveConfig()).resolves.toBe(true);

    expect(gateway.calls[0]).toEqual([
      "config.patch",
      {
        raw: JSON.stringify({ nested: { removeMe: null } }),
        baseHash: "hash-before-save",
      },
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

  test("omits replacePaths for additive array edits", async () => {
    originalConfig.value = { allowedTools: ["read"] };
    draftConfig.value = { allowedTools: ["read", "write"] };
    baseHash.value = "hash-before-save";
    configExists.value = true;

    await expect(saveConfig()).resolves.toBe(true);

    const patchParams = gateway.calls[0][1] as Record<string, unknown>;
    expect(patchParams).toEqual({
      raw: JSON.stringify({ allowedTools: ["read", "write"] }),
      baseHash: "hash-before-save",
    });
    expect("replacePaths" in patchParams).toBe(false);
  });

  test("returns false and skips hash refresh when config.patch reports ok false", async () => {
    gateway.setResponse("config.patch", {
      config: {},
      ok: false,
      path: "/tmp/config.json",
    });
    originalConfig.value = { model: "old" };
    draftConfig.value = { model: "new" };
    baseHash.value = "hash-before-save";
    configExists.value = true;

    await expect(saveConfig()).resolves.toBe(false);

    expect(gateway.calls).toEqual([
      ["config.patch", { raw: JSON.stringify({ model: "new" }), baseHash: "hash-before-save" }],
    ]);
    expect(error.value).toBe("Failed to save configuration");
    expect(baseHash.value).toBe("hash-before-save");
    expect(originalConfig.value).toEqual({ model: "old" });
    expect(draftConfig.value).toEqual({ model: "new" });
    expect(isSaving.value).toBe(false);
  });

  test("maps hash conflict failures to reload guidance", async () => {
    gateway.setResponse("config.patch", () => {
      throw new Error("base hash changed");
    });
    originalConfig.value = { model: "old" };
    draftConfig.value = { model: "new" };
    baseHash.value = "hash-before-save";
    configExists.value = true;

    await expect(saveConfig()).resolves.toBe(false);

    expect(error.value).toBe("Configuration was modified externally. Please reload.");
    expect(isSaving.value).toBe(false);
    expect(originalConfig.value).toEqual({ model: "old" });
    expect(draftConfig.value).toEqual({ model: "new" });
  });

  test("refreshes base hash after successful saves", async () => {
    gateway.setResponse("config.get", { ...defaultConfigGet, hash: "hash-after-save" });
    originalConfig.value = { model: "old", theme: "dark" };
    draftConfig.value = { model: "new", theme: "dark" };
    baseHash.value = "hash-before-save";
    configExists.value = true;

    await expect(saveConfig()).resolves.toBe(true);

    expect(gateway.calls.map(([method]) => method)).toEqual(["config.patch", "config.get"]);
    expect(originalConfig.value).toEqual({ model: "new", theme: "dark" });
    expect(draftConfig.value).toEqual({ model: "new", theme: "dark" });
    expect(draftConfig.value).not.toBe(originalConfig.value);
    expect(draftRevision.value).toBe(1);
    expect(configPath.value).toBe("/tmp/config.json");
    expect(baseHash.value).toBe("hash-after-save");
    expect(error.value).toBeNull();
    expect(isSaving.value).toBe(false);
  });
});

function resetConfigSignals(): void {
  resetSignals([
    [isLoading, false],
    [error, null],
    [isSaving, false],
    [schema, null],
    [uiHints, {}],
    [originalConfig, {}],
    [draftConfig, {}],
    [draftRevision, 0],
    [baseHash, null],
    [configPath, null],
    [configExists, false],
    [configValid, true],
    [schemaVersion, null],
    [searchQuery, ""],
    [validationErrors, {}],
  ]);
}

function applyMergePatch(
  target: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const next = structuredClone(target);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete next[key];
      continue;
    }

    const current = next[key];
    if (isPlainObject(current) && isPlainObject(value)) {
      next[key] = applyMergePatch(current, value);
      continue;
    }

    next[key] = value;
  }

  return next;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
