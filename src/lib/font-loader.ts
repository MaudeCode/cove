import type { CodeFontFamily, FontFamily } from "@/lib/storage";

type FontAssetKey = "geist" | "inter" | "dyslexic" | "jetbrains" | "fira" | "source";

const loaded = new Set<FontAssetKey>();
const loading = new Map<FontAssetKey, Promise<void>>();

const fontLoaders: Record<FontAssetKey, () => Promise<unknown>> = {
  geist: () =>
    Promise.all([
      import("@fontsource/geist-sans/400.css"),
      import("@fontsource/geist-sans/500.css"),
      import("@fontsource/geist-sans/600.css"),
    ]),
  inter: () =>
    Promise.all([
      import("@fontsource/inter/400.css"),
      import("@fontsource/inter/500.css"),
      import("@fontsource/inter/600.css"),
    ]),
  dyslexic: () => import("@fontsource/opendyslexic/400.css"),
  jetbrains: () =>
    Promise.all([
      import("@fontsource/jetbrains-mono/400.css"),
      import("@fontsource/jetbrains-mono/500.css"),
      import("@fontsource/jetbrains-mono/600.css"),
    ]),
  fira: () =>
    Promise.all([
      import("@fontsource/fira-code/400.css"),
      import("@fontsource/fira-code/500.css"),
      import("@fontsource/fira-code/600.css"),
    ]),
  source: () =>
    Promise.all([
      import("@fontsource/source-code-pro/400.css"),
      import("@fontsource/source-code-pro/500.css"),
      import("@fontsource/source-code-pro/600.css"),
    ]),
};

function ensureFontAssetLoaded(key: FontAssetKey): Promise<void> {
  if (loaded.has(key)) return Promise.resolve();

  const inFlight = loading.get(key);
  if (inFlight) return inFlight;

  const promise = fontLoaders[key]()
    .then(() => {
      loaded.add(key);
    })
    .catch((error: unknown) => {
      // Fall back to system stack if a web font fails to load.
      console.warn("Failed to load font asset", key, error);
    })
    .finally(() => {
      loading.delete(key);
    });

  loading.set(key, promise);
  return promise;
}

export function loadUiFontFamily(font: FontFamily): Promise<void> {
  if (font === "system") return Promise.resolve();
  if (font === "geist") return ensureFontAssetLoaded("geist");
  if (font === "inter") return ensureFontAssetLoaded("inter");
  if (font === "dyslexic") return ensureFontAssetLoaded("dyslexic");
  return ensureFontAssetLoaded("jetbrains");
}

export function loadCodeFontFamily(font: CodeFontFamily): Promise<void> {
  if (font === "system") return Promise.resolve();
  if (font === "jetbrains") return ensureFontAssetLoaded("jetbrains");
  if (font === "fira") return ensureFontAssetLoaded("fira");
  return ensureFontAssetLoaded("source");
}
