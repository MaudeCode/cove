/**
 * Log Line Parser
 *
 * Parses various log formats into a normalized structure.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface ParsedLogLine {
  id: number;
  raw: string;
  timestamp?: string;
  level?: LogLevel;
  message: string;
  /** Parsed JSON fields (for structured logs) */
  fields?: Record<string, string>;
}

let lineIdCounter = 0;

/** Reset ID counter (for testing or log clear) */
export function resetLineIdCounter() {
  lineIdCounter = 0;
}

/** Flatten nested objects into dot-notation keys (arrays are stringified, not indexed) */
function flattenObject(
  obj: Record<string, unknown>,
  prefix = "",
  skipNumericKeys = true,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip numeric keys (tslog positional args) unless explicitly included
    if (skipNumericKeys && /^\d+$/.test(key)) continue;

    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      // Stringify arrays instead of flattening with indices
      result[fullKey] = JSON.stringify(value);
    } else if (typeof value === "object") {
      Object.assign(result, flattenObject(value as Record<string, unknown>, fullKey, false));
    } else if (typeof value === "string") {
      result[fullKey] = value;
    } else {
      result[fullKey] = JSON.stringify(value);
    }
  }
  return result;
}

/**
 * Extract message and fields from tslog's numbered positional args.
 * tslog stores args as "0", "1", "2", etc. The last string arg is typically the message.
 */
function extractTslogArgs(parsed: Record<string, unknown>): {
  message: string | null;
  fields: Record<string, string>;
} {
  const numericKeys = Object.keys(parsed)
    .filter((k) => /^\d+$/.test(k))
    .map(Number)
    .sort((a, b) => a - b);

  if (numericKeys.length === 0) {
    return { message: null, fields: {} };
  }

  // Find the last string value - that's typically the message
  let message: string | null = null;
  const fields: Record<string, string> = {};

  for (const key of numericKeys) {
    const value = parsed[String(key)];
    if (typeof value === "string") {
      // Try to parse as JSON (subsystem info is often stringified JSON)
      try {
        const innerParsed = JSON.parse(value);
        if (typeof innerParsed === "object" && innerParsed !== null) {
          // It's a JSON object (like {"subsystem":"agent/embedded"})
          Object.assign(fields, flattenObject(innerParsed, "", false));
          continue;
        }
      } catch {
        // Not JSON, treat as potential message
      }
      // Last string becomes the message
      message = value;
    } else if (typeof value === "object" && value !== null) {
      // Object field - flatten it
      Object.assign(fields, flattenObject(value as Record<string, unknown>, "", false));
    }
  }

  return { message, fields };
}

/** Keys to skip when extracting fields from JSON logs */
const SKIP_KEYS = [
  "time",
  "timestamp",
  "ts",
  "level",
  "lvl",
  "pid",
  "hostname",
  "v",
  "msg",
  "message",
];

/**
 * Parse a raw log line into a structured format.
 * Handles: JSON, OpenClaw text, bracketed, cloudflared, and plain text formats.
 */
