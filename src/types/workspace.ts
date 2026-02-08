/**
 * Workspace Types
 *
 * Types for agent workspace file management.
 */

export interface WorkspaceFile {
  name: string;
  path: string;
  missing: boolean;
  size?: number;
  updatedAtMs?: number;
  content?: string;
}

export interface WorkspaceFilesResult {
  agentId: string;
  workspace: string;
  files: WorkspaceFile[];
}

export interface WorkspaceFileResult {
  agentId: string;
  workspace: string;
  file: WorkspaceFile;
}

/** File metadata for display */
export interface WorkspaceFileMeta {
  icon: string;
  description: string;
}

/**
 * Normalize workspace filename for lookups.
 * Treats memory.md and MEMORY.md as equivalent.
 */
export function normalizeWorkspaceFilename(name: string): string {
  if (name.toLowerCase() === "memory.md") return "MEMORY.md";
  return name;
}

/** Metadata for each workspace file type */
export const WORKSPACE_FILE_META: Record<string, WorkspaceFileMeta> = {
  "AGENTS.md": {
    icon: "📋",
    description: "workspace.files.agents",
  },
  "SOUL.md": {
    icon: "🎭",
    description: "workspace.files.soul",
  },
  "TOOLS.md": {
    icon: "🛠️",
    description: "workspace.files.tools",
  },
  "IDENTITY.md": {
    icon: "🪪",
    description: "workspace.files.identity",
  },
  "USER.md": {
    icon: "👤",
    description: "workspace.files.user",
  },
  "HEARTBEAT.md": {
    icon: "💓",
    description: "workspace.files.heartbeat",
  },
  "BOOTSTRAP.md": {
    icon: "🚀",
    description: "workspace.files.bootstrap",
  },
  "MEMORY.md": {
    icon: "🧠",
    description: "workspace.files.memory",
  },
};

/** Ordered list of files for display (use normalized names) */
export const WORKSPACE_FILE_ORDER = [
  "AGENTS.md",
  "SOUL.md",
  "TOOLS.md",
  "IDENTITY.md",
  "USER.md",
  "HEARTBEAT.md",
  "MEMORY.md",
  "BOOTSTRAP.md",
];

/** Files where missing state is expected/normal */
export const WORKSPACE_FILES_OPTIONAL = ["BOOTSTRAP.md"];
