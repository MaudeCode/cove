/** @jsxImportSource preact */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import Prism from "prismjs";
import { fireEvent, renderComponent, screen, waitFor } from "../../../helpers/dom";
import { installI18nMock } from "../../../helpers/i18n";
import { createGatewayTestHarness } from "../../../helpers/module-mocks";
import { installUiMocks } from "../../../helpers/ui-mocks";
import { sanitizeCodeHtml } from "../../../../src/lib/sanitize";

const isConnected = signal(true);
const gatewayHarness = createGatewayTestHarness({
  isConnected,
  mainSessionKey: signal("agent:main:main"),
});
const rpcCalls = gatewayHarness.calls;
const originalHighlight = Prism.highlight;
let importCounter = 0;

mock.module("@/lib/gateway", () => ({
  ...gatewayHarness.module(),
}));
installI18nMock({
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
});
mock.module("@/lib/utils", () => ({
  formatJson: (value: unknown) => JSON.stringify(value, null, 2),
  isAvatarUrl: (value?: string) => !!value?.startsWith("http"),
}));
mock.module("@/lib/sanitize", () => ({ sanitizeCodeHtml }));
installUiMocks();

beforeEach(() => {
  document.body.replaceChildren();
  gatewayHarness.reset();
  gatewayHarness.mainSessionKey.value = "agent:main:main";
});

afterEach(() => {
  Prism.highlight = originalHighlight;
});

describe("JsonBlock", () => {
  test("sanitizes highlighted HTML before rendering", async () => {
    Prism.highlight = () =>
      '<img src=x onerror=alert(1)><script>alert(1)</script><span class="token string">safe</span>';
    const { JsonBlock } = await importJsonBlock();

    renderComponent(<JsonBlock value='{"safe":true}' />);

    const codeBlock = screen.getByText("safe").closest("pre");
    expect(codeBlock).toBeTruthy();
    expect(codeBlock?.querySelector("img")).toBeNull();
    expect(codeBlock?.querySelector("script")).toBeNull();
    expect(codeBlock?.innerHTML).not.toContain("onerror");
  });
});

