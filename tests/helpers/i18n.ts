import { mock } from "bun:test";

type Translate = (key: string, values?: Record<string, unknown>) => string;

const defaultTranslate: Translate = (key, values) =>
  values ? `${key}:${JSON.stringify(values)}` : key;

export function installI18nMock(
  overrides: {
    formatBytes?: (bytes: number) => string;
    formatDuration?: (ms: number | undefined) => string;
    formatTimestampCompact?: (timestamp: Date | number) => string;
    formatTokens?: (tokens: number) => string;
    formatTimestamp?: (timestamp: Date | number) => string;
    t?: Translate;
  } = {},
): void {
  mock.module("@/lib/i18n", () => ({
    formatBytes: overrides.formatBytes ?? ((bytes: number) => `${bytes} B`),
    formatDuration:
      overrides.formatDuration ?? ((ms: number | undefined) => (ms == null ? "—" : `${ms}ms`)),
    formatTimestamp:
      overrides.formatTimestamp ?? ((timestamp: Date | number) => `time:${timestamp}`),
    formatTimestampCompact:
      overrides.formatTimestampCompact ?? ((timestamp: Date | number) => `short:${timestamp}`),
    formatTokens: overrides.formatTokens ?? ((tokens: number) => String(tokens)),
    t: overrides.t ?? defaultTranslate,
  }));
}
