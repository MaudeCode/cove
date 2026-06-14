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
const MAX_EXTRACTED_TOOL_RESULT_CHARS = 200_000;
const TOOL_RESULT_TRUNCATED_MARKER = "\n[tool result truncated]";

export function extractToolResultContent(result: unknown): unknown {
  if (!result || typeof result !== "object") {
    return result;
  }

  // Case 1: Direct array of content blocks (history format)
  // e.g., [{ type: "text", text: "..." }]
  if (Array.isArray(result) && result.length > 0) {
    const text = extractContentBlocks(result);
    if (text !== null) {
      return text;
    }
  }

  // Case 2: Object with content array (streaming format)
  // e.g., { content: [{ type: "text", text: "..." }], details: {...} }
  const obj = result as Record<string, unknown>;
  if (Array.isArray(obj.content) && obj.content.length > 0) {
    const text = extractContentBlocks(obj.content);
    if (text !== null) {
      return text;
    }
  }

  return result;
}

function extractContentBlocks(blocks: unknown[]): string | null {
  const displayBlocks: string[] = [];
  let totalLength = 0;

  for (const block of blocks) {
    if (!block || typeof block !== "object") return null;
    const record = block as Record<string, unknown>;
    const display = getDisplayBlock(record);
    if (display === null) return null;

    const separatorLength = displayBlocks.length > 0 ? 1 : 0;
    const nextLength = totalLength + separatorLength + display.length;
    if (nextLength > MAX_EXTRACTED_TOOL_RESULT_CHARS) {
      const remaining = Math.max(
        0,
        MAX_EXTRACTED_TOOL_RESULT_CHARS - totalLength - separatorLength,
      );
      if (remaining > 0) {
        displayBlocks.push(display.slice(0, remaining));
      }
      return `${displayBlocks.join("\n")}${TOOL_RESULT_TRUNCATED_MARKER}`;
    }

    displayBlocks.push(display);
    totalLength = nextLength;
  }

  return displayBlocks.length > 0 ? displayBlocks.join("\n") : null;
}

function getDisplayBlock(record: Record<string, unknown>): string | null {
  if (record.type === "text" && typeof record.text === "string") {
    return record.text;
  }

  if (typeof record.type !== "string") {
    return null;
  }

  if (record.type === "image") {
    const bytes =
      typeof record.bytes === "number"
        ? record.bytes
        : typeof (record.source as Record<string, unknown> | undefined)?.bytes === "number"
          ? ((record.source as Record<string, unknown>).bytes as number)
          : undefined;
    return bytes === undefined ? "[image block]" : `[image block: ${bytes} bytes]`;
  }

  return `[${record.type} block]`;
}