export function parseLogLine(raw: string): ParsedLogLine {
  const id = ++lineIdCounter;

  let timestamp: string | undefined;
  let level: LogLevel | undefined;
  let message = raw;
  let fields: Record<string, string> | undefined;

  // Try JSON format first: {"level":"info","time":"...","msg":"..."}
  // Also handles tslog format: {"0":"subsystem","1":{data},"2":"message","_meta":{...},"time":"..."}
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw);
      timestamp = parsed.time || parsed.timestamp || parsed.ts;

      // Check for level in _meta (tslog) or top-level
      const metaLevel = parsed._meta?.logLevelName?.toLowerCase();
      const jsonLevel = metaLevel || (parsed.level || parsed.lvl || "")?.toLowerCase();
      if (["debug", "info", "warn", "warning", "error", "err"].includes(jsonLevel)) {
        level =
          jsonLevel === "warning"
            ? "warn"
            : jsonLevel === "err"
              ? "error"
              : (jsonLevel as LogLevel);
      }

      // Check for tslog numbered args first (has "0", "1", etc.)
      const hasNumericKeys = Object.keys(parsed).some((k) => /^\d+$/.test(k));

      if (hasNumericKeys) {
        // tslog format: extract message and fields from numbered args
        const tslogData = extractTslogArgs(parsed);
        if (tslogData.message) {
          message = tslogData.message;
        }
        if (Object.keys(tslogData.fields).length > 0) {
          fields = tslogData.fields;
        }
      }

      // Fallback to standard formats if no message found yet
      if (message === raw) {
        if (parsed.msg || parsed.message) {
          message = parsed.msg || parsed.message;
        } else if (parsed.error && typeof parsed.error === "string") {
          message = parsed.error;
        }
      }

      // If still no message, format key fields into a readable message
      if (message === raw && !hasNumericKeys) {
        const parts: string[] = [];
        for (const [key, value] of Object.entries(parsed)) {
          if (SKIP_KEYS.includes(key)) continue;
          if (typeof value === "string") {
            parts.push(`${key}=${value}`);
          } else if (value !== null && value !== undefined) {
            parts.push(`${key}=${JSON.stringify(value)}`);
          }
        }
        message = parts.length > 0 ? parts.join("  ") : raw;
      }

      // Extract additional fields (non-numeric, non-skip keys)
      if (!fields) {
        const filtered: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(parsed)) {
          if (!SKIP_KEYS.includes(key) && !/^\d+$/.test(key) && key !== "_meta") {
            filtered[key] = value;
          }
        }
        if (Object.keys(filtered).length > 0) {
          fields = flattenObject(filtered);
        }
      }
    } catch {
      // Not valid JSON, continue with text parsing
    }
  }

  // Try OpenClaw text format: 2024-01-01T12:00:00.000Z [category] message
  if (!timestamp) {
    const openclawMatch = raw.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+\[([^\]]+)\]\s*(.*)$/);
    if (openclawMatch) {
      timestamp = openclawMatch[1];
      message = `[${openclawMatch[2]}] ${openclawMatch[3]}`;

      // Infer level from message content or category
      const fullText = raw.toLowerCase();
      if (fullText.includes("error") || fullText.includes("err ") || fullText.includes("✗")) {
        level = "error";
      } else if (fullText.includes("warn") || fullText.includes("warning")) {
        level = "warn";
      } else if (fullText.includes("debug")) {
        level = "debug";
      } else {
        level = "info";
      }
    }
  }

  // Try bracketed format: [2024-01-01T12:00:00.000Z] INFO: message
  if (!timestamp) {
    const bracketMatch = raw.match(/^\[([^\]]+)\]\s*(DEBUG|INFO|WARN|ERROR):?\s*(.*)$/i);
    if (bracketMatch) {
      timestamp = bracketMatch[1];
      level = bracketMatch[2].toLowerCase() as LogLevel;
      message = bracketMatch[3];
    }
  }

  // Try cloudflared format: 2024-01-01T12:00:00Z ERR message
  if (!timestamp) {
    const cfMatch = raw.match(/^(\d{4}-\d{2}-\d{2}T[\d:]+Z)\s+(ERR|INF|WRN|DBG)\s+(.*)$/);
    if (cfMatch) {
      timestamp = cfMatch[1];
      const cfLevel = cfMatch[2];
      level =
        cfLevel === "ERR"
          ? "error"
          : cfLevel === "WRN"
            ? "warn"
            : cfLevel === "DBG"
              ? "debug"
              : "info";
      message = cfMatch[3];
    }
  }

  // Try simple format: INFO message or INFO: message
  if (!level && !timestamp) {
    const simpleMatch = raw.match(/^(DEBUG|INFO|WARN|ERROR):?\s+(.*)$/i);
    if (simpleMatch) {
      level = simpleMatch[1].toLowerCase() as LogLevel;
      message = simpleMatch[2];
    }
  }

  // Fallback: infer level from content if still not set
  if (!level) {
    const lowerRaw = raw.toLowerCase();
    if (
      lowerRaw.includes("error") ||
      lowerRaw.includes("failed") ||
      lowerRaw.includes("exception") ||
      lowerRaw.includes("✗")
    ) {
      level = "error";
    } else if (lowerRaw.includes("warn") || lowerRaw.includes("deprecated")) {
      level = "warn";
    } else if (lowerRaw.includes("debug") || lowerRaw.includes("trace")) {
      level = "debug";
    }
  }

  return { id, raw, timestamp, level, message, fields };
}
