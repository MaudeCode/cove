/**
 * Logger utility
 *
 * Wraps console methods for consistent logging with prefixes.
 * In dev mode, also sends logs to /__cove_debug endpoint for file-based debugging.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Set minimum log level (could be configured via env)
const MIN_LEVEL: LogLevel = "debug";

// Dev mode file logging
const DEV_MODE = import.meta.env.DEV;

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

function formatMessage(prefix: string, message: string): string {
  return `[${prefix}] ${message}`;
}

/**
 * Send log to file via dev server endpoint (non-blocking, fire-and-forget)
 */
function sendToFile(level: LogLevel, namespace: string, message: string, data?: unknown): void {
  if (!DEV_MODE) return;

  try {
    fetch("/__cove_debug", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level, namespace, message, data }),
    }).catch(() => {
      // Silently ignore - don't want logging failures to affect the app
    });
  } catch {
    // Ignore
  }
}

/**
 * Create a namespaced logger
 */
export function createLogger(namespace: string) {
  return {
    debug: (message: string, ...args: unknown[]) => {
      if (shouldLog("debug")) {
        // eslint-disable-next-line no-console
        console.debug(formatMessage(namespace, message), ...args);
        sendToFile("debug", namespace, message, args.length ? args : undefined);
      }
    },
    info: (message: string, ...args: unknown[]) => {
      if (shouldLog("info")) {
        // eslint-disable-next-line no-console
        console.info(formatMessage(namespace, message), ...args);
        sendToFile("info", namespace, message, args.length ? args : undefined);
      }
    },
    warn: (message: string, ...args: unknown[]) => {
      if (shouldLog("warn")) {
        // eslint-disable-next-line no-console
        console.warn(formatMessage(namespace, message), ...args);
        sendToFile("warn", namespace, message, args.length ? args : undefined);
      }
    },
    error: (message: string, ...args: unknown[]) => {
      if (shouldLog("error")) {
        // eslint-disable-next-line no-console
        console.error(formatMessage(namespace, message), ...args);
        sendToFile("error", namespace, message, args.length ? args : undefined);
      }
    },
  };
}

/**
 * Clear the debug log file (dev mode only)
 */
export function clearDebugLog(): void {
  if (!DEV_MODE) return;
  fetch("/__cove_debug", { method: "DELETE" }).catch(() => {});
}

// Pre-configured loggers for common modules
export const log = {
  gateway: createLogger("gateway"),
  auth: createLogger("auth"),
  chat: createLogger("chat"),
  i18n: createLogger("i18n"),
  ui: createLogger("ui"),
  usage: createLogger("usage"),
};
