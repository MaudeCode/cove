/** @jsxImportSource preact */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { signal } from "@preact/signals";
import {
  cleanupDom,
  fireEvent,
  renderComponent,
  screen,
  userEvent,
  waitFor,
  within,
} from "../../../helpers/dom";
import { installConfigComponentAliases } from "../../../helpers/module-aliases";
import type { ConfigUiHints, JsonSchema } from "../../../../src/types/config";

type UpdateCall = {
  path: (string | number)[];
  value: unknown;
};

type ValidationCall = {
  message: string | null;
  path: string;
};

const updateFieldCalls: UpdateCall[] = [];
const validationCalls: ValidationCall[] = [];
const validationErrors = signal<Record<string, string>>({});
const draftRevision = signal(0);
let applyArrayUpdate: ((call: UpdateCall) => void) | null = null;

mock.module("@/signals/config", () => ({
  updateField: (path: (string | number)[], value: unknown) => {
    const call = { path, value };
    updateFieldCalls.push(call);
    applyArrayUpdate?.(call);
  },
  setValidationError: (path: string, message: string | null) => {
    validationCalls.push({ path, message });
    const next = { ...validationErrors.value };
    if (message) {
      next[path] = message;
    } else {
      delete next[path];
    }
    validationErrors.value = next;
  },
  draftRevision,
  validationErrors,
}));

mock.module("@/lib/i18n", () => ({
  t: (key: string) => key,
}));

await installConfigComponentAliases();

const { ConfigNode } = await import("../../../../src/components/config/ConfigNode");
const { JsonEditor, PasswordInput } =
  await import("../../../../src/components/config/ConfigFieldHelpers");
const { UnionNode } = await import("../../../../src/components/config/ConfigUnionNode");
const { ArrayNode } = await import("../../../../src/components/config/ConfigArrayNode");
const { MobileConfigHeader } = await import("../../../../src/components/config/MobileConfigHeader");

