/**
 * ConfigView
 *
 * Schema-driven configuration editor with sidebar navigation.
 * Route: /config
 */

import { useEffect } from "preact/hooks";
import { signal } from "@preact/signals";
import { t } from "@/lib/i18n";
import { ViewErrorBoundary } from "@/components/ui/ViewErrorBoundary";
import { isConnected } from "@/lib/gateway";
import { toast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { HintBox } from "@/components/ui/HintBox";
import { PageHeader } from "@/components/ui/PageHeader";
import { RefreshCw, Search, Save, RotateCcw } from "lucide-preact";
import type { RouteProps } from "@/types/routes";
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
  loadConfig,
  resetDraft,
  saveConfig,
} from "@/signals/config";
import { buildNavTree } from "@/lib/config/nav-tree";
import type { NavItem } from "@/lib/config/nav-tree";
import { ConfigNavItem } from "@/components/config/ConfigNavItem";
import { ConfigDetailPanel } from "@/components/config/ConfigDetailPanel";
import { MobileConfigHeader } from "@/components/config/MobileConfigHeader";
import { MobileConfigNavList } from "@/components/config/MobileConfigNavList";

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
// Mobile Navigation Helpers
// ============================================

/**
 * Find a nav item by path in the tree.
 */
function findNavItem(tree: NavItem[], path: (string | number)[]): NavItem | null {
  if (path.length === 0) return null;

  const [first, ...rest] = path;
  const item = tree.find((i) => i.key === String(first));

  if (!item) return null;
  if (rest.length === 0) return item;
  if (!item.children) return null;

  return findNavItem(item.children, rest);
}

/**
 * Get the nav items to display at the current path level.
 * Returns null if we should show the detail panel instead.
 */
function getNavItemsForPath(
  tree: NavItem[],
  path: (string | number)[],
): { items: NavItem[]; isTopLevel: boolean } | null {
  // Empty path → show root level
  if (path.length === 0) {
    return { items: tree, isTopLevel: true };
  }

  // Find the item at current path
  const currentItem = findNavItem(tree, path);

  // If item has children, show them
  if (currentItem?.children && currentItem.children.length > 0) {
    return { items: currentItem.children, isTopLevel: false };
  }

  // No children → show detail panel
  return null;
}

// ============================================
// Main View
// ============================================

export function ConfigView(_props: RouteProps) {
  // Sync URL hash to selectedPath on mount (handles navigation from other pages)
  useEffect(() => {
    const hashPath = parseHashToPath();
    if (hashPath.length > 0) {
      selectedPath.value = hashPath;
    }
  }, []);

  // Load config on mount
  useEffect(() => {
    if (isConnected.value && !schema.value) {
      loadConfig();
    }
  }, [isConnected.value]);

  // Auto-select first section when loaded, or validate persisted path
  // Only auto-select on desktop; mobile starts at root nav list
  useEffect(() => {
    if (!schema.value) return;

    const path = selectedPath.value;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;

    // Build nav tree to get sorted first item
    const tree = buildNavTree(schema.value, draftConfig.value, uiHints.value);
    const firstPath = tree[0]?.path;

    // If no path selected, select first section on desktop only
    if (path.length === 0) {
      if (firstPath && !isMobile) {
        selectedPath.value = firstPath;
      }
      return;
    }

    // Validate persisted path still exists in schema
    const topLevel = String(path[0]);
    if (!schema.value.properties?.[topLevel]) {
      // Path no longer valid, select first section (or clear on mobile)
      if (isMobile) {
        selectedPath.value = [];
      } else if (firstPath) {
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
  const hintsValue = uiHints.value;

  // Build nav tree
  const navTree = schemaValue ? buildNavTree(schemaValue, configValue, hintsValue) : [];

  // Filter by search
  const query = searchQuery.value.toLowerCase().trim();
  const filteredTree = query
    ? navTree.filter((item) => {
        const matchesItem = item.label.toLowerCase().includes(query);
        const matchesChildren = item.children?.some((c) => c.label.toLowerCase().includes(query));
        return matchesItem || matchesChildren;
      })
    : navTree;

  // Get mobile nav state
  const mobileNavData = getNavItemsForPath(navTree, selectedPath.value);
  const showMobileNav = mobileNavData !== null;

  return (
    <ViewErrorBoundary viewName={t("config.title")}>
      {/* Mobile Layout */}
      <div class="md:hidden flex-1 flex flex-col overflow-hidden">
        <MobileConfigHeader
          selectedPath={selectedPath}
          uiHints={uiHints}
          isDirty={isDirty.value}
          canSave={canSave.value}
          isSaving={isSaving.value}
          onSave={handleSave}
          onReset={handleReset}
        />

        {/* Error */}
        {error.value && (
          <div class="px-4 pt-4">
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
          <div class="flex-1 overflow-y-auto bg-[var(--color-bg-surface)]">
            {showMobileNav && mobileNavData.items.length > 0 ? (
              <MobileConfigNavList
                items={mobileNavData.items}
                selectedPath={selectedPath}
                isTopLevel={mobileNavData.isTopLevel}
              />
            ) : (
              <ConfigDetailPanel
                selectedPath={selectedPath}
                schema={schema}
                draftConfig={draftConfig}
                uiHints={uiHints}
              />
            )}
          </div>
        )}
      </div>

      {/* Desktop Layout */}
      <div class="hidden md:flex md:flex-1 md:overflow-y-auto p-6">
        <div class="max-w-6xl mx-auto w-full space-y-6">
          <PageHeader
            title={t("config.title")}
            subtitle={t("config.description")}
            actions={
              <>
                {isDirty.value && (
                  <span class="text-sm text-[var(--color-warning)]">
                    {t("config.unsavedChanges")}
                  </span>
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
              </>
            }
          />

          {/* Error */}
          {error.value && <HintBox variant="error">{error.value}</HintBox>}

          {/* Loading */}
          {isLoading.value && !schemaValue && (
            <div class="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          )}

          {/* Content */}
          {!isLoading.value && schemaValue && (
            <div class="flex min-h-[500px] rounded-xl overflow-hidden border border-[var(--color-border)]">
              {/* Sidebar */}
              <div class="w-64 flex flex-col bg-[var(--color-bg-tertiary)]">
                {/* Search */}
                <div class="p-3">
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
                    filteredTree.map((item) => (
                      <ConfigNavItem
                        key={item.key}
                        item={item}
                        selectedPath={selectedPath}
                        expandedNav={expandedNav}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Detail panel */}
              <div class="flex-1 bg-[var(--color-bg-surface)]">
                <ConfigDetailPanel
                  selectedPath={selectedPath}
                  schema={schema}
                  draftConfig={draftConfig}
                  uiHints={uiHints}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </ViewErrorBoundary>
  );
}
