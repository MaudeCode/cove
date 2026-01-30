/**
 * Main App Component
 *
 * Uses preact-router for URL-based navigation.
 */

import { useEffect } from "preact/hooks";
import Router from "preact-router";
import { initTheme } from "@/lib/theme";
import { initI18n } from "@/lib/i18n";
import { initStorage, getAuth } from "@/lib/storage";
import { isConnected, connect } from "@/lib/gateway";
import { initChat } from "@/lib/chat";
import { setActiveSession, loadSessions } from "@/signals/sessions";

import { AppShell, currentPath } from "@/components/layout";
import { ToastContainer, ErrorBoundary, toast } from "@/components/ui";
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
} from "@/views";

export function App() {
  // Initialize systems on mount
  useEffect(() => {
    initStorage();
    initTheme();
    initI18n();
    tryAutoConnect();
  }, []);

  return (
    <>
      <ErrorBoundary
        onError={(error) => {
          toast.error(`Error: ${error.message}`);
        }}
      >
        <AppShell>{isConnected.value ? <MainRouter /> : <LoginView />}</AppShell>
      </ErrorBoundary>
      <ToastContainer position="top-right" />
    </>
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

    // Initialize chat with main session
    setActiveSession("main");
    await initChat("main");
  } catch {
    // User will see the login form
  }
}