describe("config component fields", () => {
  beforeEach(() => {
    updateFieldCalls.length = 0;
    validationCalls.length = 0;
    validationErrors.value = {};
    draftRevision.value = 0;
    applyArrayUpdate = null;
  });

  test("ConfigNode sends primitive updateField calls and converts numeric input", async () => {
    renderComponent(
      <ConfigNode
        schema={{ type: "boolean", title: "Enabled" }}
        value={false}
        path={["gateway", "enabled"]}
        hints={{}}
      />,
    );

    await userEvent.click(screen.getByRole("switch"));
    expect(updateFieldCalls).toEqual([{ path: ["gateway", "enabled"], value: true }]);

    renderComponent(
      <ConfigNode
        schema={{ maximum: 2, minimum: 0, type: "number", title: "Temperature" }}
        value={0.5}
        path={["model", "temperature"]}
        hints={{}}
      />,
    );

    const numberInput = screen.getByDisplayValue("0.5");
    fireEvent.input(numberInput, { target: { value: "1.25" } });
    fireEvent.input(numberInput, { target: { value: "" } });

    expect(updateFieldCalls.slice(1)).toEqual([
      { path: ["model", "temperature"], value: 1.25 },
      { path: ["model", "temperature"], value: undefined },
    ]);
    expect(validationCalls.slice(-2)).toEqual([
      { path: "model.temperature", message: null },
      { path: "model.temperature", message: null },
    ]);
  });

  test("ConfigNode rejects non-finite numeric input before updating config", () => {
    renderComponent(
      <ConfigNode
        schema={{ type: "number", title: "Temperature" }}
        value={0.5}
        path={["model", "temperature"]}
        hints={{}}
      />,
    );

    const numberInput = screen.getByDisplayValue("0.5");
    fireEvent.input(numberInput, { target: { value: "1e9999" } });

    expect(numberInput).toHaveProperty("value", "1e9999");
    expect(updateFieldCalls).toEqual([]);
    expect(validationCalls).toEqual([
      { path: "model.temperature", message: "config.validation.mustBeNumber" },
    ]);
  });

  test("ConfigNode resets invalid numeric drafts when the config draft is replaced", async () => {
    renderComponent(
      <ConfigNode
        schema={{ type: "number", title: "Temperature" }}
        value={0.5}
        path={["model", "temperature"]}
        hints={{}}
      />,
    );

    const numberInput = screen.getByDisplayValue("0.5");
    fireEvent.input(numberInput, { target: { value: "1e9999" } });
    expect(numberInput).toHaveProperty("value", "1e9999");

    draftRevision.value += 1;

    await waitFor(() => expect(numberInput).toHaveProperty("value", "0.5"));
  });

  test("ConfigNode renders enum choices and reports selected values", async () => {
    renderComponent(
      <ConfigNode
        schema={{ enum: ["auto", "manual"], title: "Mode" }}
        value="auto"
        path={["mode"]}
        hints={{}}
      />,
    );

    await chooseDropdownOption("Auto", "Manual");

    expect(updateFieldCalls).toEqual([{ path: ["mode"], value: "manual" }]);
  });

  test("PasswordInput hides and reveals sensitive values while preserving updates", async () => {
    const changes: string[] = [];

    renderComponent(
      <PasswordInput
        value="secret-token"
        placeholder="token"
        onChange={(value) => changes.push(value)}
        wide
      />,
    );

    const input = screen.getByDisplayValue("secret-token") as HTMLInputElement;
    expect(input.type).toBe("password");

    await userEvent.click(screen.getByRole("button", { name: "config.field.showPassword" }));
    expect(input.type).toBe("text");

    fireEvent.input(input, { target: { value: "new-token" } });
    await userEvent.click(screen.getByRole("button", { name: "config.field.hidePassword" }));

    expect(input.type).toBe("password");
    expect(changes).toEqual(["new-token"]);
  });

  test("JsonEditor only commits valid JSON on blur", async () => {
    const changes: unknown[] = [];

    renderComponent(
      <JsonEditor value={{ enabled: true }} onChange={(value) => changes.push(value)} />,
    );

    const editor = screen.getByRole("textbox");
    editor.focus();
    fireEvent.input(editor, { target: { value: "{bad json" } });
    await waitFor(() => expect(editor).toHaveProperty("value", "{bad json"));
    fireEvent.focusOut(editor);

    await waitFor(() => expect(screen.getByText("config.field.invalidJson")).toBeTruthy());
    expect(changes).toEqual([]);

    fireEvent.input(editor, { target: { value: '{"enabled":false,"limit":3}' } });
    await waitFor(() => expect(editor).toHaveProperty("value", '{"enabled":false,"limit":3}'));
    editor.focus();
    fireEvent.focusOut(editor);

    await waitFor(() => expect(screen.queryByText("config.field.invalidJson")).toBeNull());
    expect(changes).toEqual([{ enabled: false, limit: 3 }]);
  });

  test("UnionNode converts literal variants through dropdown selections", async () => {
    renderComponent(
      <UnionNode
        schema={{
          oneOf: [
            { const: "manual", title: "Manual" },
            { const: "auto", title: "Auto" },
          ],
        }}
        value="manual"
        path={["startup", "mode"]}
        hints={{}}
        level={0}
        label="Startup mode"
        showLabel
      />,
    );

    await chooseDropdownOption("Manual", "Auto");

    expect(updateFieldCalls).toEqual([{ path: ["startup", "mode"], value: "auto" }]);
  });

  test("UnionNode preserves numeric and boolean literal types", async () => {
    renderComponent(
      <UnionNode
        schema={{
          oneOf: [
            { const: 1, title: "One" },
            { const: 2, title: "Two" },
          ],
        }}
        value={1}
        path={["retry", "count"]}
        hints={{}}
        level={0}
        label="Retry count"
        showLabel
      />,
    );

    await chooseDropdownOption("One", "Two");

    renderComponent(
      <UnionNode
        schema={{
          anyOf: [
            { const: false, title: "Disabled" },
            { const: true, title: "Enabled" },
          ],
        }}
        value={false}
        path={["features", "enabled"]}
        hints={{}}
        level={0}
        label="Feature"
        showLabel
      />,
    );

    await chooseDropdownOption("Disabled", "Enabled");

    expect(updateFieldCalls).toEqual([
      { path: ["retry", "count"], value: 2 },
      { path: ["features", "enabled"], value: true },
    ]);
  });
});

