/**
 * Write tool blocks
 */

import { t } from "@/lib/i18n";
import { CodeBlock } from "./CodeBlock";
import { ToolInputContainer } from "./shared";

interface WriteInputBlockProps {
  args: Record<string, unknown>;
}

export function WriteInputBlock({ args }: WriteInputBlockProps) {
  const filePath = (args.file_path ?? args.path) as string;
  const content = args.content as string;

  return (
    <div class="space-y-2">
      <ToolInputContainer>
        <span class="sr-only">{t("toolInput.writingFile")}: </span>📄 {filePath}
      </ToolInputContainer>
      <CodeBlock content={content} filePath={filePath} maxLines={30} />
    </div>
  );
}
