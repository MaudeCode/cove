/**
 * Main App Component
 *
 * Phase 1.1 - Layout Shell
 */

import { useEffect } from "preact/hooks";
import { initTheme } from "@/lib/theme";
import { initI18n } from "@/lib/i18n";
import { initStorage, getAuth } from "@/lib/storage";
import { isConnected, connect } from "@/lib/gateway";
import { initChat } from "@/lib/chat";
import { setActiveSession, loadSessions } from "@/signals/sessions";
import { activeView } from "@/signals/ui";

import { AppShell } from "@/components/layout";
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
        <AppShell>{isConnected.value ? <MainContent /> : <LoginView />}</AppShell>
      </ErrorBoundary>
      <ToastContainer position="top-right" />
    </>
  );
}

/**
 * Main content router based on activeView signal
 */
function MainContent() {
  switch (activeView.value) {
    // Chat
    case "chat":
      return <ChatView />;

    // Control
    case "overview":
      return <OverviewView />;
    case "channels":
      return <ChannelsView />;
    case "instances":
      return <InstancesView />;
    case "sessions":
      return <SessionsView />;
    case "cron":
      return <CronView />;

    // Agent
    case "skills":
      return <SkillsView />;
    case "nodes":
      return <NodesView />;

    // Settings
    case "config":
      return <ConfigView />;
    case "debug":
      return <DebugView />;
    case "logs":
      return <LogsView />;

    default:
      return <ChatView />;
  }
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
