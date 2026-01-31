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
import { send, isConnected } from "@/lib/gateway";
import { activeSessionKey, updateSession, removeSessionAnimated } from "@/signals/sessions";
import { Button, PlusIcon } from "@/components/ui";
import { SessionRenameModal, SessionDeleteModal } from "@/components/sessions";
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

  return (
    <div class="h-full flex flex-col">
      {/* New Chat button */}
      <div class="p-3">
        <Button
          variant="primary"
          disabled={!isConnected.value}
          onClick={() => route("/chat")}
          fullWidth
          icon={<PlusIcon />}
        >
          {t("actions.newChat")}
        </Button>
      </div>

      {/* Sessions section - scrollable */}
      <div class="flex-1 overflow-y-auto px-3 pb-3">
        <SessionFilters />
        <SessionList onRename={setRenameSession} onDelete={setDeleteSession} />
      </div>

      {/* Navigation sections - pinned to bottom */}
      <NavSections />

      {/* Modals */}
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
    </div>
  );
}
