/**
 * Tool block components for ToolCall display
 *
 * Organized by tool - each file contains input and/or result blocks for that tool.
 */

// Core components
export { CodeBlock } from "./CodeBlock";
export type { CodeBlockProps } from "./CodeBlock";

// Shared components
export {
  ToolInputContainer,
  ToolBadge,
  ToolOutputContainer,
  ResultCard,
  ResultGrid,
  ResultGridRow,
} from "./shared";

// Utilities
export { parseResult, parseErrorResult } from "./utils";
export type { ErrorResultShape } from "./utils";

// Result dispatcher
export { ResultBlock, ErrorResultBlock } from "./result-dispatcher";

// Per-tool blocks
export { ReadInputBlock } from "./read";
export { WriteInputBlock } from "./write";
export { ExecCommandBlock } from "./exec";
export { EditDiffBlock } from "./edit";
export { SearchInputBlock } from "./search";
export { WebSearchResultBlock } from "./web-search";
export { UrlInputBlock, WebFetchResultBlock } from "./web-fetch";
export { MemoryGetInputBlock, MemorySearchResultBlock, MemoryGetResultBlock } from "./memory";
export { BrowserInputBlock, BrowserResultBlock } from "./browser";
export { CronInputBlock, CronResultBlock } from "./cron";
export { SessionStatusInputBlock, SessionStatusResultBlock } from "./session-status";
export { ImageInputBlock, ImageResultBlock } from "./image";
export { MessageInputBlock, MessageResultBlock } from "./message";
export { GatewayInputBlock, GatewayResultBlock } from "./gateway";
