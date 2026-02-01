/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Log level: "debug" | "info" | "warn" | "error" | "off" */
  readonly VITE_LOG_LEVEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
