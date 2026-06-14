/** @jsxImportSource preact */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import { fireEvent, renderComponent, screen, waitFor } from "../../../helpers/dom";
import { installI18nMock } from "../../../helpers/i18n";
import { createGatewayMock } from "../../../helpers/module-mocks";
import type { ModelChoice } from "../../../../src/types/models";

const models = signal<ModelChoice[]>([]);
const defaultModel = signal<string | null>(null);
const gatewayCalls: Array<{ method: string; params: unknown }> = [];
const storage = await import("../../../../src/lib/storage");

installI18nMock({ t: (key: string) => key });

mock.module("@/signals/models", () => ({
  defaultModel,
  getModelDisplayName: (modelId: string) =>
    models.value.find((model) => model.id === modelId)?.name ?? modelId,
  models,
}));

mock.module("@/lib/gateway", () => ({
  ...createGatewayMock({
    send: async (method: string, params?: unknown) => {
      gatewayCalls.push({ method, params });
      return { ok: true };
    },
  }),
}));
mock.module("@/lib/storage", () => storage);

mock.module("@/lib/logger", () => ({
  log: {
    ui: {
      debug: () => undefined,
      error: () => undefined,
    },
  },
}));

mock.module("@/hooks/useClickOutside", () => ({
  useClickOutside: () => undefined,
}));

mock.module("@/components/ui/icons", () => ({
  ChevronDownIcon: () => <span aria-hidden="true" />,
}));

const { ModelPicker } = await import("../../../../src/components/chat/ModelPicker");

describe("ModelPicker", () => {
  beforeEach(() => {
    models.value = [
      { id: "anthropic/claude-opus-4-5", name: "Claude Opus", provider: "anthropic" },
      { id: "openai/gpt-5.4", name: "GPT 5.4", provider: "openai" },
      { id: "anthropic/claude-opus-4-5", name: "Claude Opus duplicate", provider: "anthropic" },
    ];
    defaultModel.value = "anthropic/claude-opus-4-5";
    gatewayCalls.length = 0;
  });

  test("shows the full configured model catalog across providers", () => {
    renderComponent(
      <ModelPicker sessionKey="agent:main:main" currentModel="anthropic/claude-opus-4-5" />,
    );

    fireEvent.click(screen.getByText("Claude Opus"));

    expect(screen.getByText("GPT 5.4")).toBeTruthy();
    expect(document.body.textContent?.match(/Claude Opus/g)).toHaveLength(2);
    expect(document.body.textContent).not.toContain("Claude Opus duplicate");
  });

  test("patches the session when selecting a configured model from another provider", async () => {
    const selected: string[] = [];
    renderComponent(
      <ModelPicker
        sessionKey="agent:main:main"
        currentModel="anthropic/claude-opus-4-5"
        onModelChange={(modelId) => selected.push(modelId)}
      />,
    );

    fireEvent.click(screen.getByText("Claude Opus"));
    fireEvent.click(screen.getByText("GPT 5.4"));
    await Promise.resolve();

    expect(gatewayCalls).toEqual([
      {
        method: "sessions.patch",
        params: { key: "agent:main:main", model: "openai/gpt-5.4" },
      },
    ]);
    expect(selected).toEqual(["openai/gpt-5.4"]);
  });

  test("refreshes menu options when the configured model catalog changes", async () => {
    renderComponent(
      <ModelPicker sessionKey="agent:main:main" currentModel="anthropic/claude-opus-4-5" />,
    );

    fireEvent.click(screen.getByText("Claude Opus"));
    expect(screen.getByText("GPT 5.4")).toBeTruthy();

    models.value = [
      { id: "anthropic/claude-opus-4-5", name: "Claude Opus", provider: "anthropic" },
      { id: "google/gemini-3", name: "Gemini 3", provider: "google" },
    ];

    await waitFor(() => expect(screen.getByText("Gemini 3")).toBeTruthy());
    expect(screen.queryByText("GPT 5.4")).toBeNull();
  });
});
