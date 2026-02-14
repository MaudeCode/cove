/**
 * Input display blocks for specific tool types
 */

import { useState } from "preact/hooks";
import { t } from "@/lib/i18n";
import { CodeBlock } from "./CodeBlock";
import { ToolInputContainer, ToolBadge } from "./shared";

// ============================================
// Read Input Block
// ============================================

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
      <span>
        📄 {filePath}
        {lineRange && <span class="text-[var(--color-text-muted)]">:{lineRange}</span>}
      </span>
      {limit && <ToolBadge>{t("toolInput.lineCount", { count: limit })}</ToolBadge>}
    </ToolInputContainer>
  );
}

// ============================================
// Write Input Block
// ============================================

interface WriteInputBlockProps {
  args: Record<string, unknown>;
}

export function WriteInputBlock({ args }: WriteInputBlockProps) {
  const filePath = (args.file_path ?? args.path) as string;
  const content = args.content as string;

  return (
    <div class="space-y-2">
      <ToolInputContainer>📄 {filePath}</ToolInputContainer>
      <CodeBlock content={content} filePath={filePath} maxLines={30} />
    </div>
  );
}

// ============================================
// Exec Command Block
// ============================================

interface ExecCommandBlockProps {
  args: Record<string, unknown>;
}

export function ExecCommandBlock({ args }: ExecCommandBlockProps) {
  const command = args.command as string;
  const cwd = args.workdir || args.cwd;

  const display = cwd ? `# cwd: ${cwd}\n${command}` : command;

  return <CodeBlock content={display} filePath="command.sh" maxLines={20} />;
}

// ============================================
// Edit Diff Block
// ============================================

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

  return <CodeBlock content={diff} filePath="changes.diff" maxLines={40} />;
}

// ============================================
// Search Input Block (web_search, memory_search)
// ============================================

interface SearchInputBlockProps {
  args: Record<string, unknown>;
}

export function SearchInputBlock({ args }: SearchInputBlockProps) {
  const query = args.query as string;

  return (
    <ToolInputContainer>
      <span class="sr-only">{t("toolInput.searchQuery")}: </span>🔍 {query}
    </ToolInputContainer>
  );
}

// ============================================
// Memory Get Input Block
// ============================================

interface MemoryGetInputBlockProps {
  args: Record<string, unknown>;
}

export function MemoryGetInputBlock({ args }: MemoryGetInputBlockProps) {
  const path = args.path as string;
  const from = args.from as number | undefined;
  const lines = args.lines as number | undefined;

  const lineRange = from && lines ? `${from}-${from + lines - 1}` : from ? `${from}+` : undefined;

  return (
    <ToolInputContainer inline>
      <span class="sr-only">{t("toolInput.memoryPath")}: </span>
      <span>
        📄 {path}
        {lineRange && <span class="text-[var(--color-text-muted)]">:{lineRange}</span>}
      </span>
      {lines && <ToolBadge>{t("toolOutput.lines", { count: lines })}</ToolBadge>}
    </ToolInputContainer>
  );
}

// ============================================
// Browser Input Block
// ============================================

interface BrowserInputBlockProps {
  args: Record<string, unknown>;
}

export function BrowserInputBlock({ args }: BrowserInputBlockProps) {
  const action = args.action as string;
  const profile = args.profile as string | undefined;
  const url = (args.targetUrl ?? args.url) as string | undefined;

  return (
    <ToolInputContainer inline>
      <span>🌐 {action}</span>
      {profile && <ToolBadge>{profile}</ToolBadge>}
      {url && <span class="text-[var(--color-accent)] truncate">{url}</span>}
    </ToolInputContainer>
  );
}

// ============================================
// URL Input Block (web_fetch)
// ============================================

interface UrlInputBlockProps {
  args: Record<string, unknown>;
}

export function UrlInputBlock({ args }: UrlInputBlockProps) {
  const url = args.url as string;

  return (
    <ToolInputContainer>
      <span class="sr-only">{t("common.url")}: </span>🌐 {url}
    </ToolInputContainer>
  );
}

// ============================================
// Image Input Block
// ============================================

interface ImageInputBlockProps {
  args: Record<string, unknown>;
}

export function ImageInputBlock({ args }: ImageInputBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const image = args.image as string;
  const prompt = args.prompt as string | undefined;
  const isUrl = image?.startsWith("http");

  return (
    <div class="space-y-2">
      {/* Image thumbnail if URL */}
      {isUrl && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          class="rounded-md overflow-hidden bg-[var(--color-bg-tertiary)] p-2 cursor-pointer hover:bg-[var(--color-bg-secondary)] transition-colors"
          aria-label={t("toolInput.expandImage")}
        >
          <img
            src={image}
            alt={t("toolInput.inputImage")}
            class="max-h-[150px] max-w-full rounded object-contain"
            loading="lazy"
          />
        </button>
      )}
      {/* Image path if not URL */}
      {!isUrl && image && (
        <ToolInputContainer>
          <span class="sr-only">{t("toolInput.imagePath")}: </span>
          🖼️ {image}
        </ToolInputContainer>
      )}
      {/* Prompt */}
      {prompt && (
        <ToolInputContainer>
          <span class="sr-only">{t("toolInput.prompt")}: </span>💬 {prompt}
        </ToolInputContainer>
      )}

      {/* Lightbox */}
      {expanded && isUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("common.imageViewer")}
          class="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setExpanded(false)}
          onKeyDown={(e) => e.key === "Escape" && setExpanded(false)}
          tabIndex={0}
        >
          <button
            type="button"
            onClick={() => setExpanded(false)}
            class="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label={t("actions.close")}
          >
            ✕
          </button>
          <img
            src={image}
            alt={t("toolInput.expandedImage")}
            class="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
