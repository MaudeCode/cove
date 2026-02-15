/**
 * Cron tool blocks
 */

import { Link } from "preact-router/match";
import { t, formatTimestamp } from "@/lib/i18n";
import { formatSchedule } from "@/components/cron/cron-helpers";
import type { CronSchedule } from "@/types/cron";
import { parseResult } from "./utils";
import { CodeBlock } from "./CodeBlock";
import { ToolInputContainer, ToolBadge, ToolOutputContainer } from "./shared";

/** Safely format schedule, handling API response variations */
function safeFormatSchedule(schedule: unknown): string {
  if (!schedule || typeof schedule !== "object") return "";
  const s = schedule as Record<string, unknown>;

  // API sometimes returns "at" as ISO string instead of "atMs" as number
  if (s.kind === "at" && typeof s.at === "string") {
    return `Once at ${formatTimestamp(new Date(s.at as string).getTime(), { relative: true })}`;
  }

  try {
    return formatSchedule(schedule as CronSchedule);
  } catch {
    return String(s.kind || "");
  }
}

// ============================================
// Input Block
// ============================================

interface CronInputBlockProps {
  args: Record<string, unknown>;
}

export function CronInputBlock({ args }: CronInputBlockProps) {
  const action = args.action as string;
  const jobId = args.jobId as string | undefined;
  const job = args.job as Record<string, unknown> | undefined;
  const jobName = job?.name as string | undefined;
  const patch = args.patch as Record<string, unknown> | undefined;

  // Format action display
  const actionLabels: Record<string, string> = {
    list: t("cron.actions.list"),
    add: t("cron.actions.add"),
    update: t("cron.actions.update"),
    remove: t("cron.actions.remove"),
    run: t("cron.actions.run"),
    runs: t("cron.actions.runs"),
    status: t("cron.actions.status"),
    wake: t("cron.actions.wake"),
  };

  const actionIcons: Record<string, string> = {
    list: "📋",
    add: "➕",
    update: "✏️",
    remove: "🗑️",
    run: "▶️",
    runs: "📊",
    status: "📡",
    wake: "⏰",
  };

  const icon = actionIcons[action] || "⏰";
  const label = actionLabels[action] || action;

  // For add action, show more job details
  if (action === "add" && job) {
    const schedule = job.schedule as Record<string, unknown> | undefined;
    const sessionTarget = job.sessionTarget as string | undefined;

    return (
      <div class="space-y-1">
        <ToolInputContainer inline>
          <span class="sr-only">{t("toolInput.cronAction")}: </span>
          <span>
            {icon} {label}
          </span>
          {jobName && <ToolBadge>{jobName}</ToolBadge>}
        </ToolInputContainer>
        <div class="text-xs text-[var(--color-text-muted)] pl-1 flex flex-wrap gap-x-3">
          {schedule && (
            <span>
              {schedule.kind === "cron" && `🕐 ${schedule.expr}`}
              {schedule.kind === "every" && `🔄 Every ${(schedule.everyMs as number) / 1000}s`}
              {schedule.kind === "at" && `📅 One-time`}
            </span>
          )}
          {sessionTarget && <span>→ {sessionTarget}</span>}
        </div>
      </div>
    );
  }

  return (
    <ToolInputContainer inline>
      <span class="sr-only">{t("toolInput.cronAction")}: </span>
      <span>
        {icon} {label}
      </span>
      {(jobId || jobName) && <ToolBadge>{jobName || jobId?.slice(0, 8) || ""}</ToolBadge>}
      {patch && Object.keys(patch).length > 0 && (
        <span class="text-[var(--color-text-muted)]">({Object.keys(patch).join(", ")})</span>
      )}
    </ToolInputContainer>
  );
}

// ============================================
// Result Block
// ============================================

interface CronJob {
  id?: string;
  name?: string;
  enabled?: boolean;
  schedule?: CronSchedule;
  sessionTarget?: string;
  state?: {
    nextRunAtMs?: number;
    lastRunAtMs?: number;
    lastStatus?: string;
  };
}

interface CronListResult {
  jobs?: CronJob[];
}

interface CronJobResult {
  id?: string;
  name?: string;
  enabled?: boolean;
}

interface CronStatusResult {
  enabled?: boolean;
  jobs?: number;
  nextWakeAtMs?: number;
  storePath?: string;
}

interface CronRunEntry {
  ts?: number;
  action?: string;
  status?: string;
  summary?: string;
  durationMs?: number;
  runAtMs?: number;
}

interface CronRunsResult {
  entries?: CronRunEntry[];
}

