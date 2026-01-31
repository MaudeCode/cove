/**
 * Streaming Text Utilities
 *
 * Handles the complex logic of merging streamed text deltas.
 * The gateway sends accumulated text per-block, resetting after tool calls,
 * so we need to detect continuations vs new blocks.
 */

import { TEXT_BLOCK_SEPARATOR } from "./constants";

export interface DeltaResult {
  /** Merged content string */
  content: string;
  /** Start position of the last appended block (for continuation detection) */
  lastBlockStart?: number;
}

/**
 * Merge incoming delta text with existing content.
 *
 * Handles three cases:
 * 1. Direct continuation (new text starts with existing)
 * 2. Continuation of a previously appended block
 * 3. New block after a tool call
 */
export function mergeDeltaText(
  existingContent: string,
  newText: string,
  lastBlockStart?: number,
): DeltaResult {
  // Case 1: First content
  if (!existingContent) {
    return { content: newText };
  }

  // Case 2: Direct continuation (same block, no tool call in between)
  if (newText.startsWith(existingContent)) {
    return { content: newText };
  }

  // Case 3: We have a previous block start - check if this continues that block
  if (lastBlockStart !== undefined && lastBlockStart > 0) {
    const baseContent = existingContent.slice(0, lastBlockStart);
    const lastBlock = existingContent.slice(lastBlockStart);

    // Check if new text continues the last block
    if (newText.startsWith(lastBlock)) {
      return { content: baseContent + newText };
    }

    // Check if it's a prefix match (partial continuation)
    const prefixLen = Math.min(lastBlock.length, 30);
    if (lastBlock.length > 0 && newText.startsWith(lastBlock.slice(0, prefixLen))) {
      return { content: baseContent + newText };
    }

    // New block - append with separator
    const newBlockStart = existingContent.length + TEXT_BLOCK_SEPARATOR.length;
    return {
      content: existingContent + TEXT_BLOCK_SEPARATOR + newText,
      lastBlockStart: newBlockStart,
    };
  }

  // Case 4: No lastBlockStart but content doesn't continue - new block after tool
  const newBlockStart = existingContent.length + TEXT_BLOCK_SEPARATOR.length;
  return {
    content: existingContent + TEXT_BLOCK_SEPARATOR + newText,
    lastBlockStart: newBlockStart,
  };
}
