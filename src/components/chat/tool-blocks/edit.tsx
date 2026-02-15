/**
 * Edit tool blocks
 */

import { t } from "@/lib/i18n";
import { CodeBlock } from "./CodeBlock";

interface EditDiffBlockProps {
  args: Record<string, unknown>;
}

/** Compute LCS (Longest Common Subsequence) for diff */
function computeLCS(oldLines: string[], newLines: string[]): number[][] {
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

/** Generate a unified diff from old and new strings */
function generateDiff(oldStr: string, newStr: string, filePath?: string): string {
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");
  const fileName = filePath || "file";

  const dp = computeLCS(oldLines, newLines);

  const diffLines: string[] = [];
  let i = oldLines.length;
  let j = newLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diffLines.unshift(` ${oldLines[i - 1]}`);
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diffLines.unshift(`+${newLines[j - 1]}`);
      j--;
    } else {
      diffLines.unshift(`-${oldLines[i - 1]}`);
      i--;
    }
  }

  const header = [
    `--- a/${fileName}`,
    `+++ b/${fileName}`,
    `@@ -1,${oldLines.length} +1,${newLines.length} @@`,
  ];

  return [...header, ...diffLines].join("\n");
}

export function EditDiffBlock({ args }: EditDiffBlockProps) {
  const oldStr = (args.old_string ?? args.oldText ?? "") as string;
  const newStr = (args.new_string ?? args.newText ?? "") as string;
  const filePath = (args.file_path ?? args.path ?? "") as string;

  if (!oldStr && !newStr) {
    return <CodeBlock content={args} />;
  }

  const diff = generateDiff(oldStr, newStr, filePath);

  return (
    <div>
      <span class="sr-only">{t("toolInput.editingFile")}: </span>
      <CodeBlock content={diff} filePath="changes.diff" maxLines={40} />
    </div>
  );
}
