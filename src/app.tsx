/**
 * Main App Component
 *
 * Uses preact-router for URL-based navigation.
 */

import { useEffect } from "preact/hooks";
import { signal } from "@preact/signals";
import Router from "preact-router";
import { initTheme } from "@/lib/theme";
import { initI18n } from "@/lib/i18n";
import { initStorage, getAuth, hasCompletedOnboarding } from "@/lib/storage";
import { isConnected, connect } from "@/lib/gateway";
import { initChat } from "@/lib/chat";
import { setActiveSession, loadSessions } from "@/signals/sessions";
import { loadAssistantIdentity } from "@/signals/identity";
import { startUsagePolling } from "@/signals/usage";
import { loadModels } from "@/signals/models";

import { AppShell, currentPath } from "@/components/layout";
import { ToastContainer, TooltipProvider, ErrorBoundary, toast } from "@/components/ui";
import {
  ChatView,
  LoginView,
  OverviewView,
  ChannelsView,
  InstancesView,
  SessionsView,
  CronView,
  SkillsView,
  NodesView,
  ConfigView,
  DebugView,
  LogsView,
  SettingsView,
} from "@/views";
import { WelcomeWizard } from "@/components/onboarding";

// Initialize storage synchronously so we can check saved auth immediately
initStorage();

// Check saved auth BEFORE first render (prevents flash)
const savedAuth = getAuth();
const hasSavedAuth = signal(!!(savedAuth?.url && savedAuth.rememberMe));
const authChecked = signal(false);
const showOnboarding = signal(!hasCompletedOnboarding() && !savedAuth?.url);

export function App() {
  // Initialize remaining systems on mount
  useEffect(() => {
    initTheme();
    initI18n();

    tryAutoConnect().finally(() => {
      authChecked.value = true;
    });
  }, []);

  // Determine what content to show
  // 1. First-run users without saved auth → onboarding wizard
  // 2. Not connected (after auth check) → login view
  // 3. Connected → main router

  const handleOnboardingComplete = () => {
    showOnboarding.value = false;
  };

  const handleOnboardingSkip = () => {
    showOnboarding.value = false;
  };

  // Determine which view to show
  let content;
  if (showOnboarding.value) {
    content = <WelcomeWizard onComplete={handleOnboardingComplete} onSkip={handleOnboardingSkip} />;
  } else if (authChecked.value ? !isConnected.value : !hasSavedAuth.value) {
    content = <LoginView />;
  } else {
    content = <MainRouter />;
  }

  return (
    <TooltipProvider>
      <ErrorBoundary
        onError={(error) => {
          toast.error(`Error: ${error.message}`);
        }}
      >
        {/* Always render AppShell - just change content inside */}
        <AppShell>{content}</AppShell>
      </ErrorBoundary>
      <ToastContainer position="top-right" />
    </TooltipProvider>
  );
}

/**
 * Handle route changes - sync to signal for sidebar active state
 */
function handleRouteChange(e: { url: string }) {
  currentPath.value = e.url;
}

/**
 * Main content router
 */
function MainRouter() {
  return (
    <Router onChange={handleRouteChange}>
      {/* Chat routes */}
      <ChatView path="/" />
      <ChatView path="/chat" />
      <ChatView path="/chat/:sessionKey" />

      {/* Control */}
      <OverviewView path="/overview" />
      <ChannelsView path="/channels" />
      <InstancesView path="/instances" />
      <SessionsView path="/sessions" />
      <CronView path="/cron" />

      {/* Agent */}
      <SkillsView path="/skills" />
      <NodesView path="/nodes" />

      {/* Settings */}
      <SettingsView path="/settings" />
      <ConfigView path="/config" />
      <DebugView path="/debug" />
      <LogsView path="/logs" />

      {/* Fallback */}
      <ChatView default />
    </Router>
  );
}

/**
 * Try to auto-connect using saved credentials
 */
async function tryAutoConnect() {
  const saved = getAuth();

  if (!saved?.url || !saved.rememberMe) return;

  try {
    await connect({
      url: saved.url,
      token: saved.authMode === "token" ? saved.credential : undefined,
      password: saved.authMode === "password" ? saved.credential : undefined,
      autoReconnect: true,
    });

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
  } catch {
    // User will see the login form
  }
}
