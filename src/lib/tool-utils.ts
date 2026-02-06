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

  const obj = result as Record<string, unknown>;

  // If it has content array with a text block, extract the text
  if (Array.isArray(obj.content) && obj.content.length > 0) {
    const firstBlock = obj.content[0] as Record<string, unknown> | undefined;
    if (firstBlock?.type === "text" && typeof firstBlock.text === "string") {
      return firstBlock.text;
    }
  }

  return result;
}
