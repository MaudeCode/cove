/**
 * WelcomeWizard
 *
 * First-run onboarding wizard for new users.
 * Guides through gateway connection setup.
 */

import { useLayoutEffect, useRef } from "preact/hooks";
import { useSignal, useComputed, useSignalEffect } from "@preact/signals";
import { t } from "@/lib/i18n";
import { log } from "@/lib/logger";
import { connect, lastError, disconnect, probeGateway } from "@/lib/gateway";
import { initChat } from "@/lib/chat/init";
import { setActiveSession, loadSessions } from "@/signals/sessions";
import { loadAssistantIdentity } from "@/signals/identity";
import { startUsagePolling } from "@/signals/usage";
import { loadModels } from "@/signals/models";
import { saveAuth, completeOnboarding, setPendingTour } from "@/lib/storage";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Dropdown } from "@/components/ui/Dropdown";
import { Toggle } from "@/components/ui/Toggle";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { CoveLogo } from "@/components/ui/CoveLogo";
import { Spinner } from "@/components/ui/Spinner";
import { LinkButton } from "@/components/ui/LinkButton";
import { HintBox } from "@/components/ui/HintBox";
import { StatusIcon } from "@/components/ui/StatusIcon";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  ArrowRight,
  ArrowLeft,
  Zap,
  Shield,
  Globe,
  Check,
  AlertCircle,
  MessageSquare,
  LayoutGrid,
  MonitorPlay,
} from "lucide-preact";
import { appMode, canvasNodeEnabled, type AppMode } from "@/signals/settings";
import { startNodeConnection, stopNodeConnection } from "@/lib/node-connection";
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
  const showTour = useSignal(true);
  const selectedMode = useSignal<AppMode>("single");

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

  // Default canvas to enabled for wizard users (manual connect keeps default off)
  const canvasInitialized = useRef(false);
  useLayoutEffect(() => {
    if (!canvasInitialized.current) {
      canvasInitialized.current = true;
      canvasNodeEnabled.value = true;
    }
  }, []);

  // Auto-probe gateway when URL is valid (debounced)
  useSignalEffect(() => {
    const currentUrl = url.value;

    // Reset states when URL changes
    probeSuccess.value = false;
    probing.value = false;

    // Only probe if URL format is valid
    if (!canProceedFromUrl.value) {
      return;
    }

    // Create abort controller for this probe attempt
    const abortController = new AbortController();

    // Debounce: wait 600ms after typing stops
    const timeoutId = setTimeout(async () => {
      // Don't probe if aborted or URL changed
      if (abortController.signal.aborted || url.peek() !== currentUrl) return;

      probing.value = true;
      urlError.value = null;

      const result = await probeGateway(currentUrl, abortController.signal);

      // Only update if not aborted and URL hasn't changed
      if (!abortController.signal.aborted && url.peek() === currentUrl) {
        probing.value = false;
        if (result.ok) {
          probeSuccess.value = true;
          urlError.value = null;
        } else if (result.error !== "Aborted") {
          probeSuccess.value = false;
          urlError.value = result.error || t("onboarding.probeError");
        }
      }
    }, 600);

    // Cleanup: abort probe and clear timeout when URL changes
    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };
  });

  const validateUrl = () => {
    if (!url.value.trim()) {
      urlError.value = t("errors.required");
      return false;
    }
    if (!canProceedFromUrl.value) {
      urlError.value = t("onboarding.urlError");
      return false;
    }
    urlError.value = null;
    return true;
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

      // Save auth settings and credential
      saveAuth({
        url: url.value,
        authMode: authMode.value,
        rememberMe: rememberMe.value,
        credential: credential.value,
      });

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
    <div class="flex-1 overflow-y-auto p-4 sm:p-8">
      <div class="w-full max-w-md mx-auto min-h-full flex flex-col justify-center py-4 sm:py-0">
        <WizardProgress
          steps={["welcome", "url", "auth", "connect"] as const}
          current={step.value}
          class="mb-4 sm:mb-8"
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
            showTour={showTour.value}
            onShowTourChange={(v) => (showTour.value = v)}
            selectedMode={selectedMode.value}
            onModeChange={(mode) => {
              selectedMode.value = mode;
              appMode.value = mode;
            }}
            onRetry={handleRetry}
            onContinue={() => {
              setPendingTour(showTour.value);
              appMode.value = selectedMode.value;
              onComplete();
            }}
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
      <CoveLogo size="lg" class="mx-auto mb-2 sm:mb-4 w-12 h-12 sm:w-16 sm:h-16" />
      <h1 class="text-xl sm:text-2xl font-bold mb-1 sm:mb-2">{t("onboarding.welcome")}</h1>
      <p class="text-sm sm:text-base text-[var(--color-text-muted)] mb-4 sm:mb-8">
        {t("onboarding.welcomeSubtitle")}
      </p>

      {/* Features */}
      <div class="grid gap-2 sm:gap-4 mb-4 sm:mb-8 text-left">
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
    <div class="flex gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-[var(--color-bg-secondary)]">
      <div class="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center">
        {icon}
      </div>
      <div class="min-w-0">
        <h3 class="font-medium text-xs sm:text-sm">{title}</h3>
        <p class="text-xs text-[var(--color-text-muted)] line-clamp-2">{description}</p>
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
    return undefined;
  };

  return (
    <Card variant="elevated" padding="md">
      <h2 class="text-base sm:text-lg font-semibold mb-1 sm:mb-2">{t("onboarding.urlTitle")}</h2>
      <p class="text-xs sm:text-sm text-[var(--color-text-muted)] mb-3 sm:mb-6">
        {t("onboarding.urlSubtitle")}
      </p>

      <FormField label={t("auth.gatewayUrl")} htmlFor="gateway-url">
        <Input
          id="gateway-url"
          type="url"
          value={url}
          onInput={(e) => onUrlChange((e.target as HTMLInputElement).value)}
          onKeyDown={handleKeyDown}
          placeholder={t("auth.gatewayUrlPlaceholder")}
          rightElement={getStatusIndicator()}
          autoCorrect="off"
          autoCapitalize="off"
          spellcheck={false}
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
        class="mt-3 sm:mt-4 text-xs sm:text-sm"
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
    <Card variant="elevated" padding="md">
      <h2 class="text-base sm:text-lg font-semibold mb-1 sm:mb-2">{t("onboarding.authTitle")}</h2>
      <p class="text-xs sm:text-sm text-[var(--color-text-muted)] mb-3 sm:mb-6">
        {t("onboarding.authSubtitle")}
      </p>

      <div class="space-y-3 sm:space-y-4">
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
          <PasswordInput
            id="credential"
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
  showTour: boolean;
  onShowTourChange: (value: boolean) => void;
  selectedMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  onRetry: () => void;
  onContinue: () => void;
}

