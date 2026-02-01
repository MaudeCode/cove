/**
 * WelcomeWizard
 *
 * First-run onboarding wizard for new users.
 * Guides through gateway connection setup.
 */

import { useSignal, useComputed } from "@preact/signals";
import { t } from "@/lib/i18n";
import { log } from "@/lib/logger";
import { connect, lastError, disconnect } from "@/lib/gateway";
import { initChat } from "@/lib/chat";
import { setActiveSession, loadSessions } from "@/signals/sessions";
import { loadAssistantIdentity } from "@/signals/identity";
import { startUsagePolling } from "@/signals/usage";
import { loadModels } from "@/signals/models";
import { saveAuth, completeOnboarding } from "@/lib/storage";
import { Button, Input, Select, Toggle, Card, FormField, CoveLogo, Spinner } from "@/components/ui";
import { CheckCircle, XCircle, ArrowRight, ArrowLeft, Zap, Shield, Globe } from "lucide-preact";

type WizardStep = "welcome" | "url" | "auth" | "connect";

interface WelcomeWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function WelcomeWizard({ onComplete, onSkip }: WelcomeWizardProps) {
  const step = useSignal<WizardStep>("welcome");
  const url = useSignal("");
  const authMode = useSignal<"token" | "password">("token");
  const credential = useSignal("");
  const rememberMe = useSignal(true);
  const connecting = useSignal(false);
  const connected = useSignal(false);
  const urlError = useSignal<string | null>(null);

  const canProceedFromUrl = useComputed(() => {
    const value = url.value.trim();
    if (!value) return false;
    if (!value.startsWith("ws://") && !value.startsWith("wss://")) return false;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  });

  const validateUrl = () => {
    const value = url.value.trim();
    if (!value) {
      urlError.value = t("errors.required");
      return false;
    }
    if (!value.startsWith("ws://") && !value.startsWith("wss://")) {
      urlError.value = t("onboarding.urlError");
      return false;
    }
    try {
      new URL(value);
      urlError.value = null;
      return true;
    } catch {
      urlError.value = t("errors.invalid");
      return false;
    }
  };

  const handleConnect = async () => {
    connecting.value = true;
    connected.value = false;

    try {
      await connect({
        url: url.value,
        token: authMode.value === "token" ? credential.value : undefined,
        password: authMode.value === "password" ? credential.value : undefined,
        autoReconnect: true,
      });

      // Save credentials
      if (rememberMe.value) {
        saveAuth({
          url: url.value,
          authMode: authMode.value,
          credential: credential.value || undefined,
          rememberMe: true,
        });
      }

      // Mark onboarding complete
      completeOnboarding();

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

      connected.value = true;
    } catch (err) {
      log.auth.error("Connect failed:", err);
      connected.value = false;
    } finally {
      connecting.value = false;
    }
  };

  const handleRetry = () => {
    disconnect();
    connected.value = false;
    step.value = "auth";
  };

  const goNext = () => {
    if (step.value === "welcome") {
      step.value = "url";
    } else if (step.value === "url") {
      if (validateUrl()) {
        step.value = "auth";
      }
    } else if (step.value === "auth") {
      step.value = "connect";
      handleConnect();
    }
  };

  const goBack = () => {
    if (step.value === "url") {
      step.value = "welcome";
    } else if (step.value === "auth") {
      step.value = "url";
    } else if (step.value === "connect" && !connected.value) {
      step.value = "auth";
    }
  };

  const handleSkip = () => {
    completeOnboarding();
    onSkip();
  };

