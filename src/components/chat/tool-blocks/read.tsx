/**
 * Read tool blocks
 */

import { t } from "@/lib/i18n";
import { ToolInputContainer, ToolBadge } from "./shared";

interface ReadInputBlockProps {
  args: Record<string, unknown>;
}

export function ReadInputBlock({ args }: ReadInputBlockProps) {
  const filePath = (args.file_path ?? args.path) as string;
  const offset = args.offset as number | undefined;
  const limit = args.limit as number | undefined;

  const lineRange =
    offset && limit ? `${offset}-${offset + limit - 1}` : offset ? `${offset}+` : undefined;

  return (
    <ToolInputContainer inline>
      <span class="sr-only">{t("toolInput.readingFile")}: </span>
      <span>
        📄 {filePath}
        {lineRange && <span class="text-[var(--color-text-muted)]">:{lineRange}</span>}
      </span>
      {limit && <ToolBadge>{t("toolInput.lineCount", { count: limit })}</ToolBadge>}
    </ToolInputContainer>
  );
}
