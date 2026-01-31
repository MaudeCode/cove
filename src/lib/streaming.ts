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
    console.log("[MERGE] Case 1: First content");
    return { content: newText };
  }

  // Case 2: Direct continuation (same block, no tool call in between)
  if (newText.startsWith(existingContent)) {
    console.log("[MERGE] Case 2: Direct continuation");
    return { content: newText };
  }

  // Case 3: We have a previous block start - check if this continues that block
  if (lastBlockStart !== undefined && lastBlockStart > 0) {
    const baseContent = existingContent.slice(0, lastBlockStart);
    const lastBlock = existingContent.slice(lastBlockStart);

    console.log("[MERGE] Case 3 check:", {
      lastBlockStart,
      baseLen: baseContent.length,
      lastBlockLen: lastBlock.length,
      newTextLen: newText.length,
      lastBlockStart30: lastBlock.slice(0, 30),
      newTextStart30: newText.slice(0, 30),
    });

    // Check if new text continues/replaces the last block
    if (newText.startsWith(lastBlock)) {
      console.log("[MERGE] Case 3a: Continues last block - replacing");
      // newText is the updated last block - replace it (baseContent + newText)
      return { content: baseContent + newText, lastBlockStart };
    }

    // Check if it's a prefix match (partial continuation)  
    const prefixLen = Math.min(lastBlock.length, 30);
    if (lastBlock.length > 0 && newText.startsWith(lastBlock.slice(0, prefixLen))) {
      console.log("[MERGE] Case 3b: Prefix match - replacing");
      return { content: baseContent + newText, lastBlockStart };
    }

    // New block - append with separator
    console.log("[MERGE] Case 3c: New block (append)");
    const newBlockStart = existingContent.length + TEXT_BLOCK_SEPARATOR.length;
    return {
      content: existingContent + TEXT_BLOCK_SEPARATOR + newText,
      lastBlockStart: newBlockStart,
    };
  }

  // Case 4: No lastBlockStart but content doesn't continue - new block after tool
  console.log("[MERGE] Case 4: New block after tool (append)");
  const newBlockStart = existingContent.length + TEXT_BLOCK_SEPARATOR.length;
  return {
    content: existingContent + TEXT_BLOCK_SEPARATOR + newText,
    lastBlockStart: newBlockStart,
  };
}
