import { beforeAll, describe, expect, mock, test } from "bun:test";
import type { JsonSchema } from "../../../../src/types/config";

mock.module("@/lib/i18n", () => ({
  t: (key: string) => key,
}));

let navTree: typeof import("../../../../src/lib/config/nav-tree");

beforeAll(async () => {
  navTree = await import("../../../../src/lib/config/nav-tree");
});

describe("nav tree", () => {
  test("classifies nav-worthy sections and inline fields", () => {
    expect(navTree.isNavWorthy({ type: "object", properties: { only: { type: "string" } } })).toBe(
      false,
    );
    expect(
      navTree.isNavWorthy({
        type: "object",
        properties: { first: { type: "string" }, second: { type: "boolean" } },
      }),
    ).toBe(true);
    expect(
      navTree.isNavWorthy({
        type: "array",
        items: { type: "object", properties: { id: { type: "string" } } },
      }),
    ).toBe(true);
    expect(
      navTree.hasInlineFields({
        type: "object",
        properties: {
          gateway: {
            type: "object",
            properties: { enabled: { type: "boolean" }, url: { type: "string" } },
          },
          model: { type: "string" },
        },
      }),
    ).toBe(true);
  });

  test("buildNavTree orders top-level sections by hints and uses hint labels", () => {
    const schema = {
      type: "object",
      properties: {
        agents: { type: "object", title: "Agents", properties: {} },
        gateway: { type: "object", properties: {} },
        model: { type: "string" },
      },
    } satisfies JsonSchema;

    expect(
      navTree.buildNavTree(
        schema,
        {},
        {
          agents: { label: "AI Agents", order: 2 },
          gateway: { label: "Gateway", order: 1 },
          model: { label: "Default Model", order: 3 },
        },
      ),
    ).toMatchObject([
      { key: "gateway", label: "Gateway", path: ["gateway"] },
      { key: "agents", label: "AI Agents", path: ["agents"] },
      { key: "model", label: "Default Model", path: ["model"] },
    ]);
  });

  test("buildNavTree includes top-level primitives and single-field objects", () => {
    const schema = {
      type: "object",
      properties: {
        model: { type: "string" },
        singleField: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
          },
        },
      },
    } satisfies JsonSchema;

    expect(navTree.buildNavTree(schema, {}, {}).map((item) => item.key)).toEqual([
      "model",
      "singleField",
    ]);
  });

  test("buildNavTree filters nested inline fields but keeps nav-worthy children", () => {
    const schema = {
      type: "object",
      properties: {
        gateway: {
          type: "object",
          properties: {
            controlUi: {
              type: "object",
              properties: {
                enabled: { type: "boolean" },
                port: { type: "integer" },
              },
            },
            url: { type: "string" },
          },
        },
      },
    } satisfies JsonSchema;

    expect(navTree.buildNavTree(schema, {}, {})).toMatchObject([
      {
        key: "gateway",
        children: [
          {
            key: "controlUi",
            label: "Control UI",
            path: ["gateway", "controlUi"],
          },
        ],
      },
    ]);
  });

  test("buildNavTree creates array item children with identity labels and numeric paths", () => {
    const schema = {
      type: "object",
      properties: {
        agents: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              identity: { type: "object" },
            },
          },
        },
      },
    } satisfies JsonSchema;

    expect(
      navTree.buildNavTree(
        schema,
        {
          agents: [{ id: "main", identity: { emoji: "M" } }, { name: "assistant" }, {}],
        },
        {},
      ),
    ).toMatchObject([
      {
        key: "agents",
        children: [
          { key: "0", label: "M main", path: ["agents", 0] },
          { key: "1", label: "assistant", path: ["agents", 1] },
          { key: "2", label: "#3", path: ["agents", 2] },
        ],
      },
    ]);
  });
});
