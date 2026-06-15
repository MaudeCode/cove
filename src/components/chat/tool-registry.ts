import type { ToolCall } from "@/types/messages";
import { parseErrorResult } from "./tool-blocks/utils";

export type ToolKind =
  | "browser"
  | "cron"
  | "custom"
  | "edit"
  | "exec"
  | "fetch"
  | "gateway"
  | "media"
  | "message"
  | "read"
  | "search"
  | "status"
  | "write";

export type ToolGroupKind = Exclude<ToolKind, "custom"> | `custom:${string}`;
export type ToolIconKind = "custom" | "default" | "edit" | "search" | "thinking";
export type ToolInputBlockKind =
  | "browser"
  | "code"
  | "cron"
  | "edit"
  | "exec"
  | "gateway"
  | "image"
  | "memory-get"
  | "message"
  | "read"
  | "search"
  | "session-status"
  | "url"
  | "write";
export type ToolResultBlockKind =
  | "browser"
  | "code"
  | "cron"
  | "gateway"
  | "image"
  | "memory-get"
  | "memory-search"
  | "message"
  | "session-status"
  | "web-fetch"
  | "web-search";

interface ToolDefinition {
  aliases: string[];
  icon: ToolIconKind;
  inputBlock?: ToolInputBlockKind | ((args: Record<string, unknown>) => ToolInputBlockKind);
  itemVerb: {
    complete: string;
    running: string;
  };
  kind: ToolKind;
  label: (args: Record<string, unknown>, name?: string) => string;
  preview?: (toolCall: ToolCall, args: Record<string, unknown>) => string | undefined;
  resultPreview?: (toolCall: ToolCall) => string | undefined;
  resultBlock?: ToolResultBlockKind;
}