describe("config view controls", () => {
  test("MobileConfigHeader allows reset but disables save for validation-only errors", () => {
    const selectedPath = signal<(string | number)[]>([]);
    const resets: string[] = [];
    const saves: string[] = [];

    renderComponent(
      <MobileConfigHeader
        selectedPath={selectedPath}
        uiHints={signal({})}
        isDirty
        canSave={false}
        isSaving={false}
        onReset={() => resets.push("reset")}
        onSave={() => saves.push("save")}
      />,
    );

    const resetButton = screen.getByRole("button", { name: "config.reset" });
    const saveButton = screen.getByRole("button", { name: "config.save" });

    expect(resetButton).not.toHaveProperty("disabled", true);
    expect(saveButton).toHaveProperty("disabled", true);

    fireEvent.click(resetButton);

    expect(resets).toEqual(["reset"]);
    expect(saves).toEqual([]);
  });
});

describe("config array components", () => {
  beforeEach(() => {
    updateFieldCalls.length = 0;
    validationCalls.length = 0;
    validationErrors.value = {};
    draftRevision.value = 0;
    applyArrayUpdate = null;
  });

  test("ArrayNode adds, edits, removes, and mobile-reorders primitive arrays", async () => {
    let value = [1, 2];
    renderStatefulArrayNode({
      schema: { items: { type: "number" }, type: "array" },
      getValue: () => value,
      setValue: (next) => {
        value = next as number[];
      },
      path: ["ports"],
      label: "Ports",
    });

    await userEvent.click(screen.getByRole("button", { name: "config.field.addItem" }));
    fireEvent.input(screen.getByDisplayValue("1"), { target: { value: "10" } });
    await userEvent.click(screen.getAllByRole("button", { name: "config.field.moveDown" })[0]);
    await userEvent.click(screen.getAllByRole("button", { name: "config.field.removeItem" })[1]);

    expect(updateFieldCalls).toEqual([
      { path: ["ports"], value: [1, 2, 0] },
      { path: ["ports"], value: [10, 2, 0] },
      { path: ["ports"], value: [2, 10, 0] },
      { path: ["ports"], value: [2, 0] },
    ]);
    expect(value).toEqual([2, 0]);
  });

  test("ArrayNode treats integer arrays as validated numeric primitive arrays", async () => {
    renderArrayNode({
      schema: { items: { type: "integer" }, type: "array" },
      value: [1, 2],
      path: ["ports"],
      label: "Ports",
    });

    const numberInput = screen.getByDisplayValue("1");
    fireEvent.input(numberInput, { target: { value: "3" } });
    fireEvent.input(numberInput, { target: { value: "" } });
    fireEvent.input(numberInput, { target: { value: "1.5" } });

    expect(screen.getByText("config.validation.mustBeInteger")).toBeTruthy();

    await userEvent.click(screen.getAllByRole("button", { name: "config.field.removeItem" })[0]);

    expect(updateFieldCalls).toEqual([
      { path: ["ports"], value: [3, 2] },
      { path: ["ports"], value: [2] },
    ]);
    expect(validationCalls).toEqual([
      { path: "ports.0", message: null },
      { path: "ports.0", message: "config.validation.mustBeNumber" },
      { path: "ports.0", message: "config.validation.mustBeInteger" },
      { path: "ports.0", message: null },
    ]);
  });

  test("ArrayNode keeps invalid numeric drafts visible without committing them", () => {
    renderArrayNode({
      schema: { items: { type: "number" }, type: "array" },
      value: [1, 2],
      path: ["ports"],
      label: "Ports",
    });

    const numberInput = screen.getByDisplayValue("1");
    fireEvent.input(numberInput, { target: { value: "Infinity" } });

    expect(numberInput).toHaveProperty("value", "Infinity");
    expect(screen.getByText("config.validation.mustBeNumber")).toBeTruthy();
    expect(updateFieldCalls).toEqual([]);
    expect(validationCalls).toEqual([
      { path: "ports.0", message: "config.validation.mustBeNumber" },
    ]);
  });

  test("ArrayNode namespaces primitive input error ids across repeated render surfaces", () => {
    const schema = { items: { type: "number" }, type: "array" } satisfies JsonSchema;
    validationErrors.value = {
      "ports.0": "config.validation.mustBeNumber",
    };

    renderComponent(
      <div>
        <ArrayNode
          schema={schema}
          value={[1]}
          path={["ports"]}
          hints={{}}
          level={0}
          label="Ports"
        />
        <ArrayNode
          schema={schema}
          value={[1]}
          path={["ports"]}
          hints={{}}
          level={0}
          label="Ports"
        />
      </div>,
    );

    const inputs = screen.getAllByRole("spinbutton") as HTMLElement[];
    const ids = inputs.map((input) => input.getAttribute("id"));
    const describedByIds = inputs.map((input) => input.getAttribute("aria-describedby"));
    const inputIds = ids.filter((id): id is string => Boolean(id));
    const descriptionIds = describedByIds.filter((id): id is string => Boolean(id));

    expect(inputIds).toHaveLength(2);
    expect(new Set(inputIds).size).toBe(2);
    expect(descriptionIds).toEqual(inputIds.map((id) => `${id}-error`));
    for (const describedById of descriptionIds) {
      expect(document.querySelector(`[id="${describedById}"]`)?.textContent).toBe(
        "config.validation.mustBeNumber",
      );
    }
  });

  test("ArrayNode resets invalid primitive drafts when the config draft is replaced", async () => {
    const schema = { items: { type: "number" }, type: "array" } satisfies JsonSchema;
    const value = [1, 2];
    const rendered = renderComponent(
      <ArrayNode
        schema={schema}
        value={value}
        path={["ports"]}
        hints={{}}
        level={0}
        label="Ports"
      />,
    );

    const numberInput = screen.getByDisplayValue("1");
    fireEvent.input(numberInput, { target: { value: "Infinity" } });
    expect(numberInput).toHaveProperty("value", "Infinity");

    draftRevision.value += 1;
    rendered.rerender(
      <ArrayNode
        schema={schema}
        value={value}
        path={["ports"]}
        hints={{}}
        level={0}
        label="Ports"
      />,
    );

    await waitFor(() => expect(screen.getByDisplayValue("1")).toBeTruthy());
  });

  test("ArrayNode moves invalid numeric drafts with duplicate primitive rows", async () => {
    renderArrayNode({
      schema: { items: { type: "number" }, type: "array" },
      value: [1, 1, 2],
      path: ["ports"],
      label: "Ports",
    });

    const firstInput = screen.getAllByRole("spinbutton")[0];
    fireEvent.input(firstInput, { target: { value: "Infinity" } });

    await userEvent.click(screen.getAllByRole("button", { name: "config.field.moveDown" })[0]);

    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs[0]).toHaveProperty("value", "1");
    expect(inputs[1]).toHaveProperty("value", "Infinity");
    expect(validationErrors.value).toEqual({
      "ports.1": "config.validation.mustBeNumber",
    });
    expect(updateFieldCalls).toEqual([{ path: ["ports"], value: [1, 1, 2] }]);
  });

  test("ArrayNode removes and reindexes array item validation errors on structural edits", async () => {
    validationErrors.value = {
      "ports.0": "first invalid",
      "ports.1": "second invalid",
      "ports.1.name": "nested invalid",
    };
    renderArrayNode({
      schema: { items: { type: "integer" }, type: "array" },
      value: [1, 2, 3],
      path: ["ports"],
      label: "Ports",
    });

    await userEvent.click(screen.getAllByRole("button", { name: "config.field.removeItem" })[0]);

    expect(validationErrors.value).toEqual({
      "ports.0": "second invalid",
      "ports.0.name": "nested invalid",
    });

    cleanupDom();
    validationErrors.value = {
      "ports.0": "first invalid",
      "ports.1": "second invalid",
      "ports.2": "third invalid",
    };
    renderArrayNode({
      schema: { items: { type: "integer" }, type: "array" },
      value: [1, 2, 3],
      path: ["ports"],
      label: "Ports",
    });

    await userEvent.click(screen.getAllByRole("button", { name: "config.field.moveDown" })[0]);

    expect(validationErrors.value).toEqual({
      "ports.1": "first invalid",
      "ports.0": "second invalid",
      "ports.2": "third invalid",
    });

    cleanupDom();
    validationErrors.value = {
      "ports.0": "first invalid",
      "ports.1": "second invalid",
      "ports.2": "third invalid",
    };
    renderArrayNode({
      schema: { items: { type: "integer" }, type: "array" },
      value: [1, 2, 3],
      path: ["ports"],
      label: "Ports",
    });

    await userEvent.click(screen.getAllByRole("button", { name: "config.field.moveUp" })[2]);

    expect(validationErrors.value).toEqual({
      "ports.0": "first invalid",
      "ports.1": "third invalid",
      "ports.2": "second invalid",
    });
  });

  test("ArrayNode adds, removes, and mobile-reorders object arrays", async () => {
    let value: { id?: string }[] = [{ id: "alpha" }, { id: "beta" }];
    renderStatefulArrayNode({
      schema: objectArraySchema,
      getValue: () => value,
      setValue: (next) => {
        value = next as { id?: string }[];
      },
      path: ["servers"],
      label: "Servers",
    });

    await userEvent.click(screen.getByRole("button", { name: "config.field.addItem" }));
    await userEvent.click(screen.getAllByRole("button", { name: "config.field.moveDown" })[0]);
    await userEvent.click(screen.getAllByRole("button", { name: "config.field.removeItem" })[1]);

    expect(updateFieldCalls).toEqual([
      { path: ["servers"], value: [{ id: "alpha" }, { id: "beta" }, {}] },
      { path: ["servers"], value: [{ id: "beta" }, { id: "alpha" }, {}] },
      { path: ["servers"], value: [{ id: "beta" }, {}] },
    ]);
    expect(value).toEqual([{ id: "beta" }, {}]);
  });

  test("ArrayNode moves invalid object-row numeric drafts with duplicate values", async () => {
    let value = [
      { id: "same", label: "alpha", limit: 1 },
      { id: "same", label: "beta", limit: 1 },
    ];
    renderStatefulArrayNode({
      schema: objectArraySchema,
      getValue: () => value,
      setValue: (next) => {
        value = next as { id: string; label: string; limit: number }[];
      },
      path: ["servers"],
      label: "Servers",
    });

    let cards = getDraggableCards();
    fireEvent.click(within(cards[0]).getByRole("button", { name: "same" }));
    const alphaLimitInput = within(cards[0]).getAllByRole("spinbutton")[0];
    fireEvent.input(alphaLimitInput, { target: { value: "Infinity" } });

    await userEvent.click(screen.getAllByRole("button", { name: "config.field.moveDown" })[0]);
    cards = getDraggableCards();
    fireEvent.click(within(cards[0]).getByRole("button", { name: "same" }));

    expect(within(cards[0]).getAllByRole("spinbutton")[0]).toHaveProperty("value", "1");
    expect(within(cards[1]).getAllByRole("spinbutton")[0]).toHaveProperty("value", "Infinity");
    expect(validationErrors.value).toEqual({
      "servers.1.limit": "config.validation.mustBeNumber",
    });
    expect(updateFieldCalls).toEqual([
      {
        path: ["servers"],
        value: [
          { id: "same", label: "beta", limit: 1 },
          { id: "same", label: "alpha", limit: 1 },
        ],
      },
    ]);
  });

  test("ArrayNode drag/drop reorders only within the same parent path", () => {
    renderArrayNode({
      schema: objectArraySchema,
      value: [{ id: "alpha" }, { id: "beta" }],
      path: ["servers"],
      label: "Servers",
    });

    const alphaCard = getCardForText("alpha");
    const betaCard = getCardForText("beta");
    const sameParentTransfer = createDataTransfer();

    fireEvent.dragStart(alphaCard, { dataTransfer: sameParentTransfer });
    fireEvent.drop(betaCard, { dataTransfer: sameParentTransfer });
    fireEvent.drop(betaCard, {
      dataTransfer: createDataTransfer(JSON.stringify({ path: "other", index: 0 })),
    });

    expect(updateFieldCalls).toEqual([
      { path: ["servers"], value: [{ id: "beta" }, { id: "alpha" }] },
    ]);
  });
});

