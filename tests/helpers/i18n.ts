import { mock } from "bun:test";

type Translate = (key: string, values?: Record<string, unknown>) => string;

const defaultTranslate: Translate = (key, values) =>
  values ? `${key}:${JSON.stringify(values)}` : key;

export function installI18nMock(
  overrides: {
    formatTimestamp?: (timestamp: number) => string;
    t?: Translate;
  } = {},
): void {
  mock.module("@/lib/i18n", () => ({
    formatTimestamp: overrides.formatTimestamp ?? ((timestamp: number) => `time:${timestamp}`),
    t: overrides.t ?? defaultTranslate,
  }));
}