  return (
    <div class="flex-1 flex items-center justify-center p-8">
      <div class="w-full max-w-md">
        {/* Progress indicator */}
        <div class="flex justify-center gap-2 mb-8">
          {(["welcome", "url", "auth", "connect"] as WizardStep[]).map((s, i) => (
            <div
              key={s}
              class={`h-1.5 rounded-full transition-all duration-300 ${
                i <= ["welcome", "url", "auth", "connect"].indexOf(step.value)
                  ? "w-8 bg-[var(--color-accent)]"
                  : "w-4 bg-[var(--color-border)]"
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        {step.value === "welcome" && <WelcomeStep onNext={goNext} onSkip={handleSkip} />}

        {step.value === "url" && (
          <UrlStep
            url={url.value}
            onUrlChange={(v) => {
              url.value = v;
              urlError.value = null;
            }}
            error={urlError.value}
            canProceed={canProceedFromUrl.value}
            onNext={goNext}
            onBack={goBack}
            onSkip={handleSkip}
          />
        )}

        {step.value === "auth" && (
          <AuthStep
            authMode={authMode.value}
            onAuthModeChange={(v) => (authMode.value = v)}
            credential={credential.value}
            onCredentialChange={(v) => (credential.value = v)}
            rememberMe={rememberMe.value}
            onRememberMeChange={(v) => (rememberMe.value = v)}
            onNext={goNext}
            onBack={goBack}
          />
        )}

        {step.value === "connect" && (
          <ConnectStep
            connecting={connecting.value}
            connected={connected.value}
            error={lastError.value}
            onRetry={handleRetry}
            onComplete={onComplete}
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// Step Components
// ============================================

interface WelcomeStepProps {
  onNext: () => void;
  onSkip: () => void;
}

function WelcomeStep({ onNext, onSkip }: WelcomeStepProps) {
  return (
    <div class="text-center">
      <CoveLogo size="xl" class="mx-auto mb-4" />
      <h1 class="text-2xl font-bold mb-2">{t("onboarding.welcome")}</h1>
      <p class="text-[var(--color-text-muted)] mb-8">{t("onboarding.welcomeSubtitle")}</p>

      {/* Features */}
      <div class="grid gap-4 mb-8 text-left">
        <FeatureCard
          icon={<Zap class="w-5 h-5" />}
          title={t("onboarding.feature1Title")}
          description={t("onboarding.feature1Desc")}
        />
        <FeatureCard
          icon={<Shield class="w-5 h-5" />}
          title={t("onboarding.feature2Title")}
          description={t("onboarding.feature2Desc")}
        />
        <FeatureCard
          icon={<Globe class="w-5 h-5" />}
          title={t("onboarding.feature3Title")}
          description={t("onboarding.feature3Desc")}
        />
      </div>

      <div class="space-y-3">
        <Button
          variant="primary"
          onClick={onNext}
          fullWidth
          iconRight={<ArrowRight class="w-4 h-4" />}
        >
          {t("onboarding.getStarted")}
        </Button>
        <button
          type="button"
          onClick={onSkip}
          class="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
        >
          {t("onboarding.skipToLogin")}
        </button>
      </div>
    </div>
  );
}

interface FeatureCardProps {
  icon: preact.ComponentChildren;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div class="flex gap-3 p-3 rounded-lg bg-[var(--color-bg-secondary)]">
      <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h3 class="font-medium text-sm">{title}</h3>
        <p class="text-xs text-[var(--color-text-muted)]">{description}</p>
      </div>
    </div>
  );
}

interface UrlStepProps {
  url: string;
  onUrlChange: (value: string) => void;
  error: string | null;
  canProceed: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

function UrlStep({ url, onUrlChange, error, canProceed, onNext, onBack, onSkip }: UrlStepProps) {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && canProceed) {
      onNext();
    }
  };

  return (
    <Card variant="elevated" padding="lg">
      <h2 class="text-lg font-semibold mb-2">{t("onboarding.urlTitle")}</h2>
      <p class="text-sm text-[var(--color-text-muted)] mb-6">{t("onboarding.urlSubtitle")}</p>

      <FormField label={t("auth.gatewayUrl")} htmlFor="gateway-url" error={error || undefined}>
        <Input
          id="gateway-url"
          type="text"
          value={url}
          onInput={(e) => onUrlChange((e.target as HTMLInputElement).value)}
          onKeyDown={handleKeyDown}
          placeholder={t("auth.gatewayUrlPlaceholder")}
          error={error || undefined}
          fullWidth
        />
      </FormField>

      {/* Troubleshooting hint */}
      <div class="mt-4 p-3 rounded-lg bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-muted)]">
        <p class="font-medium mb-1">{t("onboarding.troubleshootTitle")}</p>
        <ul class="list-disc list-inside space-y-0.5">
          <li>{t("onboarding.troubleshoot1")}</li>
          <li>{t("onboarding.troubleshoot2")}</li>
          <li>{t("onboarding.troubleshoot3")}</li>
        </ul>
      </div>

      <div class="flex gap-3 mt-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft class="w-4 h-4 mr-2" />
          {t("actions.back")}
        </Button>
        <Button variant="primary" onClick={onNext} disabled={!canProceed} class="flex-1">
          {t("actions.continue")}
          <ArrowRight class="w-4 h-4 ml-2" />
        </Button>
      </div>

      <div class="text-center mt-4">
        <button
          type="button"
          onClick={onSkip}
          class="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
        >
          {t("onboarding.skipToLogin")}
        </button>
      </div>
    </Card>
  );
}

interface AuthStepProps {
  authMode: "token" | "password";
  onAuthModeChange: (value: "token" | "password") => void;
  credential: string;
  onCredentialChange: (value: string) => void;
  rememberMe: boolean;
  onRememberMeChange: (value: boolean) => void;
  onNext: () => void;
  onBack: () => void;
}

function AuthStep({
  authMode,
  onAuthModeChange,
  credential,
  onCredentialChange,
  rememberMe,
  onRememberMeChange,
  onNext,
  onBack,
}: AuthStepProps) {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      onNext();
    }
  };

  const authModeOptions = [
    { value: "token", label: t("auth.authMode.token") },
    { value: "password", label: t("auth.authMode.password") },
  ];

  return (
    <Card variant="elevated" padding="lg">
      <h2 class="text-lg font-semibold mb-2">{t("onboarding.authTitle")}</h2>
      <p class="text-sm text-[var(--color-text-muted)] mb-6">{t("onboarding.authSubtitle")}</p>

      <div class="space-y-4">
        <FormField label={t("onboarding.authMethod")} htmlFor="auth-mode">
          <Select
            id="auth-mode"
            value={authMode}
            onChange={(e) =>
              onAuthModeChange((e.target as HTMLSelectElement).value as "token" | "password")
            }
            options={authModeOptions}
            fullWidth
          />
        </FormField>

        <FormField
          label={authMode === "token" ? t("auth.token") : t("auth.password")}
          htmlFor="credential"
        >
          <Input
            id="credential"
            type="password"
            value={credential}
            onInput={(e) => onCredentialChange((e.target as HTMLInputElement).value)}
            onKeyDown={handleKeyDown}
            placeholder={
              authMode === "token" ? t("auth.tokenPlaceholder") : t("auth.passwordPlaceholder")
            }
            fullWidth
          />
        </FormField>

        <Toggle
          checked={rememberMe}
          onChange={onRememberMeChange}
          label={t("auth.rememberMe")}
          description={t("onboarding.rememberMeDesc")}
          size="sm"
        />
      </div>

      <div class="flex gap-3 mt-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft class="w-4 h-4 mr-2" />
          {t("actions.back")}
        </Button>
        <Button variant="primary" onClick={onNext} class="flex-1">
          {t("actions.connect")}
          <ArrowRight class="w-4 h-4 ml-2" />
        </Button>
      </div>
    </Card>
  );
}

interface ConnectStepProps {
  connecting: boolean;
  connected: boolean;
  error: string | null;
  onRetry: () => void;
  onComplete: () => void;
}

function ConnectStep({ connecting, connected, error, onRetry, onComplete }: ConnectStepProps) {
  return (
    <Card variant="elevated" padding="lg" class="text-center">
      {connecting && (
        <>
          <Spinner size="lg" class="mx-auto mb-4" />
          <h2 class="text-lg font-semibold mb-2">{t("onboarding.connecting")}</h2>
          <p class="text-sm text-[var(--color-text-muted)]">{t("onboarding.connectingDesc")}</p>
        </>
      )}

      {!connecting && connected && (
        <>
          <div class="w-16 h-16 rounded-full bg-[var(--color-success)]/10 text-[var(--color-success)] flex items-center justify-center mx-auto mb-4">
            <CheckCircle class="w-8 h-8" />
          </div>
          <h2 class="text-lg font-semibold mb-2">{t("onboarding.success")}</h2>
          <p class="text-sm text-[var(--color-text-muted)] mb-6">{t("onboarding.successDesc")}</p>
          <Button variant="primary" onClick={onComplete} fullWidth>
            {t("onboarding.startChatting")}
            <ArrowRight class="w-4 h-4 ml-2" />
          </Button>
        </>
      )}

      {!connecting && !connected && error && (
        <>
          <div class="w-16 h-16 rounded-full bg-[var(--color-error)]/10 text-[var(--color-error)] flex items-center justify-center mx-auto mb-4">
            <XCircle class="w-8 h-8" />
          </div>
          <h2 class="text-lg font-semibold mb-2">{t("onboarding.failed")}</h2>
          <p class="text-sm text-[var(--color-error)] mb-4">{error}</p>

          {/* Troubleshooting */}
          <div class="text-left p-3 rounded-lg bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-muted)] mb-6">
            <p class="font-medium mb-1">{t("onboarding.failedHints")}</p>
            <ul class="list-disc list-inside space-y-0.5">
              <li>{t("onboarding.hint1")}</li>
              <li>{t("onboarding.hint2")}</li>
              <li>{t("onboarding.hint3")}</li>
              <li>{t("onboarding.hint4")}</li>
            </ul>
          </div>

          <Button variant="primary" onClick={onRetry} fullWidth>
            <ArrowLeft class="w-4 h-4 mr-2" />
            {t("onboarding.tryAgain")}
          </Button>
        </>
      )}
    </Card>
  );
}
