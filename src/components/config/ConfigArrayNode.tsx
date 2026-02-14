/**
 * ConfigArrayNode
 *
 * Renders array schema nodes with drag-and-drop reordering.
 */

import { useState } from "preact/hooks";
import { t } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { ChevronDown, ChevronRight, ChevronUp, Plus, Trash2, GripVertical } from "lucide-preact";
import type { JsonSchema, ConfigUiHints } from "@/types/config";
import { updateField } from "@/signals/config";
import { schemaType, schemaDefault } from "@/lib/config/schema-utils";
import { ConfigNode } from "./ConfigNode";

interface ArrayNodeProps {
  schema: JsonSchema;
  value: unknown[] | null;
  path: (string | number)[];
  hints: ConfigUiHints;
  level: number;
  label: string;
  help?: string;
}

export function ArrayNode({ schema, value, path, hints, level, label, help }: ArrayNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const items = value ?? [];
  const itemSchema = schema.items ?? {};
  const itemType = schemaType(itemSchema);

  const addItem = () => {
    const newItem = schemaDefault(itemSchema);
    updateField(path, [...items, newItem]);
  };

  const removeItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    updateField(path, next);
  };

  const reorderItems = (from: number, to: number) => {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    updateField(path, next);
  };

  // Simple array of primitives
  if (itemType === "string" || itemType === "number") {
    return (
      <div class="mt-6 first:mt-3">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
          <div>
            <label class="text-sm font-semibold text-[var(--color-text-primary)]">{label}</label>
            {help && (
              <p class="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">{help}</p>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={Plus}
            onClick={addItem}
            fullWidth
            class="sm:w-auto"
          >
            {t("config.field.addItem")}
          </Button>
        </div>
        <div class="space-y-2 w-full">
          {items.map((item, index) => (
            <div
              key={index}
              class="flex items-center gap-1 p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)]"
            >
              {/* Mobile: up/down buttons */}
              {items.length > 1 && (
                <div class="flex flex-col sm:hidden">
                  <button
                    type="button"
                    class="p-2 text-[var(--color-text-muted)] active:text-[var(--color-text-primary)] disabled:opacity-30"
                    onClick={() => index > 0 && reorderItems(index, index - 1)}
                    disabled={index === 0}
                    aria-label={t("config.field.moveUp")}
                  >
                    <ChevronUp class="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    class="p-2 text-[var(--color-text-muted)] active:text-[var(--color-text-primary)] disabled:opacity-30"
                    onClick={() => index < items.length - 1 && reorderItems(index, index + 1)}
                    disabled={index === items.length - 1}
                    aria-label={t("config.field.moveDown")}
                  >
                    <ChevronDown class="w-4 h-4" />
                  </button>
                </div>
              )}
              {/* Desktop: drag handle */}
              {items.length > 1 && (
                <div
                  class="hidden sm:block p-1 cursor-grab text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  title={t("config.field.dragToReorder")}
                >
                  <GripVertical class="w-4 h-4" />
                </div>
              )}
              <Input
                type={itemType === "number" ? "number" : "text"}
                value={String(item ?? "")}
                onInput={(e) => {
                  const val = (e.target as HTMLInputElement).value;
                  const next = [...items];
                  next[index] = itemType === "number" ? Number(val) : val;
                  updateField(path, next);
                }}
                fullWidth
              />
              <IconButton
                icon={<Trash2 class="w-5 h-5 sm:w-4 sm:h-4" />}
                label={t("config.field.removeItem")}
                onClick={() => removeItem(index)}
                size="md"
                variant="ghost"
                class="!p-2.5 sm:!p-1.5 flex-shrink-0"
              />
            </div>
          ))}
          {items.length === 0 && (
            <p class="text-sm text-[var(--color-text-muted)] py-4 text-center border border-dashed border-[var(--color-border)] rounded-lg">
              {t("common.noItems")}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Array of objects
  return (
    <div class="mt-6 first:mt-3">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
        <button
          type="button"
          class="flex items-center gap-2 group"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          <span class="text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] transition-colors">
            {isExpanded ? <ChevronDown class="w-4 h-4" /> : <ChevronRight class="w-4 h-4" />}
          </span>
          <span class="text-sm font-semibold text-[var(--color-text-primary)]">{label}</span>
          <span class="text-xs text-[var(--color-text-muted)]">({items.length})</span>
        </button>
        <Button
          variant="secondary"
          size="sm"
          icon={Plus}
          onClick={addItem}
          fullWidth
          class="sm:w-auto"
        >
          {t("config.field.addItem")}
        </Button>
      </div>

      {help && <p class="text-xs text-[var(--color-text-muted)] mb-3 leading-relaxed">{help}</p>}

      {isExpanded && (
        <div class="space-y-3">
          {items.length === 0 ? (
            <p class="text-sm text-[var(--color-text-muted)] py-4 text-center border border-dashed border-[var(--color-border)] rounded-lg">
              {t("common.noItems")}
            </p>
          ) : (
            items.map((item, index) => (
              <ArrayItemCard
                key={index}
                schema={itemSchema}
                value={item}
                path={[...path, index]}
                parentPath={path}
                hints={hints}
                level={level + 1}
                index={index}
                totalItems={items.length}
                onRemove={() => removeItem(index)}
                onReorder={reorderItems}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Array Item Card (for object arrays)
// ============================================

function ArrayItemCard({
  schema,
  value,
  path,
  parentPath,
  hints,
  level,
  index,
  totalItems,
  onRemove,
  onReorder,
}: {
  schema: JsonSchema;
  value: unknown;
  path: (string | number)[];
  parentPath: (string | number)[];
  hints: ConfigUiHints;
  level: number;
  index: number;
  totalItems: number;
  onRemove: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const objValue = (value ?? {}) as Record<string, unknown>;

  // Try to get a display name from the item
  const displayName =
    objValue.id ?? objValue.name ?? objValue.label ?? objValue.displayName ?? `#${index + 1}`;
  const identity = objValue.identity as Record<string, unknown> | undefined;
  const emoji = identity?.emoji ?? "";

  const handleDragStart = (e: DragEvent) => {
    setIsDragging(true);
    e.dataTransfer!.effectAllowed = "move";
    e.dataTransfer!.setData("text/plain", JSON.stringify({ path: parentPath.join("."), index }));
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    try {
      const data = JSON.parse(e.dataTransfer!.getData("text/plain"));
      if (data.path === parentPath.join(".") && data.index !== index) {
        onReorder(data.index, index);
      }
    } catch {
      // Invalid drop data
    }
  };

  return (
    <Card
      padding="none"
      class={`overflow-hidden transition-all ${isDragging ? "opacity-50" : ""} ${
        isDragOver ? "ring-2 ring-[var(--color-accent)]" : ""
      }`}
      draggable={totalItems > 1}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div class="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 sm:py-3 select-none">
        {/* Mobile: up/down buttons for reordering - large touch targets */}
        {totalItems > 1 && (
          <div class="flex flex-col sm:hidden">
            <button
              type="button"
              class="p-3 -m-1 text-[var(--color-text-muted)] active:text-[var(--color-text-primary)] active:bg-[var(--color-bg-hover)] rounded disabled:opacity-30"
              onClick={() => index > 0 && onReorder(index, index - 1)}
              disabled={index === 0}
              aria-label={t("config.field.moveUp")}
            >
              <ChevronUp class="w-5 h-5" />
            </button>
            <button
              type="button"
              class="p-3 -m-1 text-[var(--color-text-muted)] active:text-[var(--color-text-primary)] active:bg-[var(--color-bg-hover)] rounded disabled:opacity-30"
              onClick={() => index < totalItems - 1 && onReorder(index, index + 1)}
              disabled={index === totalItems - 1}
              aria-label={t("config.field.moveDown")}
            >
              <ChevronDown class="w-5 h-5" />
            </button>
          </div>
        )}
        {/* Desktop: drag handle */}
        {totalItems > 1 && (
          <div
            class="hidden sm:block p-1 cursor-grab text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] active:cursor-grabbing"
            title={t("config.field.dragToReorder")}
          >
            <GripVertical class="w-4 h-4" />
          </div>
        )}
        <button
          type="button"
          class="flex-1 flex items-center gap-2 text-left group min-h-[44px] sm:min-h-0"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          <span class="text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] transition-colors">
            {isExpanded ? <ChevronDown class="w-4 h-4" /> : <ChevronRight class="w-4 h-4" />}
          </span>
          {emoji && <span>{emoji}</span>}
          <span class="text-sm font-medium">{String(displayName)}</span>
        </button>
        {/* Delete button - larger touch target on mobile */}
        <IconButton
          icon={<Trash2 class="w-5 h-5 sm:w-4 sm:h-4" />}
          label={t("config.field.removeItem")}
          onClick={onRemove}
          size="md"
          variant="ghost"
          class="!p-2.5 sm:!p-1.5"
        />
      </div>

      {isExpanded && (
        <div class="px-4 pb-4 border-t border-[var(--color-border)]">
          <ConfigNode
            schema={schema}
            value={value}
            path={path}
            hints={hints}
            level={level}
            showLabel={false}
            isDetailView
          />
        </div>
      )}
    </Card>
  );
}
