import { mock } from "bun:test";

type Translate = (key: string, values?: Record<string, unknown>) => string;

const defaultTranslate: Translate = (key, values) =>
  values ? `${key}:${JSON.stringify(values)}` : key;

export function installI18nMock(
  overrides: {
    formatBytes?: (bytes: number) => string;
    formatDuration?: (ms: number | undefined) => string;
    formatTimestamp?: (timestamp: number) => string;
    t?: Translate;
  } = {},
): void {
  mock.module("@/lib/i18n", () => ({
    formatBytes: overrides.formatBytes ?? ((bytes: number) => `${bytes} B`),
    formatDuration:
      overrides.formatDuration ?? ((ms: number | undefined) => (ms == null ? "—" : `${ms}ms`)),
    formatTimestamp: overrides.formatTimestamp ?? ((timestamp: number) => `time:${timestamp}`),
    t: overrides.t ?? defaultTranslate,
  }));
}
