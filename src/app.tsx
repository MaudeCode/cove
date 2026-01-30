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
import { setActiveSession } from "@/signals/sessions";
import { activeView } from "@/signals/ui";

import { AppShell } from "@/components/layout";
import { ChatView, LoginView, CronView, ConfigView, StatusView } from "@/views";

export function App() {
  // Initialize systems on mount
  useEffect(() => {
    initStorage();
    initTheme();
    initI18n();
    tryAutoConnect();
  }, []);

  return <AppShell>{isConnected.value ? <MainContent /> : <LoginView />}</AppShell>;
}

/**
 * Main content router based on activeView signal
 */
function MainContent() {
  switch (activeView.value) {
    case "chat":
      return <ChatView />;
    case "cron":
      return <CronView />;
    case "config":
      return <ConfigView />;
    case "status":
      return <StatusView />;
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

    // Initialize chat with main session
    setActiveSession("main");
    await initChat("main");
  } catch {
    // User will see the login form
  }
}
