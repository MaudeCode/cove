/**
 * SessionList
 *
 * Session list with time-based grouping.
 */

import { route } from "preact-router";
import { t } from "@/lib/i18n";
import { hasContent } from "@/lib/utils";
import { isMainSession } from "@/lib/session-utils";
import {
  effectiveSessionKey,
  sessionsGrouped,
  sessionsByRecent,
  sessionSearchQuery,
} from "@/signals/sessions";
import type { TimeGroup } from "@/lib/session-utils";
import type { Session } from "@/types/sessions";
import { SessionItem } from "@/components/sessions/SessionItem";
import { currentPath } from "./Sidebar";

interface SessionListProps {
  onRename: (session: Session) => void;
  onDelete: (session: Session) => void;
}

const timeGroupLabels: Record<TimeGroup, string> = {
  pinned: "sessions.pinned",
  today: "sessions.today",
  yesterday: "sessions.yesterday",
  thisWeek: "sessions.thisWeek",
  older: "sessions.older",
};

const timeGroupOrder: TimeGroup[] = ["pinned", "today", "yesterday", "thisWeek", "older"];

export function SessionList({ onRename, onDelete }: SessionListProps) {
  const groups = sessionsGrouped.value;
  const hasResults = sessionsByRecent.value.length > 0;
  const hasSearch = hasContent(sessionSearchQuery.value);

  if (!hasResults) {
    return (
      <p class="text-sm text-[var(--color-text-muted)] px-2 py-4">
        {hasSearch ? t("sessions.noResults") : t("sessions.noSessions")}
      </p>
    );
  }

  // If searching, show flat list (no groups)
  if (hasSearch) {
    return (
      <ul class="space-y-0.5">
        {sessionsByRecent.value.map((session) => (
          <li key={session.key}>
            <SessionItem
              session={session}
              isActive={
                effectiveSessionKey.value === session.key && currentPath.value.startsWith("/chat")
              }
              isMain={isMainSession(session.key)}
              onClick={() => route(`/chat/${encodeURIComponent(session.key)}`)}
              onRename={onRename}
              onDelete={onDelete}
            />
          </li>
        ))}
      </ul>
    );
  }

  // Show grouped list
  return (
    <div class="space-y-3">
      {timeGroupOrder.map((groupKey) => {
        const sessions = groups.get(groupKey);
        if (!sessions || sessions.length === 0) return null;

        // Don't show "Pinned" header for main session
        const showHeader = groupKey !== "pinned";

        return (
          <div key={groupKey}>
            {showHeader && (
              <h4 class="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider px-2 py-1">
                {t(timeGroupLabels[groupKey])}
              </h4>
            )}
            <ul class="space-y-0.5">
              {sessions.map((session) => (
                <li key={session.key}>
                  <SessionItem
                    session={session}
                    isActive={
                      effectiveSessionKey.value === session.key &&
                      currentPath.value.startsWith("/chat")
                    }
                    isMain={isMainSession(session.key)}
                    onClick={() => route(`/chat/${encodeURIComponent(session.key)}`)}
                    onRename={onRename}
                    onDelete={onDelete}
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
