/**
 * Exec tool blocks
 */

import { t } from "@/lib/i18n";
import { CodeBlock } from "./CodeBlock";

interface ExecCommandBlockProps {
  args: Record<string, unknown>;
}

export function ExecCommandBlock({ args }: ExecCommandBlockProps) {
  const command = args.command as string;
  const cwd = args.workdir || args.cwd;

  const display = cwd ? `# cwd: ${cwd}\n${command}` : command;

  return (
    <div>
      <span class="sr-only">{t("toolInput.runningCommand")}: </span>
      <CodeBlock content={display} filePath="command.sh" maxLines={20} />
    </div>
  );
}
