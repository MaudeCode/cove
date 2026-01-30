/**
 * Main App Component
 *
 * Phase 0.5 - Session & Message Signals demo
 */

import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { initTheme, themePreference, setTheme, getAllThemes } from "@/lib/theme";
import { initI18n, t } from "@/lib/i18n";
import {
  connect,
  disconnect,
  connectionState,
  isConnected,
  lastError,
  gatewayVersion,
} from "@/lib/gateway";
import { initChat, cleanupChat, sendMessage, abortChat } from "@/lib/chat";
import {
  messages,
  isLoadingHistory,
  historyError,
  isStreaming,
  streamingContent,
} from "@/signals/chat";
import { activeSessionKey, setActiveSession } from "@/signals/sessions";

export function App() {
  // Initialize systems on mount
  useEffect(() => {
    initTheme();
    initI18n();
  }, []);

  const themes = getAllThemes();
  const pref = themePreference.value;

  // Gateway connection form state
  const url = useSignal("");
  const token = useSignal("");
  const authMode = useSignal<"token" | "password">("token");
  const connecting = useSignal(false);

  // Chat input state
  const chatInput = useSignal("");
  const sending = useSignal(false);

  const handleConnect = async () => {
    connecting.value = true;
    try {
      await connect({
        url: url.value,
        token: authMode.value === "token" ? token.value : undefined,
        password: authMode.value === "password" ? token.value : undefined,
        autoReconnect: true,
      });

      // Initialize chat with main session
      setActiveSession("main");
      await initChat("main");
    } catch (err) {
      console.error("Connect failed:", err);
    } finally {
      connecting.value = false;
    }
  };

  const handleDisconnect = () => {
    cleanupChat();
    disconnect();
  };

  const handleSend = async () => {
    if (!chatInput.value.trim() || !activeSessionKey.value) return;

    sending.value = true;
    const message = chatInput.value;
    chatInput.value = "";

    try {
      await sendMessage(activeSessionKey.value, message);
    } catch (err) {
      console.error("Send failed:", err);
    } finally {
      sending.value = false;
    }
  };

  const handleAbort = () => {
    if (activeSessionKey.value) {
      abortChat(activeSessionKey.value);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div class="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] flex flex-col transition-colors">
      {/* Header */}
      <header class="border-b border-[var(--color-border)] p-4">
        <div class="max-w-4xl mx-auto flex items-center justify-between">
          <h1 class="text-xl font-bold">🏖️ {t("app.name")}</h1>
          <div class="flex items-center gap-4">
            {/* Connection indicator */}
            <div class="flex items-center gap-2">
              <div
                class={`w-2 h-2 rounded-full ${
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
                {gatewayVersion.value && ` v${gatewayVersion.value}`}
              </span>
            </div>
            {/* Theme selector */}
            <select
              value={pref.selected}
              onChange={(e) => setTheme((e.target as HTMLSelectElement).value)}
              class="text-sm px-2 py-1 rounded bg-[var(--color-bg-surface)] border border-[var(--color-border)]"
            >
              <option value="system">System</option>
              {themes.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main class="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col">
        {!isConnected.value ? (
          /* Connection form */
          <div class="flex-1 flex items-center justify-center">
            <div class="w-full max-w-sm p-6 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-border)]">
              <h2 class="text-lg font-semibold mb-4">Connect to Gateway</h2>
              <div class="space-y-4">
                <div>
                  <label htmlFor="url" class="block text-sm text-[var(--color-text-muted)] mb-1">
                    Gateway URL
                  </label>
                  <input
                    id="url"
                    type="text"
                    value={url.value}
                    onInput={(e) => (url.value = (e.target as HTMLInputElement).value)}
                    placeholder="wss://..."
                    class="w-full px-3 py-2 text-sm rounded bg-[var(--color-bg-primary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  />
                </div>
                <div>
                  <label htmlFor="auth" class="block text-sm text-[var(--color-text-muted)] mb-1">
                    Auth Mode
                  </label>
                  <select
                    id="auth"
                    value={authMode.value}
                    onChange={(e) =>
                      (authMode.value = (e.target as HTMLSelectElement).value as
                        | "token"
                        | "password")
                    }
                    class="w-full px-3 py-2 text-sm rounded bg-[var(--color-bg-primary)] border border-[var(--color-border)]"
                  >
                    <option value="token">Token</option>
                    <option value="password">Password</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="token" class="block text-sm text-[var(--color-text-muted)] mb-1">
                    {authMode.value === "token" ? "Token" : "Password"}
                  </label>
                  <input
                    id="token"
                    type="password"
                    value={token.value}
                    onInput={(e) => (token.value = (e.target as HTMLInputElement).value)}
                    placeholder={authMode.value === "token" ? "Enter token" : "Enter password"}
                    class="w-full px-3 py-2 text-sm rounded bg-[var(--color-bg-primary)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  />
                </div>
                <button
                  onClick={handleConnect}
                  disabled={connecting.value}
                  class="w-full px-4 py-2 text-sm font-medium rounded bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50"
                >
                  {connecting.value ? "Connecting..." : "Connect"}
                </button>
                {lastError.value && (
                  <p class="text-sm text-[var(--color-error)]">{lastError.value}</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Chat interface */
          <>
            {/* Messages area */}
            <div class="flex-1 overflow-y-auto space-y-4 mb-4">
              {isLoadingHistory.value && (
                <div class="text-center text-[var(--color-text-muted)] py-8">
                  Loading history...
                </div>
              )}
              {historyError.value && (
                <div class="text-center text-[var(--color-error)] py-8">{historyError.value}</div>
              )}
              {messages.value.map((msg) => (
                <div
                  key={msg.id}
                  class={`p-3 rounded-lg ${
                    msg.role === "user"
                      ? "bg-[var(--color-accent)]/10 ml-12"
                      : msg.role === "assistant"
                        ? "bg-[var(--color-bg-surface)] mr-12"
                        : "bg-[var(--color-bg-secondary)] text-sm italic"
                  }`}
                >
                  <div class="text-xs text-[var(--color-text-muted)] mb-1">
                    {msg.role === "user"
                      ? "You"
                      : msg.role === "assistant"
                        ? "Assistant"
                        : "System"}
                  </div>
                  <div class="whitespace-pre-wrap">{msg.content}</div>
                </div>
              ))}
              {/* Streaming indicator */}
              {isStreaming.value && (
                <div class="p-3 rounded-lg bg-[var(--color-bg-surface)] mr-12">
                  <div class="text-xs text-[var(--color-text-muted)] mb-1">Assistant</div>
                  <div class="whitespace-pre-wrap">
                    {streamingContent.value || (
                      <span class="text-[var(--color-text-muted)] animate-pulse">Thinking...</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Input area */}
            <div class="border-t border-[var(--color-border)] pt-4">
              <div class="flex gap-2">
                <textarea
                  value={chatInput.value}
                  onInput={(e) => (chatInput.value = (e.target as HTMLTextAreaElement).value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                  rows={2}
                  class="flex-1 px-3 py-2 text-sm rounded bg-[var(--color-bg-surface)] border border-[var(--color-border)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
                <div class="flex flex-col gap-2">
                  <button
                    onClick={handleSend}
                    disabled={sending.value || isStreaming.value || !chatInput.value.trim()}
                    class="px-4 py-2 text-sm font-medium rounded bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Send
                  </button>
                  {isStreaming.value && (
                    <button
                      onClick={handleAbort}
                      class="px-4 py-2 text-sm font-medium rounded bg-[var(--color-error)] text-white hover:opacity-90"
                    >
                      Stop
                    </button>
                  )}
                </div>
              </div>
              <div class="flex justify-between items-center mt-2">
                <span class="text-xs text-[var(--color-text-muted)]">
                  Session: {activeSessionKey.value ?? "none"}
                </span>
                <button
                  onClick={handleDisconnect}
                  class="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-error)]"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
