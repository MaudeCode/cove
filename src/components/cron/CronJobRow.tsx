/**
 * CronJobRow
 *
 * Table row component for displaying a cron job.
 */

import { t } from "@/lib/i18n";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { Clock, Calendar, Timer, Play, CheckCircle, XCircle } from "lucide-preact";
import type { CronJob } from "@/types/cron";
import { formatSchedule, formatNextRun, getJobStatusBadge } from "./cron-helpers";

interface CronJobRowProps {
  job: CronJob;
  onEdit: (job: CronJob) => void;
  onRun: (job: CronJob) => void;
  onToggleEnabled: (job: CronJob) => void;
  isRunning: boolean;
}

export function CronJobRow({ job, onEdit, onRun, onToggleEnabled, isRunning }: CronJobRowProps) {
  const status = getJobStatusBadge(job);

  return (
    <tr
      class="group hover:bg-[var(--color-bg-hover)] cursor-pointer transition-colors"
      onClick={() => onEdit(job)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit(job);
        }
      }}
      tabIndex={0}
      aria-label={t("cron.editJob", { name: job.name })}
    >
      {/* Name & Description */}
      <td class="py-3 px-4">
        <div class="flex items-center gap-3">
          <div
            class={`p-1.5 rounded-lg flex-shrink-0 ${
              job.enabled ? "bg-[var(--color-success)]/10" : "bg-[var(--color-bg-tertiary)]"
            }`}
          >
            <Clock
              class={`w-4 h-4 ${
                job.enabled ? "text-[var(--color-success)]" : "text-[var(--color-text-muted)]"
              }`}
            />
          </div>
          <div class="min-w-0 flex-1">
            <div class="font-medium truncate" title={job.name}>
              {job.name}
            </div>
            {job.description && (
              <div class="text-xs text-[var(--color-text-muted)] truncate" title={job.description}>
                {job.description}
              </div>
            )}
          </div>
        </div>
      </td>

      {/* Schedule */}
      <td class="py-3 px-4">
        <div class="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
          <Calendar class="w-3.5 h-3.5 flex-shrink-0" />
          <span class="truncate" title={formatSchedule(job.schedule)}>
            {formatSchedule(job.schedule)}
          </span>
        </div>
      </td>

      {/* Target */}
      <td class="py-3 px-4">
        <Badge variant={job.sessionTarget === "main" ? "success" : "default"} size="sm">
          {job.sessionTarget}
        </Badge>
      </td>

      {/* Next Run */}
      <td class="py-3 px-4 whitespace-nowrap">
        <div class="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
          <Timer class="w-3.5 h-3.5 flex-shrink-0" />
          <span>{formatNextRun(job)}</span>
        </div>
      </td>

      {/* Status */}
      <td class="py-3 px-4">
        <Badge variant={status.variant} size="sm">
          {status.label}
        </Badge>
      </td>

      {/* Actions */}
      <td class="py-3 px-4">
        <div class="flex items-center gap-1">
          <IconButton
            icon={<Play class="w-4 h-4" />}
            label={t("cron.runNow")}
            size="sm"
            variant="ghost"
            disabled={isRunning}
            onClick={(e) => {
              e.stopPropagation();
              onRun(job);
            }}
          />
          <IconButton
            icon={job.enabled ? <XCircle class="w-4 h-4" /> : <CheckCircle class="w-4 h-4" />}
            label={job.enabled ? t("cron.disable") : t("cron.enable")}
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onToggleEnabled(job);
            }}
            class={job.enabled ? "text-[var(--color-text-muted)]" : "text-[var(--color-success)]"}
          />
        </div>
      </td>
    </tr>
  );
}
