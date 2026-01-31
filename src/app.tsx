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
import { initStorage, getAuth } from "@/lib/storage";
import { isConnected, connect } from "@/lib/gateway";
import { initChat } from "@/lib/chat";
import { setActiveSession, loadSessions } from "@/signals/sessions";
import { loadAssistantIdentity } from "@/signals/identity";

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

// Initialize storage synchronously so we can check saved auth immediately
initStorage();

// Check saved auth BEFORE first render (prevents flash)
const savedAuth = getAuth();
const hasSavedAuth = signal(!!(savedAuth?.url && savedAuth.rememberMe));
const authChecked = signal(false);

export function App() {
  // Initialize remaining systems on mount
  useEffect(() => {
    initTheme();
    initI18n();

    tryAutoConnect().finally(() => {
      authChecked.value = true;
    });
  }, []);

  // Show login only if:
  // - No saved auth, OR
  // - Auth check complete and connection failed
  // Key: only read isConnected AFTER authChecked to prevent re-render during initial connect
  let showLogin = !hasSavedAuth.value;
  if (!showLogin && authChecked.value) {
    showLogin = !isConnected.value;
  }

  return (
    <>
      <ErrorBoundary
        onError={(error) => {
          toast.error(`Error: ${error.message}`);
        }}
      >
        <AppShell>{showLogin ? <LoginView /> : <MainRouter />}</AppShell>
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

    // Load assistant identity
    await loadAssistantIdentity();

    // Initialize chat with main session
    setActiveSession("main");
    await initChat("main");
  } catch {
    // User will see the login form
  }
}
