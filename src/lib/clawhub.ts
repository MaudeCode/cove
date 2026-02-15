/**
 * ClawHub API Client
 *
 * Fetch skills from the public ClawHub registry.
 * https://clawhub.ai
 */

const CLAWHUB_API = "https://clawhub.ai/api/v1";

// ============================================
// Types
// ============================================

export interface ClawHubSkill {
  slug: string;
  displayName: string;
  summary: string | null;
  tags: Record<string, string>; // e.g., { latest: "1.0.0" }
  stats: {
    comments: number;
    downloads: number;
    installsAllTime?: number;
    installsCurrent?: number;
    stars: number;
    versions: number;
  };
  createdAt: number;
  updatedAt: number;
  latestVersion: {
    version: string;
    createdAt: number;
    changelog: string;
  } | null;
  owner?: {
    handle: string;
    displayName: string;
    image: string;
  };
}

export interface ClawHubListResponse {
  items: ClawHubSkill[];
  nextCursor?: string;
}

export interface ClawHubSearchResponse {
  items: ClawHubSkill[];
}

/** Raw search result from API (different shape than full skill) */
interface ClawHubSearchResult {
  score: number;
  slug: string;
  displayName: string;
  summary: string | null;
  version: string;
  updatedAt: number;
}

// ============================================
// API Functions
// ============================================

export type ClawHubSort = "trending" | "downloads" | "stars" | "recent";

/**
 * List skills from ClawHub
 */
export async function listSkills(options?: {
  limit?: number;
  cursor?: string;
  sort?: ClawHubSort;
}): Promise<ClawHubListResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.cursor) params.set("cursor", options.cursor);
  if (options?.sort) params.set("sort", options.sort);

  const url = `${CLAWHUB_API}/skills${params.toString() ? `?${params}` : ""}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`ClawHub API error: ${res.status}`);
  }

  return res.json();
}

/**
 * Search skills on ClawHub
 * Note: Search API returns a different shape than list, so we normalize it.
 */
export async function searchSkills(
  query: string,
  options?: { limit?: number },
): Promise<ClawHubSearchResponse> {
  const params = new URLSearchParams({ q: query });
  if (options?.limit) params.set("limit", String(options.limit));

  const url = `${CLAWHUB_API}/search?${params}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`ClawHub API error: ${res.status}`);
  }

  const data: { results: ClawHubSearchResult[] } = await res.json();

  // Normalize search results to match ClawHubSkill shape
  const items: ClawHubSkill[] = (data.results || []).map((r) => ({
    slug: r.slug,
    displayName: r.displayName,
    summary: r.summary,
    tags: { latest: r.version },
    stats: { comments: 0, downloads: 0, stars: 0, versions: 0 }, // Not available in search
    createdAt: r.updatedAt, // Use updatedAt as fallback
    updatedAt: r.updatedAt,
    latestVersion: {
      version: r.version,
      createdAt: r.updatedAt,
      changelog: "",
    },
  }));

  return { items };
}

/**
 * Get skill detail by slug
 */
export async function getSkill(slug: string): Promise<ClawHubSkill | null> {
  const url = `${CLAWHUB_API}/skills/${encodeURIComponent(slug)}`;
  const res = await fetch(url);

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`ClawHub API error: ${res.status}`);
  }

  const data: {
    skill: Omit<ClawHubSkill, "latestVersion" | "owner">;
    latestVersion: ClawHubSkill["latestVersion"];
    owner?: ClawHubSkill["owner"];
  } = await res.json();

  return {
    ...data.skill,
    latestVersion: data.latestVersion,
    owner: data.owner,
  };
}
