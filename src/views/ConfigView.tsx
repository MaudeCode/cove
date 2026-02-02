/**
 * ConfigView
 *
 * Schema-driven configuration editor with sidebar navigation.
 * Route: /config
 */

import { useEffect } from "preact/hooks";
import { signal } from "@preact/signals";
import { t } from "@/lib/i18n";
import { isConnected } from "@/lib/gateway";
import { toast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { HintBox } from "@/components/ui/HintBox";
import {
  RefreshCw,
  Search,
  Save,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  Settings2,
  Globe,
  Bot,
  Radio,
  Wrench,
  Terminal,
  Users,
  Clock,
  Sparkles,
  Puzzle,
  FileText,
  Lock,
  Box,
  Wand2,
  Download,
  Activity,
  Server,
  Volume2,
  MessageSquare,
  Link,
  Layout,
  Monitor,
  Webhook,
  Shield,
  Bell,
  Image,
  Cpu,
  HardDrive,
  Network,
  Key,
  Layers,
  Zap,
  Circle,
} from "lucide-preact";
import type { RouteProps } from "@/types/routes";
import type { JsonSchema } from "@/types/config";
import {
  isLoading,
  error,
  isSaving,
  schema,
  uiHints,
  draftConfig,
  searchQuery,
  isDirty,
  canSave,
  schemaVersion,
  loadConfig,
  resetDraft,
  saveConfig,
} from "@/signals/config";
import { ConfigNode } from "@/components/config/ConfigNode";
import { humanize } from "@/lib/config/schema-utils";

// ============================================
// Navigation State (synced with URL hash)
// ============================================

const STORAGE_KEY_EXPANDED = "cove:config:expandedNav";

/** Parse URL hash to path array: #gateway.controlUi → ["gateway", "controlUi"] */
function parseHashToPath(): (string | number)[] {
  const hash = window.location.hash.slice(1); // Remove #
  if (!hash) return [];

  return hash.split(".").map((segment) => {
    // Convert numeric strings to numbers (for array indices)
    const num = Number(segment);
    return Number.isInteger(num) && num >= 0 ? num : segment;
  });
}

/** Convert path array to URL hash: ["gateway", "controlUi"] → "gateway.controlUi" */
function pathToHash(path: (string | number)[]): string {
  if (path.length === 0) return "";
  return path.join(".");
}

/** Load persisted expanded nav from localStorage */
function loadPersistedExpanded(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_EXPANDED);
    if (stored) return new Set(JSON.parse(stored));
  } catch {
    // Ignore parse errors
  }
  return new Set(["gateway", "agents", "channels"]);
}

/** Currently selected path in the nav tree (synced with URL hash) */
const selectedPath = signal<(string | number)[]>(parseHashToPath());

/** Expanded nav items */
const expandedNav = signal<Set<string>>(loadPersistedExpanded());

// Sync selectedPath → URL hash (without triggering hashchange)
let isUpdatingHash = false;
selectedPath.subscribe((path) => {
  const newHash = pathToHash(path);
  const currentHash = window.location.hash.slice(1);
  if (newHash !== currentHash) {
    isUpdatingHash = true;
    if (newHash) {
      window.location.hash = newHash;
    } else {
      // Remove hash without adding to history
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    isUpdatingHash = false;
  }

  // Auto-expand parent paths so selected item is visible
  if (path.length > 1) {
    const next = new Set(expandedNav.value);
    for (let i = 1; i < path.length; i++) {
      next.add(path.slice(0, i).join("."));
    }
    expandedNav.value = next;
  }
});

// Sync URL hash → selectedPath (for back/forward navigation)
if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    if (!isUpdatingHash) {
      selectedPath.value = parseHashToPath();
    }
  });
}

// Persist expanded nav to localStorage
expandedNav.subscribe((expanded) => {
  try {
    localStorage.setItem(STORAGE_KEY_EXPANDED, JSON.stringify([...expanded]));
  } catch {
    // Ignore storage errors
  }
});

