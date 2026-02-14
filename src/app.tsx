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
import {
  initStorage,
  getAuth,
  getSessionCredential,
  setSessionCredential,
  hasCompletedOnboarding,
  consumePendingTour,
} from "@/lib/storage";
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
import { initExecApproval } from "@/signals/exec";
import { ChatView } from "@/views/ChatView";
import { LoginView } from "@/views/LoginView";
import { StatusView as OverviewView } from "@/views/StatusView";
import { CronView } from "@/views/CronView";
import { ConfigView } from "@/views/ConfigView";
import { SettingsView } from "@/views/SettingsView";
import { DebugView } from "@/views/DebugView";
import { LogsView } from "@/views/LogsView";
import { DevicesView } from "@/views/DevicesView";
import { SkillsView } from "@/views/SkillsView";
import { AgentsView } from "@/views/agents";
import { WorkspaceEditorView as AgentFileEditorView } from "@/views/WorkspaceEditorView";
import { UsageView } from "@/views/UsageView";
import { ChannelsView } from "@/views/ChannelsView";
import { InstancesView } from "@/views/InstancesView";
import { SessionsAdminView } from "@/views/SessionsAdminView";
import { CanvasView } from "@/views/CanvasView";
import { WelcomeWizard } from "@/components/onboarding/WelcomeWizard";
import { SpotlightTour } from "@/components/tour/SpotlightTour";
import { getTourSteps } from "@/lib/tour-steps";
import { appMode } from "@/signals/settings";
import { CommandPalette, useCommandPaletteShortcut } from "@/components/command";

// Lazy-loaded CanvasPanel to avoid loading node-connection.ts on /canvas route
import type { ComponentType } from "preact";

const LazyCanvasPanelComponent = signal<ComponentType | null>(null);

function LazyCanvasPanel() {
  useEffect(() => {
    import("@/components/canvas/CanvasPanel").then((mod) => {
      LazyCanvasPanelComponent.value = mod.CanvasPanel;
    });
  }, []);

  const Component = LazyCanvasPanelComponent.value;
  return Component ? <Component /> : null;
}

// Initialize storage synchronously so we can check saved auth immediately
initStorage();

// Check saved auth BEFORE first render (prevents flash)
const savedAuth = getAuth();
const hasSavedAuth = signal(!!(savedAuth?.url && savedAuth.rememberMe));
const authChecked = signal(false);
const showOnboarding = signal(!hasCompletedOnboarding() && !savedAuth?.url);
const showTour = signal(false);
const tourSteps = signal<ReturnType<typeof getTourSteps> | null>(null);

export function App() {
  // Initialize remaining systems on mount
  useEffect(() => {
    initTheme();
    initI18n();

    tryAutoConnect().finally(() => {
      authChecked.value = true;
    });
  }, []);

  // Enable ⌘K / Ctrl+K to open command palette
  useCommandPaletteShortcut();

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
        // Capture steps at tour start (don't re-evaluate during tour)
        tourSteps.value = getTourSteps(appMode.value);
        showTour.value = true;
      }, 500);
    }
  };

  const handleOnboardingSkip = () => {
    showOnboarding.value = false;
  };

  const handleTourComplete = () => {
    showTour.value = false;
    tourSteps.value = null;
  };

  // Determine which view to show
  // When reconnecting, keep showing the main router (with disabled input via ConnectionBanner)
  // Only show LoginView when truly disconnected (not reconnecting)
  const isReconnecting = connectionState.value === "reconnecting";
  const showLogin =
    !showOnboarding.value &&
    !isReconnecting &&
    (authChecked.value ? !isConnected.value : !hasSavedAuth.value);

  // Check for standalone canvas view (no AppShell wrapper)
  const isCanvasRoute = window.location.pathname === "/canvas";
  if (isCanvasRoute) {
    return (
      <TooltipProvider>
        <ErrorBoundary onError={(error) => toast.error(`Error: ${error.message}`)}>
          <CanvasView />
        </ErrorBoundary>
      </TooltipProvider>
    );
  }

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

      {/* Command palette overlay */}
      <CommandPalette />

      {/* Canvas panel for agent-pushed content (lazy loaded) */}
      <LazyCanvasPanel />

      {/* Spotlight tour overlay */}
      {showTour.value && tourSteps.value && (
        <SpotlightTour steps={tourSteps.value} onComplete={handleTourComplete} />
      )}
    </TooltipProvider>
  );
}

/**
 * Handle route changes - sync to signal for sidebar active state
 */
function handleRouteChange(e: { url: string }) {
  // Strip query params for sidebar path matching only
  const pathOnly = e.url.split("?")[0];

  // Track previous route for "back" navigation (e.g., settings toggle)
  // Only update if navigating TO settings from a non-settings page
  if (pathOnly === "/settings" && !currentPath.value.startsWith("/settings")) {
    previousRoute.value = currentPath.value;
  }

  // Store path without query for sidebar active state
  // (sidebar matches /cron, not /cron?job=abc)
  currentPath.value = pathOnly;
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
      <UsageView path="/usage" />
      <ChannelsView path="/channels" />
      <InstancesView path="/instances" />
      <SessionsAdminView path="/sessions" />
      <CronView path="/cron" />

      {/* Agent */}
      <SkillsView path="/skills" />
      <AgentsView path="/agents" />
      <AgentFileEditorView path="/agents/edit/:filename" />
      <DevicesView path="/devices" />

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
 * Try to auto-connect using saved URL and session credential
 * SECURITY: Credentials are only stored in sessionStorage (cleared on tab close)
 */
async function tryAutoConnect() {
  const saved = getAuth();
  if (!saved?.url || !saved.rememberMe) return;

  // Get credential from session storage (only valid for current browser session)
  const credential = getSessionCredential();
  if (!credential) {
    // No session credential - user needs to re-enter on login form
    return;
  }

  try {
    await connect({
      url: saved.url,
      token: saved.authMode === "token" ? credential : undefined,
      password: saved.authMode === "password" ? credential : undefined,
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

    // Initialize exec approval listener
    initExecApproval();

    // Start node connection for canvas support (if enabled)
    import("@/signals/settings").then(({ canvasNodeEnabled }) => {
      if (canvasNodeEnabled.value) {
        import("@/lib/node-connection").then((mod) => mod.startNodeConnection());
      }
    });
  } catch {
    // Clear invalid session credential
    setSessionCredential("");
    // User will see the login form
  }
}
