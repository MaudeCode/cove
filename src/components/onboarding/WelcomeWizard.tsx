/**
 * WelcomeWizard
 *
 * First-run onboarding wizard for new users.
 * Guides through gateway connection setup.
 */

import { useSignal, useComputed, useSignalEffect } from "@preact/signals";
import { t } from "@/lib/i18n";
import { log } from "@/lib/logger";
import { connect, lastError, disconnect, probeGateway } from "@/lib/gateway";
import { initChat } from "@/lib/chat";
import { setActiveSession, loadSessions } from "@/signals/sessions";
import { loadAssistantIdentity } from "@/signals/identity";
import { startUsagePolling } from "@/signals/usage";
import { loadModels } from "@/signals/models";
import { saveAuth, completeOnboarding } from "@/lib/storage";
import {
  Button,
  Input,
  Dropdown,
  Toggle,
  Card,
  FormField,
  CoveLogo,
  Spinner,
  LinkButton,
  HintBox,
  StatusIcon,
  Tooltip,
} from "@/components/ui";
import { ArrowRight, ArrowLeft, Zap, Shield, Globe, Check, AlertCircle } from "lucide-preact";
import { WizardNav } from "./WizardNav";
import { WizardProgress } from "./WizardProgress";

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
  const probing = useSignal(false);
  const probeSuccess = useSignal(false);

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

  // Auto-probe gateway when URL is valid (debounced)
  useSignalEffect(() => {
    const currentUrl = url.value;

    // Reset states when URL changes
    probeSuccess.value = false;

    // Only probe if URL format is valid
    if (!canProceedFromUrl.value) {
      return;
    }

    // Debounce: wait 600ms after typing stops
    const timeoutId = setTimeout(async () => {
      // Don't probe if already probing or URL changed
      if (probing.peek() || url.peek() !== currentUrl) return;

      probing.value = true;
      urlError.value = null;

      const result = await probeGateway(currentUrl);

      // Only update if URL hasn't changed during probe
      if (url.peek() === currentUrl) {
        probing.value = false;
        if (result.ok) {
          probeSuccess.value = true;
          urlError.value = null;
        } else {
          probeSuccess.value = false;
          urlError.value = result.error || t("onboarding.probeError");
        }
      }
    }, 600);

    return () => clearTimeout(timeoutId);
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

  const handleProbeAndProceed = async () => {
    if (!validateUrl()) return;

    // If already validated, proceed immediately
    if (probeSuccess.value) {
      step.value = "auth";
      return;
    }

    // If currently probing, wait for it
    if (probing.value) return;

    probing.value = true;
    urlError.value = null;

    const result = await probeGateway(url.value);

    probing.value = false;

    if (result.ok) {
      probeSuccess.value = true;
      // Brief delay to show success state
      setTimeout(() => {
        step.value = "auth";
        probeSuccess.value = false;
      }, 500);
    } else {
      urlError.value = result.error || t("onboarding.probeError");
    }
  };

  const goNext = () => {
    if (step.value === "welcome") {
      step.value = "url";
    } else if (step.value === "url") {
      handleProbeAndProceed();
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
        <WizardProgress
          steps={["welcome", "url", "auth", "connect"] as const}
          current={step.value}
          class="mb-8"
        />

        {/* Step content */}
        {step.value === "welcome" && <WelcomeStep onNext={goNext} onSkip={handleSkip} />}

        {step.value === "url" && (
          <UrlStep
            url={url.value}
            onUrlChange={(v) => {
              url.value = v;
              urlError.value = null;
              probeSuccess.value = false;
            }}
            error={urlError.value}
            canProceed={canProceedFromUrl.value}
            probing={probing.value}
            probeSuccess={probeSuccess.value}
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
        <LinkButton onClick={onSkip}>{t("onboarding.skipToLogin")}</LinkButton>
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
  probing: boolean;
  probeSuccess: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

function UrlStep({
  url,
  onUrlChange,
  error,
  canProceed,
  probing,
  probeSuccess,
  onNext,
  onBack,
  onSkip,
}: UrlStepProps) {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && probeSuccess) {
      onNext();
    }
  };

  // Determine the status indicator for the input
  const getStatusIndicator = () => {
    if (probing) {
      return <Spinner size="sm" />;
    }
    if (probeSuccess) {
      return <Check class="w-4 h-4 text-[var(--color-success)]" />;
    }
    if (error && canProceed) {
      // Show error icon with tooltip - URL format valid but probe failed
      return (
        <Tooltip content={error} placement="left">
          <span class="cursor-help">
            <AlertCircle class="w-4 h-4 text-[var(--color-error)]" />
          </span>
        </Tooltip>
      );
    }
    return null;
  };

  return (
    <Card variant="elevated" padding="lg">
      <h2 class="text-lg font-semibold mb-2">{t("onboarding.urlTitle")}</h2>
      <p class="text-sm text-[var(--color-text-muted)] mb-6">{t("onboarding.urlSubtitle")}</p>

      <FormField label={t("auth.gatewayUrl")} htmlFor="gateway-url">
        <Input
          id="gateway-url"
          type="text"
          value={url}
          onInput={(e) => onUrlChange((e.target as HTMLInputElement).value)}
          onKeyDown={handleKeyDown}
          placeholder={t("auth.gatewayUrlPlaceholder")}
          rightElement={getStatusIndicator()}
          fullWidth
        />
      </FormField>

      <HintBox
        title={t("onboarding.troubleshootTitle")}
        items={[
          t("onboarding.troubleshoot1"),
          t("onboarding.troubleshoot2"),
          t("onboarding.troubleshoot3"),
        ]}
        class="mt-4"
      />

      <WizardNav onBack={onBack} onNext={onNext} nextDisabled={!probeSuccess} />

      <div class="text-center mt-4">
        <LinkButton onClick={onSkip} disabled={probing}>
          {t("onboarding.skipToLogin")}
        </LinkButton>
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
        <FormField label={t("onboarding.authMethod")}>
          <Dropdown
            value={authMode}
            onChange={(value) => onAuthModeChange(value as "token" | "password")}
            options={authModeOptions}
            aria-label={t("onboarding.authMethod")}
            class="w-full"
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

      <WizardNav onBack={onBack} onNext={onNext} nextLabel={t("actions.connect")} />
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
          <StatusIcon variant="success" class="mx-auto mb-4" />
          <h2 class="text-lg font-semibold mb-2">{t("onboarding.success")}</h2>
          <p class="text-sm text-[var(--color-text-muted)] mb-6">{t("onboarding.successDesc")}</p>
          <Button
            variant="primary"
            onClick={onComplete}
            fullWidth
            iconRight={<ArrowRight class="w-4 h-4" />}
          >
            {t("onboarding.startChatting")}
          </Button>
        </>
      )}

      {!connecting && !connected && error && (
        <>
          <StatusIcon variant="error" class="mx-auto mb-4" />
          <h2 class="text-lg font-semibold mb-2">{t("onboarding.failed")}</h2>
          <p class="text-sm text-[var(--color-error)] mb-4">{error}</p>

          <HintBox
            title={t("onboarding.failedHints")}
            items={[
              t("onboarding.hint1"),
              t("onboarding.hint2"),
              t("onboarding.hint3"),
              t("onboarding.hint4"),
            ]}
            class="text-left mb-6"
          />

          <Button
            variant="primary"
            onClick={onRetry}
            fullWidth
            icon={<ArrowLeft class="w-4 h-4" />}
          >
            {t("onboarding.tryAgain")}
          </Button>
        </>
      )}
    </Card>
  );
}
