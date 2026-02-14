/**
 * Shared utilities for tool block components
 */

/**
 * Parse result that might be a JSON string or object
 */
export function parseResult<T>(result: unknown): T | null {
  if (typeof result === "object" && result !== null) {
    return result as T;
  }

  if (typeof result === "string") {
    try {
      return JSON.parse(result) as T;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Error result shape from tool calls
 */
export interface ErrorResultShape {
  status: "error";
  error: string;
  tool?: string;
}

/**
 * Parse error result from tool output
 */
export function parseErrorResult(result: unknown): ErrorResultShape | null {
  const parsed = parseResult<Record<string, unknown>>(result);
  if (parsed && parsed.status === "error" && typeof parsed.error === "string") {
    return {
      status: "error",
      error: parsed.error,
      tool: parsed.tool as string | undefined,
    };
  }
  return null;
}