// ============================================
// Section Icons
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SECTION_ICONS: Record<string, any> = {
  // Core
  gateway: Globe,
  agents: Bot,
  channels: Radio,
  tools: Wrench,
  commands: Terminal,
  session: Users,
  cron: Clock,
  skills: Sparkles,
  plugins: Puzzle,
  logging: FileText,
  auth: Lock,
  models: Box,
  wizard: Wand2,
  update: Download,
  diagnostics: Activity,
  nodeHost: Server,
  // Additional sections
  audio: Volume2,
  messages: MessageSquare,
  bindings: Link,
  ui: Layout,
  browser: Monitor,
  hooks: Webhook,
  web: Globe,
  canvas: Image,
  canvasHost: Image,
  approvals: Shield,
  notifications: Bell,
  meta: FileText,
  env: HardDrive,
  nodes: Server,
  broadcast: Radio,
  media: Image,
  network: Network,
  secrets: Key,
  memory: Cpu,
  memorySearch: Cpu,
  storage: HardDrive,
  tls: Lock,
  remote: Network,
  reload: RefreshCw,
  tailscale: Network,
  sandbox: Box,
  context: Layers,
  contextPruning: Layers,
  compaction: Zap,
  heartbeat: Activity,
  defaults: Settings2,
};

/** Default icon for unknown sections */
const DEFAULT_SECTION_ICON = Circle;

// ============================================
// Nav Tree Types
// ============================================

interface NavItem {
  key: string;
  label: string;
  path: (string | number)[];
  children?: NavItem[];
  schema?: JsonSchema;
}

// ============================================
// Build Nav Tree
// ============================================

/**
 * Checks if a schema property is "navigation-worthy" (should appear in sidebar).
 * Only objects with 2+ properties or arrays of objects qualify.
 * Single-field objects and primitives should just be rendered inline.
 */
function isNavWorthy(propSchema: JsonSchema): boolean {
  // Arrays of objects are nav-worthy (expandable list)
  if (propSchema.type === "array" && propSchema.items?.properties) {
    return true;
  }

  // Objects must have 2+ properties to be worth navigating to
  if (propSchema.type === "object" && propSchema.properties) {
    const propCount = Object.keys(propSchema.properties).length;
    return propCount >= 2;
  }

  return false;
}

function buildNavTree(
  schemaObj: JsonSchema,
  config: Record<string, unknown>,
  parentPath: string[] = [],
  depth: number = 0,
): NavItem[] {
  if (!schemaObj.properties) return [];

  const items: NavItem[] = [];

  for (const [key, propSchema] of Object.entries(schemaObj.properties)) {
    const path = [...parentPath, key];
    const hint = uiHints.value[key] ?? uiHints.value[path.join(".")] ?? {};
    const label = hint.label ?? propSchema.title ?? humanize(key);

    // At depth 0 (top-level), include everything as nav items
    // At deeper levels, only include nav-worthy items
    if (depth > 0 && !isNavWorthy(propSchema)) {
      continue;
    }

    const item: NavItem = {
      key,
      label,
      path,
      schema: propSchema,
    };

    // If it's an object with properties, add children
    if (propSchema.type === "object" && propSchema.properties) {
      const configValue = (config[key] as Record<string, unknown>) ?? {};
      item.children = buildNavTree(propSchema, configValue, path, depth + 1);
      // Remove empty children array
      if (item.children.length === 0) {
        delete item.children;
      }
    }

    // If it's an array of objects, add each item as a child
    if (propSchema.type === "array" && propSchema.items?.properties) {
      const arrayValue = (config[key] as unknown[]) ?? [];
      item.children = arrayValue.map((itemValue, index) => {
        const obj = itemValue as Record<string, unknown>;
        const identity = obj.identity as Record<string, unknown> | undefined;
        const displayName = obj.id ?? obj.name ?? obj.label ?? `#${index + 1}`;
        const emoji = identity?.emoji ?? "";

        return {
          key: String(index),
          label: emoji ? `${emoji} ${displayName}` : String(displayName),
          path: [...path, index],
          schema: propSchema.items,
        };
      });
    }

    items.push(item);
  }

  // Sort by hint order
  items.sort((a, b) => {
    const orderA = uiHints.value[a.key]?.order ?? 100;
    const orderB = uiHints.value[b.key]?.order ?? 100;
    return orderA - orderB;
  });

  return items;
}

// ============================================
// Nav Item Component
// ============================================