export function CronResultBlock({ result }: { result: unknown }) {
  const data = parseResult<CronListResult | CronJobResult | CronStatusResult | CronRunsResult>(
    result,
  );

  // Handle scheduler status
  if (data && "enabled" in data && "nextWakeAtMs" in data) {
    const status = data as CronStatusResult;
    return (
      <div class="text-xs p-2 rounded-md bg-[var(--color-bg-tertiary)] space-y-1">
        <div class="flex items-center gap-2">
          <span
            class={`w-2 h-2 rounded-full ${status.enabled ? "bg-[var(--color-success)]" : "bg-[var(--color-text-muted)]"}`}
          />
          <span class="font-medium">
            {status.enabled ? t("common.enabled") : t("common.disabled")}
          </span>
          {typeof status.jobs === "number" && (
            <span class="text-[var(--color-text-muted)]">
              • {t("cron.jobCount", { count: status.jobs })}
            </span>
          )}
        </div>
        {status.nextWakeAtMs && (
          <div class="text-[var(--color-text-muted)]">
            {t("cron.stats.nextWake")}: {formatTimestamp(status.nextWakeAtMs, { relative: true })}
          </div>
        )}
      </div>
    );
  }

  // Handle run history
  if (data && "entries" in data && Array.isArray(data.entries)) {
    const entries = (data.entries as CronRunEntry[]).slice(0, 5); // Show last 5

    if (entries.length === 0) {
      return <ToolOutputContainer>{t("cron.noRuns")}</ToolOutputContainer>;
    }

    return (
      <div class="space-y-1">
        <div class="text-xs text-[var(--color-text-muted)] px-1">
          {t("cron.recentRuns")} ({entries.length})
        </div>
        {entries.map((entry, i) => (
          <div
            key={entry.ts ?? i}
            class="flex items-center gap-2 text-xs p-2 rounded-md bg-[var(--color-bg-tertiary)]"
          >
            <span
              class={`w-2 h-2 rounded-full flex-shrink-0 ${
                entry.status === "ok"
                  ? "bg-[var(--color-success)]"
                  : entry.status === "error"
                    ? "bg-[var(--color-error)]"
                    : "bg-[var(--color-text-muted)]"
              }`}
            />
            {entry.runAtMs && (
              <span class="text-[var(--color-text-muted)]">
                {formatTimestamp(entry.runAtMs, { relative: true })}
              </span>
            )}
            {entry.durationMs && (
              <span class="text-[var(--color-text-muted)]">
                ({Math.round(entry.durationMs / 1000)}s)
              </span>
            )}
            {entry.summary && (
              <span class="truncate flex-1 text-[var(--color-text-primary)]" title={entry.summary}>
                {entry.summary.split("\n")[0].slice(0, 60)}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Handle jobs list
  if (data && "jobs" in data && Array.isArray(data.jobs)) {
    const jobs = data.jobs as CronJob[];

    if (jobs.length === 0) {
      return <ToolOutputContainer>{t("cron.noJobs")}</ToolOutputContainer>;
    }

    return (
      <div class="space-y-1">
        <div class="text-xs text-[var(--color-text-muted)] px-1">
          {t("cron.jobCount", { count: jobs.length })}
        </div>
        {jobs.map((job) => (
          <div
            key={job.id}
            class="flex items-center gap-2 text-xs p-2 rounded-md bg-[var(--color-bg-tertiary)]"
          >
            <span
              class={`w-2 h-2 rounded-full flex-shrink-0 ${
                job.enabled ? "bg-[var(--color-success)]" : "bg-[var(--color-text-muted)]"
              }`}
            />
            <span class="font-medium text-[var(--color-text-primary)] truncate flex-1">
              {job.name || job.id?.slice(0, 8)}
            </span>
            {job.schedule && (
              <span class="text-[var(--color-text-muted)] font-mono text-[10px]">
                {safeFormatSchedule(job.schedule)}
              </span>
            )}
            {job.state?.nextRunAtMs && (
              <span class="text-[var(--color-accent)] text-[10px]">
                {formatTimestamp(job.state.nextRunAtMs, { relative: true })}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Handle single job result (add/update) - show full details
  if (data && ("id" in data || "name" in data) && !("ok" in data)) {
    const job = data as CronJob & {
      id?: string;
      sessionTarget?: string;
      wakeMode?: string;
      deleteAfterRun?: boolean;
      delivery?: { mode?: string };
    };
    return (
      <div class="text-xs p-2 rounded-md bg-[var(--color-bg-tertiary)] space-y-2">
        {/* Header with name and status */}
        <div class="flex items-center gap-2">
          <span
            class={`w-2 h-2 rounded-full ${job.enabled ? "bg-[var(--color-success)]" : "bg-[var(--color-text-muted)]"}`}
          />
          <span class="font-medium text-[var(--color-text-primary)]">
            {job.name || job.id?.slice(0, 8)}
          </span>
          <Link
            {...{ href: `/cron?job=${job.id}` }}
            class="text-[var(--color-accent)] hover:underline ml-auto"
          >
            {t("actions.view")}
          </Link>
        </div>

        {/* Details grid */}
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-[var(--color-text-muted)]">
          {job.schedule && (
            <>
              <span>{t("cron.columns.schedule")}:</span>
              <span class="font-mono">{safeFormatSchedule(job.schedule)}</span>
            </>
          )}
          {job.sessionTarget && (
            <>
              <span>{t("cron.form.sessionTarget")}:</span>
              <span>{job.sessionTarget}</span>
            </>
          )}
          {job.delivery?.mode && (
            <>
              <span>{t("cron.form.announceResults")}:</span>
              <span>{job.delivery.mode === "announce" ? "✓" : "—"}</span>
            </>
          )}
          {job.deleteAfterRun && (
            <>
              <span>{t("cron.scheduleKind.at")}:</span>
              <span>✓</span>
            </>
          )}
        </div>

        {job.state?.nextRunAtMs && (
          <div class="text-[var(--color-text-muted)] pt-1 border-t border-[var(--color-border)]">
            {t("cron.stats.nextWake")}: {formatTimestamp(job.state.nextRunAtMs, { relative: true })}
          </div>
        )}
      </div>
    );
  }

  // Handle simple success (wake, run, remove)
  if (data && "ok" in data && (data as { ok?: boolean }).ok === true) {
    const d = data as { ok: boolean; ran?: boolean; removed?: boolean };
    let label = t("common.success");
    if (d.ran) label = t("cron.jobTriggered");
    if (d.removed) label = t("cron.jobRemoved");
    return (
      <ToolOutputContainer>
        <span class="text-[var(--color-success)]">✓ {label}</span>
      </ToolOutputContainer>
    );
  }

  return <CodeBlock content={result} maxLines={20} />;
}