const objectArraySchema = {
  items: {
    properties: {
      id: { type: "string" },
      limit: { type: "number" },
    },
    type: "object",
  },
  type: "array",
} satisfies JsonSchema;

function renderArrayNode({
  schema,
  value,
  path,
  label,
  hints = {},
}: {
  schema: JsonSchema;
  value: unknown[];
  path: (string | number)[];
  label: string;
  hints?: ConfigUiHints;
}) {
  renderComponent(
    <ArrayNode schema={schema} value={value} path={path} hints={hints} level={0} label={label} />,
  );
}

function renderStatefulArrayNode({
  schema,
  getValue,
  setValue,
  path,
  label,
  hints = {},
}: {
  schema: JsonSchema;
  getValue: () => unknown[];
  setValue: (value: unknown[]) => void;
  path: (string | number)[];
  label: string;
  hints?: ConfigUiHints;
}) {
  const rendered = renderComponent(
    <ArrayNode
      schema={schema}
      value={getValue()}
      path={path}
      hints={hints}
      level={0}
      label={label}
    />,
  );
  applyArrayUpdate = (call) => {
    if (call.path.join(".") === path.join(".")) {
      setValue(call.value as unknown[]);
      rendered.rerender(
        <ArrayNode
          schema={schema}
          value={getValue()}
          path={path}
          hints={hints}
          level={0}
          label={label}
        />,
      );
    }
  };
}

async function chooseDropdownOption(currentLabel: string, nextLabel: string): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: currentLabel }));
  await userEvent.click(
    within(screen.getByRole("listbox")).getByRole("option", { name: nextLabel }),
  );
}

function getCardForText(text: string): HTMLElement {
  const card = screen.getByText(text).closest("[draggable]");
  if (!(card instanceof HTMLElement)) {
    throw new Error(`Could not find draggable card for ${text}`);
  }
  return card;
}

function getDraggableCards(): HTMLElement[] {
  return Array.from(document.querySelectorAll("[draggable]")).filter(
    (card): card is HTMLElement => card instanceof HTMLElement,
  );
}

function createDataTransfer(initialData = ""): DataTransfer {
  let data = initialData;
  return {
    dropEffect: "none",
    effectAllowed: "all",
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    types: [],
    clearData: () => {
      data = "";
    },
    getData: () => data,
    setData: (_format: string, value: string) => {
      data = value;
    },
    setDragImage: () => undefined,
  };
}
