/**
 * Streaming Text Utilities
 *
 * Handles merging streamed text deltas from the gateway.
 * The gateway sends accumulated text that resets after tool calls.
 */

import { TEXT_BLOCK_SEPARATOR } from "./constants";

export interface DeltaResult {
  content: string;
  lastBlockStart?: number;
}

/**
 * Merge incoming delta text with existing content.
 *
 * The gateway sends accumulated text per "block" - text resets after tool calls.
 * We track lastBlockStart to know where the current block began.
 */
export function mergeDeltaText(
  existingContent: string,
  newText: string,
  lastBlockStart?: number,
): DeltaResult {
  // Case 1: First content ever
  if (!existingContent) {
    return { content: newText };
  }

  // Case 2: Simple continuation - newText is the full accumulated content
  // This happens when streaming without tool calls
  if (newText.startsWith(existingContent)) {
    return { content: newText };
  }

  // Case 3: We're in a post-tool block (lastBlockStart is set)
  if (
    lastBlockStart !== undefined &&
    lastBlockStart > 0 &&
    lastBlockStart <= existingContent.length
  ) {
    const baseContent = existingContent.slice(0, lastBlockStart);
    const lastBlock = existingContent.slice(lastBlockStart);

    // If newText starts with what we have in lastBlock, it's a continuation
    // Replace lastBlock with the fuller newText
    if (newText.startsWith(lastBlock)) {
      return { content: baseContent + newText, lastBlockStart };
    }

    // If lastBlock starts with newText, keep what we have (stale delta arrived late)
    if (lastBlock.startsWith(newText)) {
      return { content: existingContent, lastBlockStart };
    }

    // If newText is unrelated and shorter, it's likely a NEW block (text reset again)
    // This happens with multiple tool calls: block1 -> tool -> block2 -> tool -> block3
    if (newText.length < lastBlock.length && !lastBlock.includes(newText)) {
      const newBlockStart = existingContent.length + TEXT_BLOCK_SEPARATOR.length;
      return {
        content: existingContent + TEXT_BLOCK_SEPARATOR + newText,
        lastBlockStart: newBlockStart,
      };
    }

    // Otherwise newText is growing the block - replace lastBlock entirely
    // This handles the case where accumulated text grows: "A" -> "An" -> "And"
    return { content: baseContent + newText, lastBlockStart };
  }

  // Case 4: New block after tool (no lastBlockStart yet)
  const newBlockStart = existingContent.length + TEXT_BLOCK_SEPARATOR.length;
  return {
    content: existingContent + TEXT_BLOCK_SEPARATOR + newText,
    lastBlockStart: newBlockStart,
  };
}