interface ToolKindDefinition {
  completePhrase: (count: number) => string;
  groupPriority: number;
  runningPhrase?: (count: number) => string;
}

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    aliases: ["read"],
    icon: "default",
    inputBlock: "read",
    itemVerb: { complete: "Read", running: "Reading" },
    kind: "read",
    label: () => "Read file",
    preview: (_toolCall, args) => getPathPreview(args),
  },
  {
    aliases: ["memory_get"],
    icon: "default",
    inputBlock: "memory-get",
    itemVerb: { complete: "Read", running: "Reading" },
    kind: "read",
    label: () => "Memory read",
    preview: (_toolCall, args) => getPathPreview(args),
    resultBlock: "memory-get",
  },
  {
    aliases: ["write"],
    icon: "default",
    inputBlock: "write",
    itemVerb: { complete: "Wrote", running: "Writing" },
    kind: "write",
    label: () => "Write file",
    preview: (_toolCall, args) => getPathPreview(args),
  },
  {
    aliases: ["edit"],
    icon: "edit",
    inputBlock: "edit",
    itemVerb: { complete: "Edited", running: "Editing" },
    kind: "edit",
    label: () => "Edit file",
    preview: (_toolCall, args) => getPathPreview(args),
  },
  {
    aliases: ["exec", "bash", "shell", "system.run", "system_run"],
    icon: "default",
    inputBlock: (args) => (hasCommandInput(args) ? "exec" : "code"),
    itemVerb: { complete: "Ran", running: "Running" },
    kind: "exec",
    label: () => "Exec",
    preview: getCommandPreview,
  },
  {
    aliases: ["web_search"],
    icon: "search",
    inputBlock: "search",
    itemVerb: { complete: "Searched", running: "Searching" },
    kind: "search",
    label: () => "Web search",
    preview: (_toolCall, args) => getString(args.query),
    resultBlock: "web-search",
  },
  {
    aliases: ["memory_search"],
    icon: "search",
    inputBlock: "search",
    itemVerb: { complete: "Searched", running: "Searching" },
    kind: "search",
    label: () => "Memory search",
    preview: (_toolCall, args) => getString(args.query),
    resultBlock: "memory-search",
  },
  {
    aliases: ["web_fetch"],
    icon: "default",
    inputBlock: "url",
    itemVerb: { complete: "Fetched", running: "Fetching" },
    kind: "fetch",
    label: () => "Web fetch",
    preview: (_toolCall, args) => {
      const url = getString(args.url);
      return url ? truncateUrl(url) : undefined;
    },
    resultBlock: "web-fetch",
  },
  {
    aliases: ["browser"],
    icon: "default",
    inputBlock: "browser",
    itemVerb: { complete: "Used", running: "Using" },
    kind: "browser",
    label: (args) => actionLabel("Browser", args),
    preview: (_toolCall, args) =>
      joinParts([
        getString(args.targetUrl) ?? getString(args.url),
        getString(args.selector),
        getString(args.text) ?? getString(args.value),
      ]),
    resultBlock: "browser",
  },
  {
    aliases: ["image"],
    icon: "default",
    inputBlock: "image",
    itemVerb: { complete: "Handled", running: "Handling" },
    kind: "media",
    label: () => "Image",
    preview: (_toolCall, args) =>
      getString(args.prompt) ?? getString(args.intent) ?? getString(args.image),
    resultBlock: "image",
  },
  {
    aliases: ["media"],
    icon: "default",
    itemVerb: { complete: "Handled", running: "Handling" },
    kind: "media",
    label: () => "Media",
    preview: (_toolCall, args) =>
      getString(args.prompt) ?? getString(args.intent) ?? getString(args.image),
  },
  {
    aliases: ["message"],
    icon: "default",
    inputBlock: "message",
    itemVerb: { complete: "Sent", running: "Sending" },
    kind: "message",
    label: (args) => actionLabel("Message", args),
    preview: (_toolCall, args) =>
      joinParts([
        getString(args.channel),
        getString(args.target) ?? getString(args.to) ?? getString(args.threadId),
        getString(args.text) ?? getString(args.body) ?? getString(args.query),
      ]),
    resultBlock: "message",
  },
  {
    aliases: ["cron"],
    icon: "default",
    inputBlock: "cron",
    itemVerb: { complete: "Checked", running: "Checking" },
    kind: "cron",
    label: (args) => actionLabel("Cron", args),
    preview: (_toolCall, args) =>
      getString(args.job) ??
      getString(args.jobId) ??
      getString(args.name) ??
      getString(args.schedule),
    resultBlock: "cron",
  },
  {
    aliases: ["gateway"],
    icon: "default",
    inputBlock: "gateway",
    itemVerb: { complete: "Called", running: "Calling" },
    kind: "gateway",
    label: (args) => actionLabel("Gateway", args),
    preview: (_toolCall, args) =>
      getString(args.note) ?? getString(args.method) ?? getString(args.target),
    resultBlock: "gateway",
  },
  {
    aliases: ["session_status"],
    icon: "default",
    inputBlock: "session-status",
    itemVerb: { complete: "Checked", running: "Checking" },
    kind: "status",
    label: () => "Session status",
    preview: (_toolCall, args) => getString(args.sessionKey) ?? getString(args.model),
    resultBlock: "session-status",
  },
];

