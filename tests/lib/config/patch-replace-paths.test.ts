import { describe, expect, test } from "bun:test";
import { getConfigPatchReplacePaths } from "../../../src/lib/config/patch-replace-paths";

describe("getConfigPatchReplacePaths", () => {
  test("does not require replacePaths for additive non-id array edits", () => {
    expect(
      getConfigPatchReplacePaths({
        original: { allowedTools: ["read"] },
        patch: { allowedTools: ["read", "write"] },
        draft: { allowedTools: ["read", "write"] },
      }),
    ).toEqual([]);
  });

  test("marks non-id array removals as intentional replacements", () => {
    expect(
      getConfigPatchReplacePaths({
        original: { allowedTools: ["read", "write"] },
        patch: { allowedTools: ["read"] },
        draft: { allowedTools: ["read"] },
      }),
    ).toEqual(["allowedTools"]);
  });

  test("marks array deletion as an intentional replacement", () => {
    expect(
      getConfigPatchReplacePaths({
        original: { tools: { allow: ["read"] } },
        patch: { tools: { allow: null } },
        draft: { tools: {} },
      }),
    ).toEqual(["tools.allow"]);
  });

  test("marks arrays nested inside replaced objects", () => {
    expect(
      getConfigPatchReplacePaths({
        original: {
          tools: {
            profile: "custom",
            allow: ["read"],
            deny: ["write"],
          },
        },
        patch: { tools: "full" },
        draft: { tools: "full" },
      }),
    ).toEqual(["tools.allow", "tools.deny"]);
  });

  test("marks id-keyed array entry removals at the array path", () => {
    expect(
      getConfigPatchReplacePaths({
        original: {
          agents: {
            list: [{ id: "main" }, { id: "builder" }],
          },
        },
        patch: {
          agents: {
            list: [{ id: "main" }],
          },
        },
        draft: {
          agents: {
            list: [{ id: "main" }],
          },
        },
      }),
    ).toEqual(["agents.list"]);
  });

  test("marks destructive nested array edits inside id-keyed entries", () => {
    expect(
      getConfigPatchReplacePaths({
        original: {
          agents: {
            list: [{ id: "main", skills: ["code", "review"] }],
          },
        },
        patch: {
          agents: {
            list: [{ id: "main", skills: ["code"] }],
          },
        },
        draft: {
          agents: {
            list: [{ id: "main", skills: ["code"] }],
          },
        },
      }),
    ).toEqual(["agents.list[].skills"]);
  });

  test("does not mark non-destructive scalar edits inside id-keyed entries", () => {
    expect(
      getConfigPatchReplacePaths({
        original: {
          agents: {
            list: [{ id: "main", model: "a", skills: ["code"] }],
          },
        },
        patch: {
          agents: {
            list: [{ id: "main", model: "b" }],
          },
        },
        draft: {
          agents: {
            list: [{ id: "main", model: "b", skills: ["code"] }],
          },
        },
      }),
    ).toEqual([]);
  });
});
