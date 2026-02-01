/**
 * Sidebar
 *
 * Sessions list with management actions and navigation sections.
 */

import { useState } from "preact/hooks";
import { signal } from "@preact/signals";
import { route } from "preact-router";
import { t } from "@/lib/i18n";
import { log } from "@/lib/logger";
import { send, isConnected, mainSessionKey } from "@/lib/gateway";
import {
  activeSessionKey,
  updateSession,
  removeSessionAnimated,
  loadSessions,
} from "@/signals/sessions";
import { activeRuns, getStreamingRun } from "@/signals/chat";
import { newChatSettings, isMultiChatMode } from "@/signals/settings";
import { showNewChatModal } from "@/signals/ui";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { PlusIcon } from "@/components/ui/icons";
import { SessionRenameModal } from "@/components/sessions/SessionRenameModal";
import { SessionDeleteModal } from "@/components/sessions/SessionDeleteModal";
import { NewChatModal } from "@/components/chat/NewChatModal";
import { SessionFilters } from "./SessionFilters";
import { SessionList } from "./SessionList";
import { NavSections } from "./NavSection";
import type { Session } from "@/types/sessions";

// Track current path for active state (updated by router)
export const currentPath = signal<string>(window.location.pathname);

export function Sidebar() {
  const [renameSession, setRenameSession] = useState<Session | null>(null);
  const [deleteSession, setDeleteSession] = useState<Session | null>(null);

  /**
   * Handle session rename
   */
  const handleRename = async (session: Session, newLabel: string) => {
    try {
      await send("sessions.patch", {
        key: session.key,
        label: newLabel,
      });
      updateSession(session.key, { label: newLabel });
    } catch (err) {
      log.ui.error("Failed to rename session:", err);
      throw err;
    }
  };

  /**
   * Handle session delete
   */
  const handleDelete = async (session: Session) => {
    try {
      await send("sessions.delete", {
        key: session.key,
      });

      // Animate out then remove
      await removeSessionAnimated(session.key);

      // If we deleted the active session, go back to main
      if (activeSessionKey.value === session.key) {
        route("/chat");
      }
    } catch (err) {
      log.ui.error("Failed to delete session:", err);
      throw err;
    }
  };

  /**
   * Handle new chat button click
   */
  const handleNewChat = () => {
    if (newChatSettings.value.useDefaults) {
      // Create immediately with defaults
      createNewChat(newChatSettings.value.defaultAgentId);
    } else {
      // Show modal for agent selection
      showNewChatModal.value = true;
    }
  };

  /**
   * Create a new chat session
   */
  const createNewChat = async (agentId: string) => {
    const uuid = crypto.randomUUID();
    const sessionKey = `agent:${agentId}:chat:${uuid}`;

    try {
      // Create session with initial label
      await send("sessions.patch", {
        key: sessionKey,
        label: t("newChatModal.title"),
      });

      // Refresh session list so new chat appears in sidebar
      await loadSessions();

      // Navigate to new chat
      route(`/chat/${encodeURIComponent(sessionKey)}`);
    } catch (err) {
      log.ui.error("Failed to create new chat:", err);
    }
  };

  return (
    <div class="h-full flex flex-col">
      {/* Multi-chat mode: New Chat button + Sessions list */}
      {isMultiChatMode.value ? (
        <>
          {/* New Chat button */}
          <div class="p-3">
            <Button
              variant="primary"
              disabled={!isConnected.value}
              onClick={handleNewChat}
              fullWidth
              icon={<PlusIcon />}
            >
              {t("actions.newChat")}
            </Button>
          </div>

          {/* Sessions section - scrollable */}
          <div class="flex-1 overflow-y-auto px-3 pb-3" data-tour="sessions">
            <SessionFilters />
            <SessionList onRename={setRenameSession} onDelete={setDeleteSession} />
          </div>

          {/* Navigation sections - pinned to bottom */}
          <NavSections />
        </>
      ) : (
        <SingleChatSidebar />
      )}

      {/* Modals (only needed in multi-chat mode, but harmless to keep) */}
      <SessionRenameModal
        session={renameSession}
        onClose={() => setRenameSession(null)}
        onRename={handleRename}
      />
      <SessionDeleteModal
        session={deleteSession}
        onClose={() => setDeleteSession(null)}
        onDelete={handleDelete}
      />
      <NewChatModal
        open={showNewChatModal.value}
        onClose={() => (showNewChatModal.value = false)}
        onCreate={createNewChat}
      />
    </div>
  );
}

/**
 * Single-chat mode sidebar content
 * Separate component to properly subscribe to activeRuns signal changes
 */
function SingleChatSidebar() {
  // Force subscription to activeRuns changes by reading .value
  // This ensures re-render when streaming state changes
  void activeRuns.value;

  // Now use the shared helper to check streaming state
  const mainKey = mainSessionKey.value;
  const isMainStreaming = mainKey ? !!getStreamingRun(mainKey) : false;

  return (
    <div class="flex-1 overflow-y-auto">
      {/* Chat link at top */}
      <div class="px-3 py-2">
        <button
          type="button"
          onClick={() => route("/chat")}
          class={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-200 ease-out bg-[var(--color-accent)]/10 text-[var(--color-accent)] shadow-soft-sm ${isMainStreaming ? "ai-glow" : ""}`}
        >
          {isMainStreaming ? (
            <Spinner size="xs" class="flex-shrink-0 text-[var(--color-accent)]" />
          ) : (
            <span class="w-5 h-5 flex-shrink-0">💬</span>
          )}
          {t("nav.chat")}
        </button>
      </div>

      {/* All nav sections - expanded */}
      <NavSections expanded />
    </div>
  );
}
