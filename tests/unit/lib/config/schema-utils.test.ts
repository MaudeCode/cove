import { beforeAll, describe, expect, test } from "bun:test";
import { installI18nMock } from "../../../helpers/i18n";
import type { JsonSchema } from "../../../../src/types/config";

installI18nMock();

let schemaUtils: typeof import("../../../../src/lib/config/schema-utils");

beforeAll(async () => {
  schemaUtils = await import("../../../../src/lib/config/schema-utils");
});

describe("schema utils", () => {
  test("setValueAtPath immutably writes nested object values", () => {
    const original = {
      gateway: {
        url: "ws://old",
      },
      unchanged: true,
    };

    const next = schemaUtils.setValueAtPath(original, ["gateway", "url"], "ws://new");

    expect(next).toEqual({
      gateway: {
        url: "ws://new",
      },
      unchanged: true,
    });
    expect(original).toEqual({
      gateway: {
        url: "ws://old",
      },
      unchanged: true,
    });
    expect(next).not.toBe(original);
    expect(next.gateway).not.toBe(original.gateway);
  });

  test("setValueAtPath creates arrays for numeric path segments", () => {
    expect(schemaUtils.setValueAtPath({}, ["agents", 0, "id"], "main")).toEqual({
      agents: [{ id: "main" }],
    });
  });

  test("setValueAtPath deletes keys when value is undefined", () => {
    expect(
      schemaUtils.setValueAtPath(
        {
          agents: {
            main: {
              model: "claude",
              temperature: 0.2,
            },
          },
        },
        ["agents", "main", "temperature"],
        undefined,
      ),
    ).toEqual({
      agents: {
        main: {
          model: "claude",
        },
      },
    });
  });

  test("getValueAtPath follows numeric array indexes", () => {
    expect(
      schemaUtils.getValueAtPath(
        {
          agents: [{ id: "main" }, { id: "coder" }],
        },
        ["agents", 1, "id"],
      ),
    ).toBe("coder");
  });

  test("getSchemaAtPath resolves numeric indexes to array item schemas", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        agents: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
            },
          },
        },
      },
    };

    expect(schemaUtils.getSchemaAtPath(schema, ["agents", 0, "id"])).toEqual({ type: "string" });
  });

  test("hintForPath checks exact hints before wildcard hints", () => {
    expect(
      schemaUtils.hintForPath(["agents", "list", 2, "tools"], {
        "agents.list.*.tools": { label: "Wildcard tools" },
        "agents.list.2.tools": { label: "Exact tools" },
      }),
    ).toEqual({ label: "Exact tools" });

    expect(
      schemaUtils.hintForPath(["agents", "list", 3, "tools"], {
        "agents.list.*.tools": { label: "Wildcard tools" },
      }),
    ).toEqual({ label: "Wildcard tools" });
    expect(
      schemaUtils.hintForPath(["agents", "list", 4, "tools"], {
        "agents.list[].tools": { label: "Array wildcard tools" },
      }),
    ).toEqual({ label: "Array wildcard tools" });
  });

  test("schemaDefault derives sensible defaults", () => {
    expect(schemaUtils.schemaDefault({ const: "fixed" })).toBe("fixed");
    expect(schemaUtils.schemaDefault({ default: 12 })).toBe(12);
    expect(schemaUtils.schemaDefault({ type: "boolean" })).toBe(false);
    expect(schemaUtils.schemaDefault({ type: "integer" })).toBe(0);
    expect(schemaUtils.schemaDefault({ type: "array" })).toEqual([]);
    expect(schemaUtils.schemaDefault({ type: "object" })).toEqual({});
  });

  test("schemaType resolves nullable and enum schemas", () => {
    expect(schemaUtils.schemaType({ type: ["null", "string"] })).toBe("string");
    expect(schemaUtils.schemaType({ enum: ["one", "two"] })).toBe("string");
  });

  test("validateValue checks enum and integer constraints", () => {
    expect(schemaUtils.validateValue("three", { enum: ["one", "two"] })).toBe(
      "config.validation.invalidOption",
    );
    expect(schemaUtils.validateValue(1.5, { type: "integer" })).toBe(
      "config.validation.mustBeInteger",
    );
    expect(schemaUtils.validateValue(Infinity, { type: "number" })).toBe(
      "config.validation.mustBeNumber",
    );
    expect(schemaUtils.validateValue(2, { maximum: 3, minimum: 1, type: "integer" })).toBeNull();
  });
});