function ConnectStep({
  connecting,
  connected,
  error,
  showTour,
  onShowTourChange,
  selectedMode,
  onModeChange,
  onRetry,
  onContinue,
}: ConnectStepProps) {
  return (
    <Card variant="elevated" padding="md" class="text-center">
      {connecting && (
        <>
          <Spinner size="md" class="mx-auto mb-3 sm:mb-4" />
          <h2 class="text-base sm:text-lg font-semibold mb-1 sm:mb-2">
            {t("onboarding.connecting")}
          </h2>
          <p class="text-xs sm:text-sm text-[var(--color-text-muted)]">
            {t("onboarding.connectingDesc")}
          </p>
        </>
      )}

      {!connecting && connected && (
        <>
          <StatusIcon variant="success" size="sm" class="mx-auto mb-3 sm:mb-4" />
          <h2 class="text-base sm:text-lg font-semibold mb-1 sm:mb-2">{t("onboarding.success")}</h2>
          <p class="text-xs sm:text-sm text-[var(--color-text-muted)] mb-4 sm:mb-6">
            {t("onboarding.successDesc")}
          </p>

          {/* Mode Selection */}
          <div class="mb-4 sm:mb-6">
            <p class="text-xs sm:text-sm font-medium text-[var(--color-text-primary)] mb-2 sm:mb-3">
              {t("onboarding.modeTitle")}
            </p>
            <div class="grid grid-cols-2 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => onModeChange("single")}
                class={`p-2 sm:p-4 rounded-lg border-2 text-left transition-colors ${
                  selectedMode === "single"
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                    : "border-[var(--color-border)] hover:border-[var(--color-accent)]/50"
                }`}
              >
                <MessageSquare class="w-4 h-4 sm:w-5 sm:h-5 mb-1 sm:mb-2 text-[var(--color-accent)]" />
                <div class="text-xs sm:text-sm font-medium">{t("onboarding.modeSingle")}</div>
                <div class="text-xs text-[var(--color-text-muted)] mt-0.5 sm:mt-1 hidden sm:block">
                  {t("onboarding.modeSingleDesc")}
                </div>
              </button>
              <button
                type="button"
                onClick={() => onModeChange("multi")}
                class={`p-2 sm:p-4 rounded-lg border-2 text-left transition-colors ${
                  selectedMode === "multi"
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                    : "border-[var(--color-border)] hover:border-[var(--color-accent)]/50"
                }`}
              >
                <LayoutGrid class="w-4 h-4 sm:w-5 sm:h-5 mb-1 sm:mb-2 text-[var(--color-accent)]" />
                <div class="text-xs sm:text-sm font-medium">{t("onboarding.modeMulti")}</div>
                <div class="text-xs text-[var(--color-text-muted)] mt-0.5 sm:mt-1 hidden sm:block">
                  {t("onboarding.modeMultiDesc")}
                </div>
              </button>
            </div>
          </div>

          {/* Canvas Node Option */}
          <div class="mb-4 sm:mb-6">
            <button
              type="button"
              onClick={() => {
                const newValue = !canvasNodeEnabled.value;
                canvasNodeEnabled.value = newValue;
                if (newValue) {
                  startNodeConnection();
                } else {
                  stopNodeConnection();
                }
              }}
              class={`w-full p-3 sm:p-4 rounded-lg border-2 text-left transition-colors flex items-start gap-3 ${
                canvasNodeEnabled.value
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                  : "border-[var(--color-border)] hover:border-[var(--color-accent)]/50"
              }`}
            >
              <MonitorPlay class="w-5 h-5 flex-shrink-0 text-[var(--color-accent)]" />
              <div class="flex-1">
                <div class="text-xs sm:text-sm font-medium">{t("onboarding.canvasTitle")}</div>
                <div class="text-xs text-[var(--color-text-muted)] mt-0.5 sm:mt-1">
                  {t("onboarding.canvasDesc")}
                </div>
              </div>
              <div
                class={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                  canvasNodeEnabled.value
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
                    : "border-[var(--color-border)]"
                }`}
              >
                {canvasNodeEnabled.value && <Check class="w-3 h-3 text-white" />}
              </div>
            </button>
          </div>

          <div class="mb-4 sm:mb-6">
            <Toggle
              checked={showTour}
              onChange={onShowTourChange}
              label={t("onboarding.showFeatureTour")}
              size="sm"
            />
          </div>

          <Button
            variant="primary"
            onClick={onContinue}
            fullWidth
            iconRight={<ArrowRight class="w-4 h-4" />}
          >
            {showTour ? t("actions.continue") : t("onboarding.startChatting")}
          </Button>
        </>
      )}

      {!connecting && !connected && error && (
        <>
          <StatusIcon variant="error" size="sm" class="mx-auto mb-3 sm:mb-4" />
          <h2 class="text-base sm:text-lg font-semibold mb-1 sm:mb-2">{t("onboarding.failed")}</h2>
          <p class="text-xs sm:text-sm text-[var(--color-error)] mb-3 sm:mb-4">{error}</p>

          <HintBox
            title={t("onboarding.failedHints")}
            items={[
              t("onboarding.hint1"),
              t("onboarding.hint2"),
              t("onboarding.hint3"),
              t("onboarding.hint4"),
            ]}
            class="text-left mb-4 sm:mb-6 text-xs sm:text-sm"
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
