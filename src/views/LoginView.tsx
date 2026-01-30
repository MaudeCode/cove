/**
 * LoginView
 *
 * Gateway connection/authentication form.
 */

import { useSignal } from "@preact/signals";
import { t } from "@/lib/i18n";
import { connect, lastError } from "@/lib/gateway";
import { initChat } from "@/lib/chat";
import { setActiveSession } from "@/signals/sessions";

export function LoginView() {
  const url = useSignal("");
  const token = useSignal("");
  const authMode = useSignal<"token" | "password">("token");
  const connecting = useSignal(false);
  const rememberMe = useSignal(true);
  const validationError = useSignal<string | null>(null);

  /**
   * Validate the gateway URL
   */
  const validateUrl = (value: string): string | null => {
    if (!value.trim()) {
      return t("errors.required");
    }

    // Check for valid WebSocket URL
    if (!value.startsWith("ws://") && !value.startsWith("wss://")) {
      return "URL must start with ws:// or wss://";
    }

    try {
      new URL(value);
    } catch {
      return t("errors.invalid");
    }

    return null;
  };

  const handleConnect = async () => {
    // Validate URL
    const urlError = validateUrl(url.value);
    if (urlError) {
      validationError.value = urlError;
      return;
    }
    validationError.value = null;

    connecting.value = true;
    try {
      await connect({
        url: url.value,
        token: authMode.value === "token" ? token.value : undefined,
        password: authMode.value === "password" ? token.value : undefined,
        autoReconnect: true,
      });

      // Save credentials if remember me is checked
      if (rememberMe.value) {
        localStorage.setItem("cove:gateway-url", url.value);
        localStorage.setItem("cove:auth-mode", authMode.value);
        if (token.value) {
          localStorage.setItem("cove:auth-credential", token.value);
        }
      }

      // Initialize chat with main session
      setActiveSession("main");
      await initChat("main");
    } catch (err) {
      console.error("Connect failed:", err);
    } finally {
      connecting.value = false;
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConnect();
    }
  };

  // Load saved credentials on mount
  if (!url.value) {
    const savedUrl = localStorage.getItem("cove:gateway-url");
    const savedMode = localStorage.getItem("cove:auth-mode") as "token" | "password" | null;
    const savedCred = localStorage.getItem("cove:auth-credential");

    if (savedUrl) url.value = savedUrl;
    if (savedMode) authMode.value = savedMode;
    if (savedCred) token.value = savedCred;
  }

  return (
    <div class="flex-1 flex items-center justify-center p-8">
      <div class="w-full max-w-sm">
        {/* Logo */}
        <div class="text-center mb-8">
          <div class="text-6xl mb-3">🏖️</div>
          <h1 class="text-2xl font-bold">{t("app.name")}</h1>
          <p class="text-[var(--color-text-muted)] mt-1">{t("app.tagline")}</p>
        </div>

        {/* Form */}
        <div class="p-6 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] shadow-lg">
          <h2 class="text-lg font-semibold mb-4">{t("auth.title")}</h2>

          <div class="space-y-4">
            {/* Gateway URL */}
            <div>
              <label
                htmlFor="gateway-url"
                class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"
              >
                {t("auth.gatewayUrl")}
              </label>
              <input
                id="gateway-url"
                type="text"
                value={url.value}
                onInput={(e) => {
                  url.value = (e.target as HTMLInputElement).value;
                  validationError.value = null; // Clear error on input
                }}
                onKeyDown={handleKeyDown}
                placeholder={t("auth.gatewayUrlPlaceholder")}
                class={`w-full px-3 py-2.5 text-sm rounded-lg
                  bg-[var(--color-bg-primary)] border
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]
                  placeholder:text-[var(--color-text-muted)]
                  ${validationError.value ? "border-[var(--color-error)]" : "border-[var(--color-border)]"}`}
              />
              {validationError.value && (
                <p class="mt-1 text-xs text-[var(--color-error)]">{validationError.value}</p>
              )}
            </div>

            {/* Auth mode */}
            <div>
              <label
                htmlFor="auth-mode"
                class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"
              >
                Auth Mode
              </label>
              <select
                id="auth-mode"
                value={authMode.value}
                onChange={(e) =>
                  (authMode.value = (e.target as HTMLSelectElement).value as "token" | "password")
                }
                class="w-full px-3 py-2.5 text-sm rounded-lg
                  bg-[var(--color-bg-primary)] border border-[var(--color-border)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]
                  cursor-pointer"
              >
                <option value="token">{t("auth.authMode.token")}</option>
                <option value="password">{t("auth.authMode.password")}</option>
              </select>
            </div>

            {/* Token/Password */}
            <div>
              <label
                htmlFor="auth-credential"
                class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"
              >
                {authMode.value === "token" ? t("auth.token") : t("auth.password")}
              </label>
              <input
                id="auth-credential"
                type="password"
                value={token.value}
                onInput={(e) => (token.value = (e.target as HTMLInputElement).value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  authMode.value === "token"
                    ? t("auth.tokenPlaceholder")
                    : t("auth.passwordPlaceholder")
                }
                class="w-full px-3 py-2.5 text-sm rounded-lg
                  bg-[var(--color-bg-primary)] border border-[var(--color-border)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]
                  placeholder:text-[var(--color-text-muted)]"
              />
            </div>

            {/* Remember me */}
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe.value}
                onChange={(e) => (rememberMe.value = (e.target as HTMLInputElement).checked)}
                class="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
              />
              <span class="text-sm text-[var(--color-text-secondary)]">{t("auth.rememberMe")}</span>
            </label>

            {/* Connect button */}
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting.value || !url.value.trim()}
              class="w-full px-4 py-2.5 text-sm font-medium rounded-lg
                bg-[var(--color-accent)] text-white
                hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed
                transition-opacity"
            >
              {connecting.value ? t("auth.connecting") : t("actions.connect")}
            </button>

            {/* Error message */}
            {lastError.value && (
              <p class="text-sm text-[var(--color-error)] text-center">{lastError.value}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
