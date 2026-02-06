/**
 * Tool Utilities
 *
 * Shared helpers for processing tool call data.
 */

/**
 * Extract displayable content from a tool result.
 *
 * Tool results from the gateway come in various formats:
 *   - Object with content array: { content: [{ type: "text", text: "..." }], ... }
 *   - Plain string
 *   - Other object structures
 *
 * This normalizes them to extract the text content when available,
 * ensuring consistent display in both streaming and history views.
 */
export function extractToolResultContent(result: unknown): unknown {
  if (!result || typeof result !== "object") {
    return result;
  }

  // Case 1: Direct array of content blocks (history format)
  // e.g., [{ type: "text", text: "..." }]
  if (Array.isArray(result) && result.length > 0) {
    const firstBlock = result[0] as Record<string, unknown> | undefined;
    if (firstBlock?.type === "text" && typeof firstBlock.text === "string") {
      return firstBlock.text;
    }
  }

  // Case 2: Object with content array (streaming format)
  // e.g., { content: [{ type: "text", text: "..." }], details: {...} }
  const obj = result as Record<string, unknown>;
  if (Array.isArray(obj.content) && obj.content.length > 0) {
    const firstBlock = obj.content[0] as Record<string, unknown> | undefined;
    if (firstBlock?.type === "text" && typeof firstBlock.text === "string") {
      return firstBlock.text;
    }
  }

  return result;
}