describe("ManualRpcPanel", () => {
  test("calls the default method with undefined params in empty form mode", async () => {
    const { ManualRpcPanel } = await importPanel();

    queuePresenceSuccess();
    renderComponent(<ManualRpcPanel />);
    fireEvent.click(screen.getByRole("button", { name: "debug.call" }));

    await waitFor(() =>
      expect(rpcCalls).toEqual([{ method: "system-presence", params: undefined }]),
    );
    expect(screen.getByText("debug.ok")).toBeTruthy();
  });

  test("builds trimmed string params from form fields and ignores blank keys", async () => {
    const { ManualRpcPanel } = await importPanel();

    queuePresenceSuccess();
    renderComponent(<ManualRpcPanel />);
    fireEvent.click(screen.getByRole("button", { name: "debug.addParam" }));
    fireEvent.click(screen.getByRole("button", { name: "debug.addParam" }));
    const keys = screen.getAllByPlaceholderText("key");
    const values = screen.getAllByPlaceholderText("value");
    fireEvent.input(keys[0], { target: { value: " accountId " } });
    fireEvent.input(values[0], { target: { value: "acct_1" } });
    fireEvent.input(values[1], { target: { value: "ignored" } });

    fireEvent.click(screen.getByRole("button", { name: "debug.call" }));

    await waitFor(() =>
      expect(rpcCalls).toEqual([{ method: "system-presence", params: { accountId: "acct_1" } }]),
    );
  });

  test("syncs form params to JSON mode and dispatches parsed JSON params", async () => {
    const { ManualRpcPanel } = await importPanel();

    queuePresenceSuccess();
    renderComponent(<ManualRpcPanel />);
    fireEvent.click(screen.getByRole("button", { name: "debug.addParam" }));
    fireEvent.input(screen.getByPlaceholderText("key"), { target: { value: "limit" } });
    fireEvent.input(screen.getByPlaceholderText("value"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "debug.jsonMode" }));

    const paramsText = screen.getByLabelText("debug.paramsJson") as HTMLTextAreaElement;
    expect(paramsText.value).toContain('"limit": "10"');

    fireEvent.input(paramsText, { target: { value: '{"limit":10,"live":true}' } });
    fireEvent.click(screen.getByRole("button", { name: "debug.call" }));

    await waitFor(() =>
      expect(rpcCalls).toEqual([{ method: "system-presence", params: { limit: 10, live: true } }]),
    );
  });

  test("syncs JSON object entries back to form fields as strings", async () => {
    const { ManualRpcPanel } = await importPanel();

    renderComponent(<ManualRpcPanel />);
    fireEvent.click(screen.getByRole("button", { name: "debug.jsonMode" }));
    fireEvent.input(screen.getByLabelText("debug.paramsJson"), {
      target: { value: '{"count":2,"nested":{"ok":true}}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "debug.formMode" }));

    expect((screen.getAllByPlaceholderText("key")[0] as HTMLInputElement).value).toBe("count");
    expect((screen.getAllByPlaceholderText("value")[0] as HTMLInputElement).value).toBe("2");
    expect((screen.getAllByPlaceholderText("key")[1] as HTMLInputElement).value).toBe("nested");
    expect((screen.getAllByPlaceholderText("value")[1] as HTMLInputElement).value).toBe(
      '{"ok":true}',
    );
  });

  test("reports invalid JSON without sending and surfaces rejected RPC errors", async () => {
    const { ManualRpcPanel } = await importPanel();

    renderComponent(<ManualRpcPanel />);
    fireEvent.click(screen.getByRole("button", { name: "debug.jsonMode" }));
    fireEvent.input(screen.getByLabelText("debug.paramsJson"), { target: { value: "{bad" } });
    fireEvent.click(screen.getByRole("button", { name: "debug.call" }));

    expect(rpcCalls).toEqual([]);
    expect(screen.getByText(/Expected property name|JSON/)).toBeTruthy();
    expect(screen.getByText("common.error")).toBeTruthy();

    fireEvent.input(screen.getByLabelText("debug.paramsJson"), { target: { value: "{}" } });
    gatewayHarness.queueResponse("system-presence", new Error("method failed"));
    fireEvent.click(screen.getByRole("button", { name: "debug.call" }));

    await waitFor(() => expect(screen.getByText("method failed")).toBeTruthy());
    expect(rpcCalls).toEqual([{ method: "system-presence", params: undefined }]);
  });

  test("sanitizes rendered RPC results", async () => {
    const { ManualRpcPanel } = await importPanel();

    gatewayHarness.queueResponse("system-presence", {
      html: "<img src=x onerror=alert(1)>",
      script: "<script>alert(1)</script>",
    });
    renderComponent(<ManualRpcPanel />);
    fireEvent.click(screen.getByRole("button", { name: "debug.call" }));

    await waitFor(() => expect(screen.getByText("debug.ok")).toBeTruthy());
    const result = document.querySelector("pre");
    expect(result?.innerHTML).toContain("&lt;img");
    expect(result?.querySelector("img")).toBeNull();
    expect(result?.querySelector("script")).toBeNull();
    expect(result?.innerHTML).not.toContain("<script>");
  });

  test("does not dispatch while disconnected or when method is blank", async () => {
    const { ManualRpcPanel } = await importPanel();

    isConnected.value = false;
    renderComponent(<ManualRpcPanel />);
    const callButton = screen.getByRole("button", { name: "debug.call" });
    expect(callButton).toHaveProperty("disabled", true);
    fireEvent.click(callButton);
    expect(rpcCalls).toEqual([]);

    isConnected.value = true;
    const { ManualRpcPanel: FreshPanel } = await importPanel();
    renderComponent(<FreshPanel />);
    fireEvent.input(screen.getByLabelText("debug.method"), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "debug.call" })).toHaveProperty("disabled", true);
  });
});

async function importPanel(): Promise<
  typeof import("../../../../src/components/debug/ManualRpcPanel")
> {
  // @ts-ignore Query suffix gives each test fresh module state.
  return import(`../../../../src/components/debug/ManualRpcPanel.tsx?unit=${importCounter++}`);
}

async function importJsonBlock(): Promise<
  typeof import("../../../../src/components/debug/JsonBlock")
> {
  // @ts-ignore Query suffix gives the sanitizer sink test fresh module state.
  return import(`../../../../src/components/debug/JsonBlock.tsx?unit=${importCounter++}`);
}

function queuePresenceSuccess(): void {
  gatewayHarness.queueResponse("system-presence", { ok: true });
}
