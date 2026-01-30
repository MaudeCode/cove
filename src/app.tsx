/**
 * Main App Component
 *
 * Phase 1.1 - Layout Shell
 */

import { useEffect } from "preact/hooks";
import { initTheme } from "@/lib/theme";
import { initI18n } from "@/lib/i18n";
import { isConnected, connect } from "@/lib/gateway";
import { initChat } from "@/lib/chat";
import { setActiveSession } from "@/signals/sessions";
import { activeView } from "@/signals/ui";

import { AppShell } from "@/components/layout";
import { ChatView, LoginView, CronView, ConfigView, StatusView } from "@/views";

export function App() {
  // Initialize systems on mount
  useEffect(() => {
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
  const savedUrl = localStorage.getItem("cove:gateway-url");
  const savedMode = localStorage.getItem("cove:auth-mode") as "token" | "password" | null;
  const savedCred = localStorage.getItem("cove:auth-credential");

  if (!savedUrl) return;

  try {
    await connect({
      url: savedUrl,
      token: savedMode === "token" ? (savedCred ?? undefined) : undefined,
      password: savedMode === "password" ? (savedCred ?? undefined) : undefined,
      autoReconnect: true,
    });

    // Initialize chat with main session
    setActiveSession("main");
    await initChat("main");
  } catch (err) {
    console.warn("Auto-connect failed:", err);
    // User will see the login form
  }
}