const TOOL_KIND_DEFINITIONS: Record<Exclude<ToolKind, "custom">, ToolKindDefinition> = {
  browser: {
    completePhrase: (count) => (count === 1 ? "used browser" : `used browser ${count} times`),
    groupPriority: 70,
  },
  cron: {
    completePhrase: (count) => (count === 1 ? "checked cron" : `checked cron ${count} times`),
    groupPriority: 100,
  },
  edit: {
    completePhrase: (count) => `edited ${count} ${plural(count, "file", "files")}`,
    groupPriority: 30,
    runningPhrase: (count) => `editing ${count} ${plural(count, "file", "files")}`,
  },
  exec: {
    completePhrase: (count) => (count === 1 ? "ran a command" : `ran ${count} commands`),
    groupPriority: 40,
    runningPhrase: (count) => (count === 1 ? "running a command" : `running ${count} commands`),
  },
  fetch: {
    completePhrase: (count) => (count === 1 ? "fetched a page" : `fetched ${count} pages`),
    groupPriority: 60,
    runningPhrase: (count) => (count === 1 ? "fetching a page" : `fetching ${count} pages`),
  },
  gateway: {
    completePhrase: (count) => (count === 1 ? "called gateway" : `called gateway ${count} times`),
    groupPriority: 110,
  },
  media: {
    completePhrase: (count) => (count === 1 ? "handled media" : `handled ${count} media items`),
    groupPriority: 80,
  },
  message: {
    completePhrase: (count) => (count === 1 ? "sent a message" : `sent ${count} messages`),
    groupPriority: 90,
  },
  read: {
    completePhrase: (count) => `read ${count} ${plural(count, "file", "files")}`,
    groupPriority: 10,
    runningPhrase: (count) => `reading ${count} ${plural(count, "file", "files")}`,
  },
  search: {
    completePhrase: (count) => (count === 1 ? "searched" : `searched ${count} times`),
    groupPriority: 50,
    runningPhrase: (count) => (count === 1 ? "searching" : `searching ${count} times`),
  },
  status: {
    completePhrase: (count) =>
      count === 1 ? "checked session status" : `checked session status ${count} times`,
    groupPriority: 120,
  },
  write: {
    completePhrase: (count) => `wrote ${count} ${plural(count, "file", "files")}`,
    groupPriority: 20,
    runningPhrase: (count) => `writing ${count} ${plural(count, "file", "files")}`,
  },
};

export function getToolDefinition(name: string): ToolDefinition {
  const normalizedName = normalizeToolName(name);
  const definition = TOOL_DEFINITIONS.find((toolDefinition) =>
    toolDefinition.aliases.includes(normalizedName),
  );

  return definition ?? getCustomToolDefinition(name);
}

export function getToolGroupKind(toolCall: ToolCall): ToolGroupKind {
  const definition = getToolDefinition(toolCall.name);
  if (definition.kind === "custom") {
    return `custom:${definition.label((toolCall.args ?? {}) as Record<string, unknown>, toolCall.name)}`;
  }
  return definition.kind;
}

export function getToolGroupPhrase(kind: ToolGroupKind, count: number, running = false): string {
  if (kind.startsWith("custom:")) {
    const label = kind.slice("custom:".length) || "tool";
    if (running) {
      return count === 1 ? `using ${label}` : `using ${label} ${count} times`;
    }
    return count === 1 ? `used ${label}` : `used ${label} ${count} times`;
  }

  const definition = TOOL_KIND_DEFINITIONS[kind as Exclude<ToolKind, "custom">];
  return running && definition.runningPhrase
    ? definition.runningPhrase(count)
    : definition.completePhrase(count);
}

export function getToolGroupPriority(kind: ToolGroupKind): number {
  if (kind.startsWith("custom:")) return 1_000;

  return TOOL_KIND_DEFINITIONS[kind as Exclude<ToolKind, "custom">].groupPriority;
}

export function getToolIconKindForToolCalls(toolCalls: ToolCall[]): ToolIconKind {
  const iconKinds = toolCalls.map((toolCall) => getToolDefinition(toolCall.name).icon);

  if (iconKinds.includes("search")) return "search";
  if (iconKinds.includes("edit")) return "edit";
  if (iconKinds.includes("custom")) return "custom";

  return "default";
}

export function getToolInputBlockKind(
  name: string,
  args: Record<string, unknown>,
): ToolInputBlockKind {
  const inputBlock = getToolDefinition(name).inputBlock;
  if (typeof inputBlock === "function") {
    return inputBlock(args);
  }
  return inputBlock ?? "code";
}

export function getToolResultBlockKind(name: string): ToolResultBlockKind {
  return getToolDefinition(name).resultBlock ?? "code";
}

export function getToolItemVerb(toolCall: ToolCall): string {
  const definition = getToolDefinition(toolCall.name);
  return isRunningToolCall(toolCall) ? definition.itemVerb.running : definition.itemVerb.complete;
}

