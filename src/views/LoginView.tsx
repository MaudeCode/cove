/**
 * LoginView
 *
 * Gateway connection/authentication form.
 */

import { useSignal } from "@preact/signals";
import { t } from "@/lib/i18n";
import { log } from "@/lib/logger";
import { connect, lastError } from "@/lib/gateway";
import { initChat } from "@/lib/chat";
import { setActiveSession, loadSessions } from "@/signals/sessions";
import { loadAssistantIdentity } from "@/signals/identity";
import { startUsagePolling } from "@/signals/usage";
import { loadModels } from "@/signals/models";
import { getAuth, saveAuth } from "@/lib/storage";
import {
  Input,
  PasswordInput,
  Dropdown,
  Button,
  Toggle,
  Card,
  FormField,
  CoveLogo,
} from "@/components/ui";

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
        saveAuth({
          url: url.value,
          authMode: authMode.value,
          credential: token.value || undefined,
          rememberMe: true,
        });
      }

      // Load sessions list for sidebar
      await loadSessions();

      // Load assistant identity
      await loadAssistantIdentity();

      // Initialize chat with main session
      setActiveSession("main");
      await initChat("main");

      // Start polling for usage data
      startUsagePolling();

      // Load available models
      loadModels();
    } catch (err) {
      log.auth.error("Connect failed:", err);
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
    const saved = getAuth();
    if (saved) {
      url.value = saved.url;
      authMode.value = saved.authMode;
      if (saved.credential) token.value = saved.credential;
      rememberMe.value = saved.rememberMe;
    }
  }

  // Build auth mode options with translations
  const authModeOptions = [
    { value: "token", label: t("auth.authMode.token") },
    { value: "password", label: t("auth.authMode.password") },
  ];

  return (
    <div class="flex-1 flex items-center justify-center p-8">
      <div class="w-full max-w-sm">
        {/* Logo */}
        <div class="text-center mb-8">
          <CoveLogo size="xl" class="mx-auto mb-3" />
          <h1 class="text-2xl font-bold">{t("app.name")}</h1>
          <p class="text-[var(--color-text-muted)] mt-1">{t("app.tagline")}</p>
        </div>

        {/* Form */}
        <Card variant="elevated" padding="lg">
          <h2 class="text-lg font-semibold mb-4">{t("auth.title")}</h2>

          <div class="space-y-4">
            {/* Gateway URL */}
            <FormField
              label={t("auth.gatewayUrl")}
              htmlFor="gateway-url"
              error={validationError.value || undefined}
            >
              <Input
                id="gateway-url"
                type="text"
                value={url.value}
                onInput={(e) => {
                  url.value = (e.target as HTMLInputElement).value;
                  validationError.value = null;
                }}
                onKeyDown={handleKeyDown}
                placeholder={t("auth.gatewayUrlPlaceholder")}
                error={validationError.value || undefined}
                fullWidth
              />
            </FormField>

            {/* Auth mode */}
            <FormField label="Auth Mode">
              <Dropdown
                value={authMode.value}
                onChange={(value) => (authMode.value = value as "token" | "password")}
                options={authModeOptions}
                aria-label="Auth Mode"
                class="w-full"
              />
            </FormField>

            {/* Token/Password */}
            <FormField
              label={authMode.value === "token" ? t("auth.token") : t("auth.password")}
              htmlFor="auth-credential"
            >
              <PasswordInput
                id="auth-credential"
                value={token.value}
                onInput={(e) => (token.value = (e.target as HTMLInputElement).value)}
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
              {connecting.value ? t("auth.connecting") : t("actions.connect")}
            </Button>

            {/* Error message */}
            {lastError.value && (
              <p class="text-sm text-[var(--color-error)] text-center">{lastError.value}</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
