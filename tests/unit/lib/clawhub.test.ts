import { afterEach, beforeEach, describe, expect, test } from "bun:test";

const originalFetch = globalThis.fetch;
const fetchCalls: string[] = [];
const fetchResponses: Response[] = [];

beforeEach(() => {
  fetchCalls.length = 0;
  fetchResponses.length = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    fetchCalls.push(String(input));
    const response = fetchResponses.shift();
    if (!response) throw new Error("Unexpected fetch");
    return response;
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("ClawHub client", () => {
  test("lists skills with encoded query params and throws non-OK responses", async () => {
    const { listSkills } = await import("../../../src/lib/clawhub");
    fetchResponses.push(jsonResponse({ items: [], nextCursor: "next" }));

    await expect(
      listSkills({ limit: 10, cursor: "after/one", sort: "downloads" }),
    ).resolves.toEqual({
      items: [],
      nextCursor: "next",
    });
    expect(fetchCalls[0]).toBe(
      "https://clawhub.ai/api/v1/skills?limit=10&cursor=after%2Fone&sort=downloads",
    );

    fetchResponses.push(new Response("nope", { status: 500 }));

    await expect(listSkills()).rejects.toThrow("ClawHub API error: 500");
  });

  test("searches skills, encodes query text, and normalizes result shape", async () => {
    const { searchSkills } = await import("../../../src/lib/clawhub");
    fetchResponses.push(
      jsonResponse({
        results: [
          {
            score: 0.9,
            slug: "owner/cool-skill",
            displayName: "Cool Skill",
            summary: "Does things",
            version: "1.2.3",
            updatedAt: 123,
          },
        ],
      }),
    );

    await expect(searchSkills("cool skill", { limit: 5 })).resolves.toEqual({
      items: [
        {
          slug: "owner/cool-skill",
          displayName: "Cool Skill",
          summary: "Does things",
          tags: { latest: "1.2.3" },
          stats: { comments: 0, downloads: 0, stars: 0, versions: 0 },
          createdAt: 123,
          updatedAt: 123,
          latestVersion: {
            version: "1.2.3",
            createdAt: 123,
            changelog: "",
          },
        },
      ],
    });
    expect(fetchCalls[0]).toBe("https://clawhub.ai/api/v1/search?q=cool+skill&limit=5");

    fetchResponses.push(jsonResponse({}));

    await expect(searchSkills("missing results")).resolves.toEqual({ items: [] });
  });

  test("returns null for missing skills, encodes slugs, and merges detail response sections", async () => {
    const { getSkill } = await import("../../../src/lib/clawhub");
    fetchResponses.push(new Response("missing", { status: 404 }));

    await expect(getSkill("owner/skill name")).resolves.toBeNull();
    expect(fetchCalls[0]).toBe("https://clawhub.ai/api/v1/skills/owner%2Fskill%20name");

    fetchResponses.push(
      jsonResponse({
        skill: baseSkill({ slug: "owner/skill name", displayName: "Skill Name" }),
        latestVersion: { version: "2.0.0", createdAt: 456, changelog: "Updated" },
        owner: { handle: "owner", displayName: "Owner", image: "avatar.png" },
      }),
    );

    await expect(getSkill("owner/skill name")).resolves.toMatchObject({
      slug: "owner/skill name",
      displayName: "Skill Name",
      latestVersion: { version: "2.0.0", createdAt: 456, changelog: "Updated" },
      owner: { handle: "owner", displayName: "Owner", image: "avatar.png" },
    });

    fetchResponses.push(new Response("broken", { status: 500 }));

    await expect(getSkill("owner/skill name")).rejects.toThrow("ClawHub API error: 500");
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

function baseSkill(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    slug: "owner/skill",
    displayName: "Skill",
    summary: null,
    tags: {},
    stats: { comments: 0, downloads: 0, stars: 0, versions: 0 },
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}
