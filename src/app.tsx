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
import { initStorage, getAuth, hasCompletedOnboarding, consumePendingTour } from "@/lib/storage";
import { isConnected, connect, connectionState } from "@/lib/gateway";
import { initChat } from "@/lib/chat/init";
import { setActiveSession, loadSessions } from "@/signals/sessions";
import { loadAssistantIdentity } from "@/signals/identity";
import { startUsagePolling } from "@/signals/usage";
import { loadModels } from "@/signals/models";
import { loadAgents } from "@/signals/agents";

import { AppShell } from "@/components/layout/AppShell";
import { currentPath } from "@/components/layout/Sidebar";
import { previousRoute } from "@/signals/ui";
import { ToastContainer, toast } from "@/components/ui/Toast";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ChatView } from "@/views/ChatView";
import { LoginView } from "@/views/LoginView";
import { StatusView as OverviewView } from "@/views/StatusView";
import { CronView } from "@/views/CronView";
import { ConfigView } from "@/views/ConfigView";
import { SettingsView } from "@/views/SettingsView";
import {
  ChannelsView,
  InstancesView,
  SkillsView,
  NodesView,
  DebugView,
  LogsView,
  StatsView,
} from "@/views/PlaceholderView";
import { SessionsAdminView } from "@/views/SessionsAdminView";
import { WelcomeWizard } from "@/components/onboarding/WelcomeWizard";
import { SpotlightTour } from "@/components/tour/SpotlightTour";
import { getTourSteps } from "@/lib/tour-steps";
import { appMode } from "@/signals/settings";

// Initialize storage synchronously so we can check saved auth immediately
initStorage();

// Check saved auth BEFORE first render (prevents flash)
const savedAuth = getAuth();
const hasSavedAuth = signal(!!(savedAuth?.url && savedAuth.rememberMe));
const authChecked = signal(false);
const showOnboarding = signal(!hasCompletedOnboarding() && !savedAuth?.url);
const showTour = signal(false);

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
    // Check if user opted for the tour
    if (consumePendingTour()) {
      // Small delay to let the main UI render first
      setTimeout(() => {
        showTour.value = true;
      }, 500);
    }
  };

  const handleOnboardingSkip = () => {
    showOnboarding.value = false;
  };

  const handleTourComplete = () => {
    showTour.value = false;
  };

  // Determine which view to show
  // When reconnecting, keep showing the main router (with disabled input via ConnectionBanner)
  // Only show LoginView when truly disconnected (not reconnecting)
  const isReconnecting = connectionState.value === "reconnecting";
  const showLogin =
    !showOnboarding.value &&
    !isReconnecting &&
    (authChecked.value ? !isConnected.value : !hasSavedAuth.value);

  let content;
  if (showOnboarding.value) {
    content = <WelcomeWizard onComplete={handleOnboardingComplete} onSkip={handleOnboardingSkip} />;
  } else if (showLogin) {
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

      {/* Spotlight tour overlay */}
      {showTour.value && (
        <SpotlightTour steps={getTourSteps(appMode.value)} onComplete={handleTourComplete} />
      )}
    </TooltipProvider>
  );
}

/**
 * Handle route changes - sync to signal for sidebar active state
 */
function handleRouteChange(e: { url: string }) {
  // Track previous route for "back" navigation (e.g., settings toggle)
  // Only update if navigating TO settings from a non-settings page
  if (e.url === "/settings" && currentPath.value !== "/settings") {
    previousRoute.value = currentPath.value;
  }
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
      <StatsView path="/stats" />
      <ChannelsView path="/channels" />
      <InstancesView path="/instances" />
      <SessionsAdminView path="/sessions" />
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

    // Load available agents
    await loadAgents();

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
