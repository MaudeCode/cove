/**
 * LoginView
 *
 * Gateway connection/authentication form.
 */

import { useSignal } from "@preact/signals";
import { t } from "@/lib/i18n";
import { log } from "@/lib/logger";
import { connect, lastError } from "@/lib/gateway";
import { initPostConnectApp, startCanvasNodeConnectionIfEnabled } from "@/lib/connected-app";
import {
  classifyLoginFailure,
  type ClassifiedLoginFailure,
} from "@/lib/login-error-classification";
import { getAuth, saveAuth, getSessionCredential } from "@/lib/storage";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Dropdown } from "@/components/ui/Dropdown";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { CoveLogo } from "@/components/ui/CoveLogo";

export function LoginView() {
  const url = useSignal("");
  const token = useSignal("");
  const authMode = useSignal<"token" | "password">("token");
  const connecting = useSignal(false);
  const rememberMe = useSignal(true);
  const validationError = useSignal<string | null>(null);
  const loginFailure = useSignal<ClassifiedLoginFailure | null>(null);

  const clearLoginFailure = () => {
    loginFailure.value = null;
    lastError.value = null;
  };

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
    clearLoginFailure();

    connecting.value = true;
    try {
      await connect({
        url: url.value,
        token: authMode.value === "token" ? token.value : undefined,
        password: authMode.value === "password" ? token.value : undefined,
        autoReconnect: true,
      });

      await initPostConnectApp({ startCanvasNode: false });

      // Save auth settings and credential only after the connected app state is ready.
      saveAuth({
        url: url.value,
        authMode: authMode.value,
        rememberMe: rememberMe.value,
        credential: token.value,
      });
      startCanvasNodeConnectionIfEnabled();
    } catch (err) {
      loginFailure.value = classifyLoginFailure(err, {
        authMode: authMode.value,
        credential: token.value,
      });
      log.auth.error("Connect failed:", loginFailure.value.message);
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

  // Load saved preferences on mount (URL and auth mode only)
  if (!url.value) {
    const saved = getAuth();
    if (saved) {
      url.value = saved.url;
      authMode.value = saved.authMode;
      rememberMe.value = saved.rememberMe;
      // Credential comes from session storage only (if still valid)
      const sessionCred = getSessionCredential();
      if (sessionCred) token.value = sessionCred;
    }
  }

  // Build auth mode options with translations
  const authModeOptions = [
    { value: "token", label: t("common.token") },
    { value: "password", label: t("common.password") },
  ];
  const displayedFailure =
    loginFailure.value ??
    (lastError.value
      ? classifyLoginFailure(lastError.value, {
          authMode: authMode.value,
          credential: token.value,
        })
      : null);

  return (
    <div class="flex-1 overflow-y-auto p-4 sm:p-8">
      <div class="w-full max-w-sm mx-auto min-h-full flex flex-col justify-center py-4 sm:py-0">
        {/* Logo */}
        <div class="text-center mb-4 sm:mb-8">
          <CoveLogo size="lg" class="mx-auto mb-2 sm:mb-3 sm:w-16 sm:h-16" />
          <h1 class="text-xl sm:text-2xl font-bold">{t("common.cove")}</h1>
          <p class="text-sm sm:text-base text-[var(--color-text-muted)] mt-1">{t("app.tagline")}</p>
        </div>

        {/* Form */}
        <Card variant="elevated" padding="md">
          <h2 class="text-base sm:text-lg font-semibold mb-3 sm:mb-4">
            {t("common.connectToGateway")}
          </h2>

          <div class="space-y-3 sm:space-y-4">
            {/* Gateway URL */}
            <FormField
              label={t("common.gatewayUrl")}
              htmlFor="gateway-url"
              error={validationError.value || undefined}
            >
              <Input
                id="gateway-url"
                type="url"
                value={url.value}
                onInput={(e) => {
                  url.value = (e.target as HTMLInputElement).value;
                  validationError.value = null;
                  clearLoginFailure();
                }}
                onKeyDown={handleKeyDown}
                placeholder={t("auth.gatewayUrlPlaceholder")}
                error={validationError.value || undefined}
                autoCorrect="off"
                autoCapitalize="off"
                spellcheck={false}
                fullWidth
              />
            </FormField>

            {/* Auth mode */}
            <FormField label="Auth Mode">
              <Dropdown
                value={authMode.value}
                onChange={(value) => {
                  authMode.value = value as "token" | "password";
                  clearLoginFailure();
                }}
                options={authModeOptions}
                aria-label="Auth Mode"
                class="w-full"
              />
            </FormField>

            {/* Token/Password */}
            <FormField
              label={authMode.value === "token" ? t("common.token") : t("common.password")}
              htmlFor="auth-credential"
            >
              <PasswordInput
                id="auth-credential"
                value={token.value}
                onInput={(e) => {
                  token.value = (e.target as HTMLInputElement).value;
                  clearLoginFailure();
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  authMode.value === "token"
                    ? t("auth.tokenPlaceholder")
                    : t("auth.passwordPlaceholder")
                }
                fullWidth
              />
            </FormField>

            {/* Remember me */}
            <Toggle
              checked={rememberMe.value}
              onChange={(checked) => (rememberMe.value = checked)}
              label={t("auth.rememberMe")}
              size="sm"
            />

            {/* Connect button */}
            <Button
              variant="primary"
              onClick={handleConnect}
              disabled={connecting.value || !url.value.trim()}
              loading={connecting.value}
              fullWidth
            >
              {connecting.value ? t("common.connecting") : t("actions.connect")}
            </Button>

            {/* Error message */}
            {displayedFailure && (
              <div
                class="rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 p-3 text-sm text-[var(--color-error)]"
                role="alert"
              >
                <p class="font-medium">{displayedFailure.message}</p>
                {displayedFailure.remediation && <p class="mt-1">{displayedFailure.remediation}</p>}
                {displayedFailure.details && (
                  <details class="mt-2 text-xs text-[var(--color-text-secondary)]">
                    <summary class="cursor-pointer select-none font-medium text-[var(--color-error)]">
                      Diagnostic details
                    </summary>
                    <pre class="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-[var(--color-bg-secondary)] p-2 font-mono text-xs text-[var(--color-text-secondary)]">
                      {displayedFailure.details}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
