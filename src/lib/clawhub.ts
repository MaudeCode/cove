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
}

export interface ClawHubListResponse {
  items: ClawHubSkill[];
  nextCursor?: string;
}

export interface ClawHubSearchResponse {
  items: ClawHubSkill[];
  nextCursor?: string;
}

// ============================================
// API Functions
// ============================================

/**
 * List skills from ClawHub
 */
export async function listSkills(options?: {
  limit?: number;
  cursor?: string;
}): Promise<ClawHubListResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.cursor) params.set("cursor", options.cursor);

  const url = `${CLAWHUB_API}/skills${params.toString() ? `?${params}` : ""}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`ClawHub API error: ${res.status}`);
  }

  return res.json();
}

/**
 * Search skills on ClawHub
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

  return res.json();
}

/**
 * Get skill detail by slug
 */
export async function getSkill(slug: string): Promise<ClawHubSkill | null> {
  const url = `${CLAWHUB_API}/resolve?slug=${encodeURIComponent(slug)}`;
  const res = await fetch(url);

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`ClawHub API error: ${res.status}`);
  }

  return res.json();
}

/**
 * Get ClawHub download URL for a skill
 */
export function getDownloadUrl(slug: string, version?: string): string {
  const params = new URLSearchParams({ slug });
  if (version) params.set("version", version);
  return `${CLAWHUB_API}/download?${params}`;
}