export function getToolLabel(name: string, args: Record<string, unknown>): string {
  return getToolDefinition(name).label(args, name);
}

export function getToolPreview(toolCall: ToolCall): string | undefined {
  const args = (toolCall.args ?? {}) as Record<string, unknown>;
  return getToolDefinition(toolCall.name).preview?.(toolCall, args) ?? getDefaultToolPreview(args);
}

export function getToolResultPreview(toolCall: ToolCall): string | undefined {
  return (
    getToolDefinition(toolCall.name).resultPreview?.(toolCall) ?? getDefaultResultPreview(toolCall)
  );
}

export function isExecToolName(name: string): boolean {
  return getToolDefinition(name).kind === "exec";
}

export function getExecCommandInput(args: Record<string, unknown>): string | undefined {
  const command = getString(args.command) ?? getString(args.commandText);
  if (command) return stripShellCarrier(command);

  return getArgvCommandPreview(args.argv);
}

export function isRunningToolCall(toolCall: ToolCall): boolean {
  return toolCall.status === "pending" || toolCall.status === "running";
}

export function humanizeAction(value: string): string {
  return value
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function getCustomToolDefinition(name: string): ToolDefinition {
  return {
    aliases: [normalizeToolName(name)],
    icon: "custom",
    itemVerb: { complete: humanizeAction(name), running: "Using" },
    kind: "custom",
    label: () => humanizeAction(name),
  };
}

function actionLabel(prefix: string, args: Record<string, unknown>): string {
  const action = getString(args.action);
  return action ? `${prefix} ${humanizeAction(action)}` : prefix;
}

function getDefaultToolPreview(args: Record<string, unknown>): string | undefined {
  return getString(args.preview) ?? getString(args.summary) ?? getFirstMeaningfulString(args);
}

function getCommandPreview(toolCall: ToolCall, args: Record<string, unknown>): string | undefined {
  const directPreview =
    getString(args.commandPreview) ??
    getString(args.displayCommand) ??
    getString(args.command_display) ??
    getString((toolCall as ToolCall & Record<string, unknown>).commandPreview);

  if (directPreview) return directPreview;

  return getExecCommandInput(args);
}

function hasCommandInput(args: Record<string, unknown>): boolean {
  return Boolean(getExecCommandInput(args));
}

function getArgvCommandPreview(argv: unknown): string | undefined {
  if (!Array.isArray(argv) || argv.some((item) => typeof item !== "string")) return undefined;

  const parts = argv as string[];
  if (parts.length >= 3 && isShellBinary(parts[0]) && isShellCarrierFlag(parts[1])) {
    return parts[2];
  }

  return parts.length > 0 ? parts.join(" ") : undefined;
}

function stripShellCarrier(command: string): string {
  const match = command.match(/^(?:\/(?:usr\/)?bin\/)?(?:zsh|bash|sh|fish)\s+(-lc|-c)\s+(.+)$/);
  if (!match) return command;

  return unquoteShellArgument(match[2].trim());
}

function unquoteShellArgument(value: string): string {
  if (value.length < 2) return value;

  const quote = value[0];
  if ((quote !== "'" && quote !== '"') || value[value.length - 1] !== quote) return value;

  const inner = value.slice(1, -1);
  return quote === '"' ? inner.replace(/\\"/g, '"').replace(/\\\\/g, "\\") : inner;
}

function isShellBinary(value: string): boolean {
  return /(?:^|\/)(?:zsh|bash|sh|fish)$/.test(value);
}

function isShellCarrierFlag(value: string): boolean {
  return value === "-lc" || value === "-c";
}

function getDefaultResultPreview(toolCall: ToolCall): string | undefined {
  if (toolCall.result === undefined) return undefined;

  const errorResult = parseErrorResult(toolCall.result) ?? parseLooseErrorResult(toolCall.result);
  if (errorResult) {
    return `Error: ${errorResult.error}`;
  }

  const result = unwrapResult(toolCall.result);
  if (typeof result === "string") {
    const clean = cleanToolText(result);
    return clean ? `Output: ${firstLine(clean)}` : undefined;
  }

  if (!result || typeof result !== "object") return undefined;

  const record = result as Record<string, unknown>;

  if (Array.isArray(record.results)) {
    return `${record.results.length} result${record.results.length === 1 ? "" : "s"}`;
  }

  const status = getString(record.status);
  const output =
    getString(record.summary) ??
    getString(record.text) ??
    getString(record.output) ??
    getString(record.stdout) ??
    getString(record.message);

  if (status && output) return `${humanizeAction(status)}: ${firstLine(cleanToolText(output))}`;
  if (output) return `Output: ${firstLine(cleanToolText(output))}`;
  if (status) return humanizeAction(status);

  const ok = record.ok;
  if (typeof ok === "boolean") return ok ? "Completed" : "Failed";

  return undefined;
}

function parseLooseErrorResult(result: unknown): { error: string } | null {
  if (!result || typeof result !== "object") return null;

  const record = result as Record<string, unknown>;
  return typeof record.error === "string" ? { error: record.error } : null;
}

function unwrapResult(result: unknown): unknown {
  if (!result || typeof result !== "object") return result;

  const record = result as Record<string, unknown>;
  if (Array.isArray(record.content)) {
    const text = record.content
      .map((block) =>
        block && typeof block === "object"
          ? getString((block as Record<string, unknown>).text)
          : null,
      )
      .filter((value): value is string => Boolean(value))
      .join("\n");
    if (text) return text;
  }

  if ("result" in record && record.result !== result) {
    return unwrapResult(record.result);
  }

  return result;
}

function getPathPreview(args: Record<string, unknown>): string | undefined {
  const path =
    getString(args.path) ??
    getString(args.file_path) ??
    getString(args.filePath) ??
    getString(args.file);

  if (!path) return undefined;

  const from = getNumber(args.offset) ?? getNumber(args.from);
  const lines = getNumber(args.limit) ?? getNumber(args.lines);
  const range = from && lines ? `:${from}-${from + lines - 1}` : from ? `:${from}+` : "";

  return `${truncatePath(path)}${range}`;
}

function getFirstMeaningfulString(args: Record<string, unknown>): string | undefined {
  for (const [key, value] of Object.entries(args)) {
    if (key.startsWith("_") || isProtocolFallbackKey(key)) continue;
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function isProtocolFallbackKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    normalized === "id" ||
    normalized.endsWith("id") ||
    normalized.includes("payload") ||
    normalized.includes("params") ||
    normalized.includes("args") ||
    normalized.includes("argv") ||
    normalized.includes("raw") ||
    normalized.includes("canonical") ||
    normalized.includes("command") ||
    normalized === "cwd" ||
    normalized.includes("json") ||
    normalized.includes("event") ||
    normalized.includes("envelope")
  );
}

function joinParts(parts: Array<string | undefined>): string | undefined {
  const joined = parts.filter(Boolean).join(" · ");
  return joined || undefined;
}

function cleanToolText(text: string): string {
  return text
    .replace(/\n?<<<EXTERNAL_UNTRUSTED_CONTENT>>>\nSource: [^\n]+\n---\n?/g, "")
    .replace(/\n?<<<END_EXTERNAL_UNTRUSTED_CONTENT>>>/g, "")
    .trim();
}

function firstLine(text: string): string {
  return (
    text
      .split("\n")
      .find((line) => line.trim().length > 0)
      ?.trim() ?? ""
  );
}

function truncatePath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts.length <= 2) return path;
  return "…/" + parts.slice(-2).join("/");
}

function truncateUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    const path =
      parsedUrl.pathname.length > 30 ? parsedUrl.pathname.slice(0, 30) + "…" : parsedUrl.pathname;
    return parsedUrl.hostname + path;
  } catch {
    return truncateText(url, 50);
  }
}

function normalizeToolName(name: string): string {
  return name.toLowerCase();
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function plural(count: number, singular: string, pluralValue: string): string {
  return count === 1 ? singular : pluralValue;
}

function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}
