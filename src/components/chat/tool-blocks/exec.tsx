/**
 * Exec tool blocks
 */

import { t } from "@/lib/i18n";
import { getExecCommandInput } from "../tool-registry";
import { CodeBlock } from "./CodeBlock";

interface ExecCommandBlockProps {
  args: Record<string, unknown>;
}

export function ExecCommandBlock({ args }: ExecCommandBlockProps) {
  const command = getExecCommandInput(args) ?? "";
  const cwd = getString(args.workdir) ?? getString(args.cwd);

  const display = cwd ? `# cwd: ${cwd}\n${command}` : command;

  return (
    <div>
      <span class="sr-only">{t("toolInput.runningCommand")}: </span>
      <CodeBlock content={display} filePath="command.sh" maxLines={20} />
    </div>
  );
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
