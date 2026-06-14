/** @jsxImportSource preact */
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { ComponentChildren } from "preact";
import { fireEvent, renderComponent, screen, waitFor } from "../../helpers/dom";
import { installI18nMock } from "../../helpers/i18n";
import { installChatSignalAliases } from "../../helpers/module-aliases";
import { createGatewayTestHarness } from "../../helpers/module-mocks";
import { installUiMocks } from "../../helpers/ui-mocks";
import type { WorkspaceFileResult } from "../../../src/types/workspace";

const gatewayHarness = createGatewayTestHarness();
const sendCalls = gatewayHarness.calls;
const toastMessages: Array<[string, string]> = [];
const routeCalls: string[] = [];
const confirmCalls: string[] = [];
const originalConfirm = window.confirm;
let confirmResult = true;
let importCounter = 0;

await installChatSignalAliases();
mock.module("@/lib/gateway", () => ({
  ...gatewayHarness.module(),
}));
installI18nMock({
  t: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
});
mock.module("tokenx", () => ({
  estimateTokenCount: (content: string) => content.trim().split(/\s+/).filter(Boolean).length,
}));
mock.module("preact-router", () => ({
  route: (path: string) => routeCalls.push(path),
}));
mock.module("@/lib/markdown", () => import("../../../src/lib/markdown"));
mock.module("@/lib/sanitize", () => import("../../../src/lib/sanitize"));
mock.module(
  "@/components/ui/BouncingDots",
  () => import("../../../src/components/ui/BouncingDots"),
);
mock.module("@/signals/chat", () => import("../../../src/signals/chat"));
mock.module("@/types/workspace", () => import("../../../src/types/workspace"));
mock.module(
  "@/components/chat/MessageContent",
  () => import("../../../src/components/chat/MessageContent"),
);
installUiMocks({
  "@/components/ui/Toast": () => ({
    toast: {
      error: (message: string) => toastMessages.push(["error", message]),
      success: (message: string) => toastMessages.push(["success", message]),
    },
  }),
  "@/components/ui/ViewErrorBoundary": () => ({
    ViewErrorBoundary: ({ children }: { children?: ComponentChildren }) => <>{children}</>,
  }),
});

beforeEach(() => {
  document.body.replaceChildren();
  window.history.replaceState(null, "", "/");
  gatewayHarness.reset();
  toastMessages.length = 0;
  routeCalls.length = 0;
  confirmCalls.length = 0;
  confirmResult = true;
  window.confirm = mock((message?: string) => {
    confirmCalls.push(message ?? "");
    return confirmResult;
  });
});

afterEach(() => {
  window.confirm = originalConfirm;
});