function NavTreeItem({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const pathKey = item.path.join(".");
  const isExpanded = expandedNav.value.has(pathKey);
  const isSelected =
    selectedPath.value.join(".") === pathKey ||
    selectedPath.value.join(".").startsWith(pathKey + ".");
  const hasChildren = item.children && item.children.length > 0;

  const Icon = depth === 0 ? (SECTION_ICONS[item.key] ?? DEFAULT_SECTION_ICON) : undefined;

  const handleClick = () => {
    selectedPath.value = item.path;
  };

  const handleToggle = (e: Event) => {
    e.stopPropagation();
    const next = new Set(expandedNav.value);
    if (isExpanded) {
      next.delete(pathKey);
    } else {
      next.add(pathKey);
    }
    expandedNav.value = next;
  };

  // Exact match for selection (not just prefix)
  const isExactSelected = selectedPath.value.join(".") === pathKey;

  return (
    <div>
      <button
        type="button"
        class={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md text-left transition-colors ${
          isExactSelected
            ? "bg-[var(--color-accent)] text-white"
            : isSelected
              ? "text-[var(--color-accent)]"
              : "hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]"
        } ${depth > 0 ? "text-[var(--color-text-secondary)]" : "font-medium"}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            type="button"
            class="p-0.5 -ml-1 hover:bg-[var(--color-bg-primary)]/20 rounded"
            onClick={handleToggle}
            aria-label={
              isExpanded ? t("accessibility.collapseSection") : t("accessibility.expandSection")
            }
          >
            {isExpanded ? (
              <ChevronDown class="w-3.5 h-3.5" />
            ) : (
              <ChevronRight class="w-3.5 h-3.5" />
            )}
          </button>
        ) : (
          <span class="w-4" />
        )}

        {/* Icon for top-level items */}
        {Icon && <Icon class="w-4 h-4 flex-shrink-0 opacity-70" />}

        {/* Label */}
        <span class="truncate">{item.label}</span>
      </button>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div class="relative ml-2">
          <div
            class="absolute top-0 bottom-1 w-px bg-[var(--color-border)] opacity-50"
            style={{ left: `${(depth + 1) * 16 + 4}px` }}
          />
          {item.children!.map((child) => (
            <NavTreeItem key={child.key} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// Detail Panel
// ============================================

function DetailPanel() {
  const path = selectedPath.value;
  const schemaValue = schema.value;
  const configValue = draftConfig.value;
  const hintsValue = uiHints.value;

  if (!schemaValue || path.length === 0) {
    return (
      <div class="flex-1 flex items-center justify-center text-[var(--color-text-muted)]">
        <div class="text-center">
          <Settings2 class="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{t("config.selectSection")}</p>
        </div>
      </div>
    );
  }

  // Navigate to the selected schema node
  let currentSchema: JsonSchema | undefined = schemaValue;
  let currentValue: unknown = configValue;

  for (const segment of path) {
    if (typeof segment === "number") {
      // Array index
      currentSchema = currentSchema?.items;
      currentValue = (currentValue as unknown[])?.[segment];
    } else {
      // Object property
      currentSchema = currentSchema?.properties?.[segment];
      currentValue = (currentValue as Record<string, unknown>)?.[segment];
    }
  }

  if (!currentSchema) {
    return (
      <div class="flex-1 p-6 text-[var(--color-text-muted)]">
        <p>Schema not found for path: {path.join(" › ")}</p>
      </div>
    );
  }

  // Build breadcrumb parts
  const breadcrumbParts = path.map((segment, i) => {
    const subPath = path.slice(0, i + 1);
    const hint = hintsValue[subPath.join(".")];
    return hint?.label ?? humanize(segment);
  });

  // Get the section title (last part) and parent path
  const sectionTitle = breadcrumbParts[breadcrumbParts.length - 1];
  const parentPath = breadcrumbParts.slice(0, -1);

  // Get section description from hint or schema
  const pathKey = path.join(".");
  const sectionHint = hintsValue[pathKey];
  const sectionHelp = sectionHint?.help ?? currentSchema.description;

  // Get icon for top-level sections
  const topLevelKey = String(path[0]);
  const SectionIcon = SECTION_ICONS[topLevelKey];

  return (
    <div class="flex-1 overflow-y-auto">
      {/* Header */}
      <div class="px-8 pt-6 pb-4 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]">
        {/* Parent breadcrumb (if nested) */}
        {parentPath.length > 0 && (
          <div class="text-xs text-[var(--color-text-muted)] mb-1.5">{parentPath.join(" › ")}</div>
        )}

        {/* Section title */}
        <div class="flex items-center gap-3">
          {SectionIcon && path.length === 1 && (
            <SectionIcon class="w-6 h-6 text-[var(--color-accent)] opacity-80" />
          )}
          <h2 class="text-xl font-semibold text-[var(--color-text-primary)]">{sectionTitle}</h2>
        </div>

        {/* Section description */}
        {sectionHelp && (
          <p class="text-sm text-[var(--color-text-muted)] mt-2 max-w-2xl leading-relaxed">
            {sectionHelp}
          </p>
        )}
      </div>

      {/* Content */}
      <div class="px-8 py-6 max-w-3xl">
        <ConfigNode
          schema={currentSchema}
          value={currentValue}
          path={path}
          hints={hintsValue}
          level={0}
          showLabel={false}
          isDetailView
        />
      </div>
    </div>
  );
}

// ============================================
// Main View
// ============================================

export function ConfigView(_props: RouteProps) {
  // Load config on mount
  useEffect(() => {
    if (isConnected.value && !schema.value) {
      loadConfig();
    }
  }, [isConnected.value]);

  // Auto-select first section when loaded, or validate persisted path
  useEffect(() => {
    if (!schema.value) return;

    const path = selectedPath.value;

    // Build nav tree to get sorted first item
    const tree = buildNavTree(schema.value, draftConfig.value);
    const firstPath = tree[0]?.path;

    // If no path selected, select first section (using sorted order)
    if (path.length === 0) {
      if (firstPath) {
        selectedPath.value = firstPath;
      }
      return;
    }

    // Validate persisted path still exists in schema
    const topLevel = String(path[0]);
    if (!schema.value.properties?.[topLevel]) {
      // Path no longer valid, select first section
      if (firstPath) {
        selectedPath.value = firstPath;
      }
    }
  }, [schema.value]);

  const handleSave = async () => {
    const success = await saveConfig();
    if (success) {
      toast.success(t("config.saveSuccess"));
    } else if (error.value) {
      toast.error(error.value);
    }
  };

  const handleReset = () => {
    resetDraft();
    toast.success(t("config.reset"));
  };

  const schemaValue = schema.value;
  const configValue = draftConfig.value;

  // Build nav tree
  const navTree = schemaValue ? buildNavTree(schemaValue, configValue) : [];

  // Filter by search
  const query = searchQuery.value.toLowerCase().trim();
  const filteredTree = query
    ? navTree.filter((item) => {
        const matchesItem = item.label.toLowerCase().includes(query);
        const matchesChildren = item.children?.some((c) => c.label.toLowerCase().includes(query));
        return matchesItem || matchesChildren;
      })
    : navTree;

  return (
    <div class="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div class="flex items-center justify-between gap-4 px-6 py-4 border-b border-[var(--color-border)]">
        <div>
          <h1 class="text-xl font-bold">{t("config.title")}</h1>
          {schemaVersion.value && (
            <p class="text-xs text-[var(--color-text-muted)]">
              {t("config.version", { version: schemaVersion.value })}
            </p>
          )}
        </div>

        <div class="flex items-center gap-2">
          {isDirty.value && (
            <span class="text-sm text-[var(--color-warning)]">{t("config.unsavedChanges")}</span>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={RotateCcw}
            onClick={handleReset}
            disabled={!isDirty.value}
          >
            {t("config.reset")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Save}
            onClick={handleSave}
            disabled={!canSave.value}
          >
            {isSaving.value ? t("config.saving") : t("config.save")}
          </Button>
          <IconButton
            icon={<RefreshCw class={isLoading.value ? "animate-spin" : ""} />}
            onClick={loadConfig}
            disabled={isLoading.value}
            label={t("actions.refresh")}
          />
        </div>
      </div>

      {/* Error */}
      {error.value && (
        <div class="px-6 py-2">
          <HintBox variant="error">{error.value}</HintBox>
        </div>
      )}

      {/* Loading */}
      {isLoading.value && !schemaValue && (
        <div class="flex-1 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {/* Content */}
      {!isLoading.value && schemaValue && (
        <div class="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div class="w-64 border-r border-[var(--color-border)] flex flex-col bg-[var(--color-bg-secondary)]">
            {/* Search */}
            <div class="p-3 border-b border-[var(--color-border)]">
              <Input
                type="text"
                placeholder={t("config.searchPlaceholder")}
                value={searchQuery.value}
                onInput={(e) => {
                  searchQuery.value = (e.target as HTMLInputElement).value;
                }}
                leftElement={<Search class="w-4 h-4" />}
                class="text-sm"
              />
            </div>

            {/* Nav tree */}
            <div class="flex-1 overflow-y-auto p-2">
              {filteredTree.length === 0 ? (
                <p class="text-sm text-[var(--color-text-muted)] p-2">
                  {query ? t("config.noResults") : t("config.noFields")}
                </p>
              ) : (
                filteredTree.map((item) => <NavTreeItem key={item.key} item={item} />)
              )}
            </div>
          </div>

          {/* Detail panel */}
          <DetailPanel />
        </div>
      )}
    </div>
  );
}
