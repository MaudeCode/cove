import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installGatewayAliasMock, resetGatewayAliasMock } from "../../helpers/gateway-alias";

const gatewayCalls: Array<{ method: string; params: unknown }> = [];
const gatewayResponses = new Map<string, unknown>();
const gateway = installGatewayAliasMock();

gateway.send = async (method: string, params?: unknown) => {
  gatewayCalls.push({ method, params });
  const response = gatewayResponses.get(method);
  if (response instanceof Error) throw response;
  if (response !== undefined) return response;
  throw new Error(`Unexpected gateway method: ${method}`);
};

mock.module("@/lib/logger", () => ({
  log: {
    ui: {
      debug: () => undefined,
      error: () => undefined,
    },
  },
}));

const modelsSignal = await import("../../../src/signals/models");

beforeEach(() => {
  const state = resetGatewayAliasMock();
  state.isConnected.value = true;
  state.send = async (method: string, params?: unknown) => {
    gatewayCalls.push({ method, params });
    const response = gatewayResponses.get(method);
    if (response instanceof Error) throw response;
    if (response !== undefined) return response;
    throw new Error(`Unexpected gateway method: ${method}`);
  };
  gatewayCalls.length = 0;
  gatewayResponses.clear();
  modelsSignal.models.value = [];
  modelsSignal.defaultModel.value = null;
});

describe("model signals", () => {
  test("loads configured models and tolerates status failures", async () => {
    gatewayResponses.set("models.list", {
      models: [
        { id: "anthropic/claude-opus-4-5", name: "Claude Opus", provider: "anthropic" },
        { id: "openai/gpt-5.4", name: "GPT 5.4", provider: "openai" },
      ],
    });
    gatewayResponses.set("status", new Error("status unavailable"));

    await modelsSignal.loadModels();

    expect(gatewayCalls).toEqual([
      { method: "models.list", params: { view: "configured" } },
      { method: "status", params: {} },
    ]);
    expect(modelsSignal.models.value.map((model) => model.id)).toEqual([
      "anthropic/claude-opus-4-5",
      "openai/gpt-5.4",
    ]);
    expect(modelsSignal.defaultModel.value).toBeNull();
  });

  test("extracts the default model and groups models by provider", async () => {
    gatewayResponses.set("models.list", {
      models: [
        { id: "anthropic/claude-opus-4-5", name: "Claude Opus", provider: "anthropic" },
        { id: "anthropic/claude-sonnet-4-5", name: "Claude Sonnet", provider: "anthropic" },
        { id: "openai/gpt-5.4", name: "GPT 5.4", provider: "openai" },
      ],
    });
    gatewayResponses.set("status", {
      sessions: { defaults: { model: "anthropic/claude-sonnet-4-5" } },
    });

    await modelsSignal.loadModels();

    expect(modelsSignal.defaultModel.value).toBe("anthropic/claude-sonnet-4-5");
    expect(modelsSignal.modelsByProvider.value.get("anthropic")?.map((model) => model.id)).toEqual([
      "anthropic/claude-opus-4-5",
      "anthropic/claude-sonnet-4-5",
    ]);
    expect(modelsSignal.modelsByProvider.value.get("openai")?.map((model) => model.id)).toEqual([
      "openai/gpt-5.4",
    ]);
  });

  test("clears a stale default model when status later omits defaults", async () => {
    gatewayResponses.set("models.list", {
      models: [{ id: "anthropic/claude-opus-4-5", name: "Claude Opus", provider: "anthropic" }],
    });
    gatewayResponses.set("status", {
      sessions: { defaults: { model: "anthropic/claude-opus-4-5" } },
    });

    await modelsSignal.loadModels();
    expect(modelsSignal.defaultModel.value).toBe("anthropic/claude-opus-4-5");

    gatewayResponses.set("status", { sessions: { defaults: {} } });

    await modelsSignal.loadModels();
    expect(modelsSignal.defaultModel.value).toBeNull();

    gatewayResponses.set("status", null);
    modelsSignal.defaultModel.value = "anthropic/claude-opus-4-5";

    await modelsSignal.loadModels();
    expect(modelsSignal.defaultModel.value).toBeNull();

    gatewayResponses.set("status", new Error("status unavailable"));
    modelsSignal.defaultModel.value = "anthropic/claude-opus-4-5";

    await modelsSignal.loadModels();
    expect(modelsSignal.defaultModel.value).toBe("anthropic/claude-opus-4-5");
  });

  test("leaves prior models intact when a refresh fails", async () => {
    modelsSignal.models.value = [
      { id: "anthropic/claude-opus-4-5", name: "Claude Opus", provider: "anthropic" },
    ];
    modelsSignal.defaultModel.value = "anthropic/claude-opus-4-5";
    gatewayResponses.set("models.list", new Error("catalog unavailable"));
    gatewayResponses.set("status", {
      sessions: { defaults: { model: "anthropic/claude-sonnet-4-5" } },
    });

    await modelsSignal.loadModels();

    expect(modelsSignal.models.value.map((model) => model.id)).toEqual([
      "anthropic/claude-opus-4-5",
    ]);
    expect(modelsSignal.defaultModel.value).toBe("anthropic/claude-opus-4-5");
  });

  test("uses catalog names and strips common provider prefixes for display fallback", () => {
    modelsSignal.models.value = [
      { id: "anthropic/claude-opus-4-5", name: "Claude Opus", provider: "anthropic" },
    ];

    expect(modelsSignal.getModelDisplayName("anthropic/claude-opus-4-5")).toBe("Claude Opus");
    expect(modelsSignal.getModelDisplayName("anthropic/claude-sonnet-4-5")).toBe("sonnet-4-5");
    expect(modelsSignal.getModelDisplayName("openai/gpt-5.4")).toBe("5.4");
    expect(modelsSignal.getModelDisplayName("other/model-x")).toBe("other/model-x");
  });
});
