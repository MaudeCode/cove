import { describe, expect, test } from "bun:test";
import {
  applyGatewayConfigWithSend,
  buildAgentSkillsConfig,
  buildAgentToolsConfig,
  buildConfigApplyParams,
  normalizeGatewayConfig,
} from "../../../src/views/agents/agents-config-utils";
import type { ConfigApplySender } from "../../../src/views/agents/agents-config-utils";
import type { GatewayConfig } from "../../../src/views/agents/agents-tools-state";

describe("agent config helpers", () => {
  test("normalizeGatewayConfig normalizes default and agent tool profiles", () => {
    expect(
      normalizeGatewayConfig({
        tools: { profile: "unknown" },
        agents: {
          list: [{ id: "agent-1", tools: { profile: "coding" } }],
        },
      } as unknown as GatewayConfig),
    ).toEqual({
      tools: { profile: "full" },
      agents: {
        list: [{ id: "agent-1", tools: { profile: "coding" } }],
      },
    });
  });

  test("buildConfigApplyParams serializes raw config with baseHash", () => {
    expect(buildConfigApplyParams({ agents: { list: [{ id: "agent-1" }] } }, "hash-1")).toEqual({
      raw: JSON.stringify({ agents: { list: [{ id: "agent-1" }] } }),
      baseHash: "hash-1",
    });
  });

  test("applyGatewayConfigWithSend sends raw config with the current baseHash", async () => {
    const sendCalls: Array<{ method: string; params: unknown }> = [];
    const send = (async (method: string, params: unknown) => {
      sendCalls.push({ method, params });
      if (method === "config.get") {
        return {
          config: { tools: { profile: "coding" } },
          exists: true,
          hash: "hash-2",
          raw: JSON.stringify({ tools: { profile: "coding" } }),
          valid: true,
        };
      }
      return {};
    }) as ConfigApplySender;
    const config: GatewayConfig = { agents: { list: [{ id: "agent-1" }] } };

    const refreshed = await applyGatewayConfigWithSend(config, "hash-1", send);

    expect(sendCalls).toEqual([
      {
        method: "config.apply",
        params: {
          raw: JSON.stringify(config),
          baseHash: "hash-1",
        },
      },
      {
        method: "config.get",
        params: {},
      },
    ]);
    expect(refreshed).toEqual({
      config: { tools: { profile: "coding" } },
      hash: "hash-2",
    });
  });

  test("buildAgentToolsConfig updates existing agents and preserves unrelated config", () => {
    expect(
      buildAgentToolsConfig(
        {
          tools: { profile: "full" },
          agents: {
            list: [
              {
                id: "agent-1",
                model: { primary: "agent-model", fallbacks: ["fallback-model"] },
                skills: ["existing-skill"],
                tools: { profile: "minimal" },
              },
              { id: "other-agent" },
            ],
          },
        },
        "agent-1",
        {
          profile: "coding",
          alsoAllow: ["web_search"],
          deny: ["exec"],
        },
      ),
    ).toEqual({
      tools: { profile: "full" },
      agents: {
        list: [
          {
            id: "agent-1",
            model: { primary: "agent-model", fallbacks: ["fallback-model"] },
            skills: ["existing-skill"],
            tools: {
              profile: "coding",
              alsoAllow: ["web_search"],
              deny: ["exec"],
            },
          },
          { id: "other-agent" },
        ],
      },
    });
  });

  test("buildAgentToolsConfig appends missing agent entries by id", () => {
    expect(
      buildAgentToolsConfig(
        {
          agents: {
            list: [{ id: "other-agent" }],
          },
        },
        "agent-1",
        { profile: "minimal" },
      ),
    ).toEqual({
      agents: {
        list: [{ id: "other-agent" }, { id: "agent-1", tools: { profile: "minimal" } }],
      },
    });
  });

  test("buildAgentSkillsConfig deletes inherited skills instead of writing null", () => {
    expect(
      buildAgentSkillsConfig(
        {
          agents: {
            list: [
              {
                id: "agent-1",
                model: "agent-model",
                skills: ["old-skill"],
                tools: { profile: "coding" },
              },
              { id: "other-agent" },
            ],
          },
        },
        "agent-1",
        null,
      ),
    ).toEqual({
      agents: {
        list: [
          { id: "agent-1", model: "agent-model", tools: { profile: "coding" } },
          { id: "other-agent" },
        ],
      },
    });
  });

  test("buildAgentSkillsConfig appends missing agent entries by id", () => {
    expect(
      buildAgentSkillsConfig(
        {
          agents: {
            list: [{ id: "other-agent" }],
          },
        },
        "agent-1",
        ["new-skill"],
      ),
    ).toEqual({
      agents: {
        list: [{ id: "other-agent" }, { id: "agent-1", skills: ["new-skill"] }],
      },
    });
  });
});