describe("WorkspaceEditorView", () => {
  test("loads the decoded file for the selected agent and saves edited content", async () => {
    window.history.replaceState(null, "", "/agents/edit/AGENTS.md?agent=agent-2");
    gatewayHarness.queueResponse(
      "agents.files.get",
      fileResult({
        content: "hello cove <img src=x onerror=alert(1)><script>alert(1)</script>",
        name: "AGENTS.md",
      }),
    );
    gatewayHarness.queueResponse("agents.files.set", {});
    const { WorkspaceEditorView } = await importView();

    renderComponent(<WorkspaceEditorView filename="AGENTS.md" />);

    await waitFor(() => expect(document.body.textContent).toContain("hello cove"));
    expect(sendCalls[0]).toEqual({
      method: "agents.files.get",
      params: { agentId: "agent-2", name: "AGENTS.md" },
    });
    expect(document.body.textContent).toContain("64 B");
    expect(document.body.textContent).toContain("5 tokens");
    expect(document.body.textContent).toContain("short:1234");
    expect(document.body.querySelector("img")).toBeNull();
    expect(document.body.querySelector("script")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "common.edit" }));
    const editor = screen.getByPlaceholderText("agents.files.editPlaceholder");
    fireEvent.input(editor, { target: { value: "hello cove updated" } });
    expect(screen.getByText("agents.files.unsaved")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "actions.save" }));

    await waitFor(() =>
      expect(sendCalls).toContainEqual({
        method: "agents.files.set",
        params: { agentId: "agent-2", content: "hello cove updated", name: "AGENTS.md" },
      }),
    );
    expect(toastMessages).toContainEqual(["success", "agents.files.saved"]);
    expect(screen.queryByText("agents.files.unsaved")).toBeNull();
  });

  test("starts missing files in edit mode and guards unsaved back navigation", async () => {
    window.history.replaceState(null, "", "/agents/edit/memory.md?agent=memory-agent");
    gatewayHarness.queueResponse(
      "agents.files.get",
      fileResult({ content: "", missing: true, name: "memory.md", path: "/repo/memory.md" }),
    );
    const { WorkspaceEditorView } = await importView();

    renderComponent(<WorkspaceEditorView filename="memory.md" />);

    const editor = await waitFor(() => screen.getByPlaceholderText("agents.files.editPlaceholder"));
    fireEvent.input(editor, { target: { value: "new memory" } });

    confirmResult = false;
    fireEvent.click(screen.getByRole("button", { name: "agents.files.backToList" }));
    expect(confirmCalls).toEqual(["agents.files.unsavedWarning"]);
    expect(routeCalls).toEqual([]);

    confirmResult = true;
    fireEvent.click(screen.getByRole("button", { name: "agents.files.backToList" }));
    expect(confirmCalls).toEqual(["agents.files.unsavedWarning", "agents.files.unsavedWarning"]);
    expect(routeCalls).toEqual(["/agents"]);
  });

  test("reports load and save failures without discarding edited content", async () => {
    gatewayHarness.queueResponse("agents.files.get", new Error("cannot load"));
    const { WorkspaceEditorView } = await importView();

    renderComponent(<WorkspaceEditorView filename="AGENTS.md" />);

    await waitFor(() => expect(screen.getByText("cannot load")).toBeTruthy());
    expect(toastMessages).toContainEqual(["error", "agents.files.loadFileError"]);

    gatewayHarness.queueResponse(
      "agents.files.get",
      fileResult({ content: "old", name: "AGENTS.md" }),
    );
    gatewayHarness.queueResponse("agents.files.set", new Error("cannot save"));
    const { WorkspaceEditorView: FreshView } = await importView();
    renderComponent(<FreshView filename="AGENTS.md" />);

    await waitFor(() => expect(screen.getByText("old")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "common.edit" }));
    const editor = screen.getByPlaceholderText(
      "agents.files.editPlaceholder",
    ) as HTMLTextAreaElement;
    fireEvent.input(editor, { target: { value: "new" } });
    fireEvent.click(screen.getByRole("button", { name: "actions.save" }));

    await waitFor(() => expect(toastMessages).toContainEqual(["error", "agents.files.saveError"]));
    expect(editor.value).toBe("new");
    expect(screen.getByText("agents.files.unsaved")).toBeTruthy();
  });

  test("saves dirty edit mode content with Cmd+S", async () => {
    gatewayHarness.queueResponse(
      "agents.files.get",
      fileResult({ content: "draft", name: "AGENTS.md" }),
    );
    gatewayHarness.queueResponse("agents.files.set", {});
    const { WorkspaceEditorView } = await importView();

    renderComponent(<WorkspaceEditorView filename="AGENTS.md" />);
    await waitFor(() => expect(screen.getByText("draft")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "common.edit" }));
    fireEvent.input(screen.getByPlaceholderText("agents.files.editPlaceholder"), {
      target: { value: "draft saved by keyboard" },
    });

    fireEvent.keyDown(document, { key: "s", metaKey: true });

    await waitFor(() =>
      expect(sendCalls).toContainEqual({
        method: "agents.files.set",
        params: {
          agentId: "main",
          content: "draft saved by keyboard",
          name: "AGENTS.md",
        },
      }),
    );
  });
});

async function importView(): Promise<typeof import("../../../src/views/WorkspaceEditorView")> {
  // @ts-ignore Query suffix gives each test fresh module state.
  return import(`../../../src/views/WorkspaceEditorView.tsx?unit=${importCounter++}`);
}

function fileResult(overrides: Partial<WorkspaceFileResult["file"]> = {}): WorkspaceFileResult {
  const content = overrides.content ?? "content";
  return {
    agentId: "agent",
    workspace: "/repo",
    file: {
      content,
      missing: false,
      name: "AGENTS.md",
      path: "/repo/AGENTS.md",
      size: content.length,
      updatedAtMs: 1234,
      ...overrides,
    },
  };
}
