/**
 * Model Types
 *
 * Matches OpenClaw gateway models.list response.
 */

export interface ModelChoice {
  /** Model ID (e.g., "anthropic/claude-opus-4-5") */
  id: string;

  /** Display name (e.g., "Claude Opus 4.5") */
  name: string;

  /** Provider (e.g., "anthropic", "openai") */
  provider: string;

  /** Context window size in tokens */
  contextWindow?: number;

  /** Whether this model supports reasoning/thinking */
  reasoning?: boolean;
}

export interface ModelsListResult {
  models: ModelChoice[];
}
