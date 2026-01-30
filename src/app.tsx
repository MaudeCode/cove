/**
 * Main App Component
 *
 * This will be expanded in Phase 1.1 to include:
 * - Layout shell (TopBar, Sidebar, MainContent)
 * - Routing
 * - Auth state management
 */

import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { initTheme, themePreference, activeTheme, setTheme, getAllThemes } from "@/lib/theme";
import { initI18n, t } from "@/lib/i18n";
import {
  connect,
  disconnect,
  connectionState,
  isConnected,
  lastError,
  gatewayVersion,
  send,
} from "@/lib/gateway";

export function App() {
  // Initialize systems on mount
  useEffect(() => {
    initTheme();
    initI18n();
  }, []);

  const themes = getAllThemes();
  const current = activeTheme.value;
  const pref = themePreference.value;

  // Gateway connection form state
  const url = useSignal("wss://openclaw.maudeco.de/ws");
  const password = useSignal("");
  const connecting = useSignal(false);
  const testResult = useSignal<string | null>(null);

  const handleConnect = async () => {
    connecting.value = true;
    testResult.value = null;
    try {
      const hello = await connect({
        url: url.value,
        password: password.value,
        autoReconnect: false,
      });
      testResult.value = `Connected! Version: ${hello.version ?? "unknown"}`;
    } catch (err) {
      testResult.value = `Failed: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      connecting.value = false;
    }
  };

  const handleDisconnect = () => {
    disconnect();
    testResult.value = null;
  };

  const handleTestRequest = async () => {
    try {
      const result = await send("status");
      testResult.value = `Status: ${JSON.stringify(result, null, 2)}`;
    } catch (err) {
      testResult.value = `Request failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  };

  return (
    <div class="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex items-center justify-center transition-colors p-4">
      <div class="text-center max-w-lg w-full">
        <h1 class="text-4xl font-bold mb-2">🏖️ {t("app.name")}</h1>
        <p class="text-[var(--color-text-secondary)]">{t("app.description")}</p>

        {/* Phase indicator */}
        <div class="mt-4 p-2 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border)]">
          <p class="text-xs text-[var(--color-text-muted)]">Phase 0.4 — Gateway WebSocket Client</p>
        </div>

        {/* Gateway Connection Test */}
        <div class="mt-6 p-4 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-left">
          <h3 class="text-sm font-semibold mb-3">Gateway Connection Test</h3>

          {/* Connection State */}
          <div class="flex items-center gap-2 mb-4">
            <div
              class={`w-3 h-3 rounded-full ${
                isConnected.value
                  ? "bg-[var(--color-success)]"
                  : connectionState.value === "connecting" ||
                      connectionState.value === "authenticating"
                    ? "bg-[var(--color-warning)] animate-pulse"
                    : "bg-[var(--color-error)]"
              }`}
            />
            <span class="text-sm text-[var(--color-text-secondary)]">
              {connectionState.value}
              {gatewayVersion.value && ` (v${gatewayVersion.value})`}
            </span>
          </div>

          {!isConnected.value ? (
            <div class="space-y-3">
              <div>
                <label
                  htmlFor="gateway-url"
                  class="block text-xs text-[var(--color-text-muted)] mb-1"
                >
                  Gateway URL
                </label>
                <input
                  id="gateway-url"
                  type="text"
                  value={url.value}
                  onInput={(e) => (url.value = (e.target as HTMLInputElement).value)}
                  class="w-full px-3 py-2 text-sm rounded-md bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  placeholder="wss://..."
                />
              </div>
              <div>
                <label
                  htmlFor="gateway-password"
                  class="block text-xs text-[var(--color-text-muted)] mb-1"
                >
                  Password
                </label>
                <input
                  id="gateway-password"
                  type="password"
                  value={password.value}
                  onInput={(e) => (password.value = (e.target as HTMLInputElement).value)}
                  class="w-full px-3 py-2 text-sm rounded-md bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  placeholder="Enter password"
                />
              </div>
              <button
                onClick={handleConnect}
                disabled={connecting.value}
                class="w-full px-4 py-2 text-sm font-medium rounded-md bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {connecting.value ? "Connecting..." : "Connect"}
              </button>
            </div>
          ) : (
            <div class="space-y-3">
              <div class="flex gap-2">
                <button
                  onClick={handleTestRequest}
                  class="flex-1 px-4 py-2 text-sm font-medium rounded-md bg-[var(--color-bg-primary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                >
                  Test Request
                </button>
                <button
                  onClick={handleDisconnect}
                  class="flex-1 px-4 py-2 text-sm font-medium rounded-md bg-[var(--color-error)] text-white hover:opacity-90 transition-opacity"
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}

          {/* Error display */}
          {lastError.value && (
            <div class="mt-3 p-2 rounded bg-[var(--color-error)]/10 border border-[var(--color-error)]/30">
              <p class="text-xs text-[var(--color-error)]">{lastError.value}</p>
            </div>
          )}

          {/* Test result */}
          {testResult.value && (
            <div class="mt-3 p-2 rounded bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
              <pre class="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap overflow-auto max-h-32">
                {testResult.value}
              </pre>
            </div>
          )}
        </div>

        {/* Theme selector */}
        <div class="mt-6">
          <select
            id="theme-select"
            value={pref.selected}
            onChange={(e) => setTheme((e.target as HTMLSelectElement).value)}
            class="w-full px-3 py-2 text-sm rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          >
            <option value="system">Theme: System</option>
            {themes.map((theme) => (
              <option key={theme.id} value={theme.id}>
                Theme: {theme.name}
              </option>
            ))}
          </select>
        </div>

        <p class="mt-4 text-xs text-[var(--color-text-muted)]">Current: {current.name}</p>
      </div>
    </div>
  );
}
