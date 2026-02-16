import { t } from "@/lib/i18n";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ChevronRight, Info } from "lucide-preact";
import {
  levelIcons,
  levelColors,
  formatLogTimestamp,
  formatRawLog,
  type ParsedLogLine,
  type LogLevel,
} from "@/components/logs";

interface LevelFilterProps {
  level: LogLevel;
  count: number;
  selected: boolean;
  onClick: () => void;
}

const levelStyles: Record<LogLevel, { active: string; inactive: string }> = {
  debug: {
    active:
      "bg-[var(--color-text-muted)]/30 text-[var(--color-text-primary)] ring-1 ring-[var(--color-text-muted)]",
    inactive:
      "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]",
  },
  info: {
    active: "bg-[var(--color-info)]/20 text-[var(--color-info)] ring-1 ring-[var(--color-info)]",
    inactive:
      "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]",
  },
  warn: {
    active:
      "bg-[var(--color-warning)]/20 text-[var(--color-warning)] ring-1 ring-[var(--color-warning)]",
    inactive:
      "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]",
  },
  error: {
    active: "bg-[var(--color-error)]/20 text-[var(--color-error)] ring-1 ring-[var(--color-error)]",
    inactive:
      "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]",
  },
};

const levelLabels: Record<LogLevel, string> = {
  debug: "common.debug",
  info: "logs.info",
  warn: "logs.warnings",
  error: "common.error",
};

export function LevelFilter({ level, count, selected, onClick }: LevelFilterProps) {
  const styles = levelStyles[level];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("logs.filterByLevel", { level: t(levelLabels[level]) })}
      aria-pressed={selected}
      class={`px-3 py-1 text-sm rounded-full transition-colors ${selected ? styles.active : styles.inactive}`}
    >
      {t(levelLabels[level])} ({count})
    </button>
  );
}

interface MobileLogModalProps {
  logId: number | null;
  lines: ParsedLogLine[];
  onClose: () => void;
}

export function MobileLogModal({ logId, lines, onClose }: MobileLogModalProps) {
  const line = logId !== null ? lines.find((l) => l.id === logId) : null;

  return (
    <Modal open={!!line} onClose={onClose} title={t("logs.logDetails")}>
      {line && (
        <div class="space-y-4">
          <div class="flex items-center gap-2">
            {line.level && (
              <Badge
                variant={
                  line.level === "error" ? "error" : line.level === "warn" ? "warning" : "default"
                }
              >
                {line.level}
              </Badge>
            )}
            {line.timestamp && (
              <span class="text-sm text-[var(--color-text-muted)] font-mono">{line.timestamp}</span>
            )}
          </div>

          <div>
            <h4 class="text-xs font-medium text-[var(--color-text-muted)] mb-1">
              {t("logs.message")}
            </h4>
            <p class="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap break-words">
              {line.message}
            </p>
          </div>

          {line.fields && Object.keys(line.fields).length > 0 && (
            <div>
              <h4 class="text-xs font-medium text-[var(--color-text-muted)] mb-2">
                {t("logs.fields")}
              </h4>
              <div class="space-y-2 bg-[var(--color-bg-tertiary)] rounded-lg p-3">
                {Object.entries(line.fields).map(([key, value]) => (
                  <div key={key} class="text-xs font-mono">
                    <span class="text-[var(--color-accent)]">{key}</span>
                    <span class="text-[var(--color-text-muted)] mx-1">=</span>
                    <span class="text-[var(--color-text-secondary)] break-all">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 class="text-xs font-medium text-[var(--color-text-muted)] mb-1">
              {t("logs.rawLine")}
            </h4>
            <pre class="text-xs font-mono text-[var(--color-text-secondary)] bg-[var(--color-bg-tertiary)] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
              {formatRawLog(line.raw)}
            </pre>
          </div>
        </div>
      )}
    </Modal>
  );
}

interface MobileLogCardProps {
  line: ParsedLogLine;
  onSelect: (id: number) => void;
}

export function MobileLogCard({ line, onSelect }: MobileLogCardProps) {
  const Icon = line.level ? levelIcons[line.level] : Info;
  const iconColor = line.level ? levelColors[line.level] : "text-[var(--color-text-muted)]";
  const hasFields = line.fields && Object.keys(line.fields).length > 0;
  const displayTime = formatLogTimestamp(line.timestamp);

  return (
    <button
      type="button"
      class="w-full flex items-start gap-3 p-3 text-left bg-[var(--color-bg-secondary)] rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
      onClick={() => onSelect(line.id)}
      aria-label={t("logs.viewLogDetails")}
    >
      <Icon size={16} class={`mt-0.5 flex-shrink-0 ${iconColor}`} />
      <div class="flex-1 min-w-0">
        <p class="text-sm text-[var(--color-text-primary)] line-clamp-2">{line.message}</p>
        <div class="flex items-center gap-2 mt-1">
          {displayTime && (
            <span class="text-xs text-[var(--color-text-muted)] font-mono">{displayTime}</span>
          )}
          {hasFields && (
            <Badge variant="default" class="text-xs">
              {Object.keys(line.fields!).length} {t("logs.fields")}
            </Badge>
          )}
        </div>
      </div>
      <ChevronRight size={16} class="text-[var(--color-text-muted)] flex-shrink-0 mt-0.5" />
    </button>
  );
}
