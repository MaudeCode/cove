/**
 * Logger utility
 *
 * Wraps console methods for consistent logging with prefixes.
 * Can be extended to send logs to external services in production.
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

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

function formatMessage(prefix: string, message: string): string {
  return `[${prefix}] ${message}`;
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
      }
    },
    info: (message: string, ...args: unknown[]) => {
      if (shouldLog("info")) {
        // eslint-disable-next-line no-console
        console.info(formatMessage(namespace, message), ...args);
      }
    },
    warn: (message: string, ...args: unknown[]) => {
      if (shouldLog("warn")) {
        // eslint-disable-next-line no-console
        console.warn(formatMessage(namespace, message), ...args);
      }
    },
    error: (message: string, ...args: unknown[]) => {
      if (shouldLog("error")) {
        // eslint-disable-next-line no-console
        console.error(formatMessage(namespace, message), ...args);
      }
    },
  };
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
