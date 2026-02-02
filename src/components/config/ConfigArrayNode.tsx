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
import { ChevronDown, ChevronRight, Plus, Trash2, GripVertical } from "lucide-preact";
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
        <div class="flex items-center justify-between mb-3">
          <div>
            <label class="text-sm font-semibold text-[var(--color-text-primary)]">{label}</label>
            {help && (
              <p class="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">{help}</p>
            )}
          </div>
          <Button variant="secondary" size="sm" icon={Plus} onClick={addItem}>
            {t("config.field.addItem")}
          </Button>
        </div>
        <div class="space-y-2 max-w-md">
          {items.map((item, index) => (
            <DraggableArrayItem key={index} index={index} path={path} onReorder={reorderItems}>
              <Input
                type={itemType === "number" ? "number" : "text"}
                value={String(item ?? "")}
                onInput={(e) => {
                  const val = (e.target as HTMLInputElement).value;
                  const next = [...items];
                  next[index] = itemType === "number" ? Number(val) : val;
                  updateField(path, next);
                }}
                class="flex-1"
              />
              <IconButton
                icon={<Trash2 class="w-4 h-4" />}
                label={t("config.field.removeItem")}
                onClick={() => removeItem(index)}
                size="sm"
                variant="ghost"
              />
            </DraggableArrayItem>
          ))}
          {items.length === 0 && (
            <p class="text-sm text-[var(--color-text-muted)] py-4 text-center border border-dashed border-[var(--color-border)] rounded-lg">
              {t("config.field.noItems")}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Array of objects
  return (
    <div class="mt-6 first:mt-3">
      <div class="flex items-center justify-between mb-3">
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
        <Button variant="secondary" size="sm" icon={Plus} onClick={addItem}>
          {t("config.field.addItem")}
        </Button>
      </div>

      {help && <p class="text-xs text-[var(--color-text-muted)] mb-3 leading-relaxed">{help}</p>}

      {isExpanded && (
        <div class="space-y-3">
          {items.length === 0 ? (
            <p class="text-sm text-[var(--color-text-muted)] py-4 text-center border border-dashed border-[var(--color-border)] rounded-lg">
              {t("config.field.noItems")}
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
      <div class="flex items-center gap-2 px-3 py-3">
        {/* Drag handle */}
        {totalItems > 1 && (
          <div
            class="p-1 cursor-grab text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] active:cursor-grabbing"
            title={t("config.field.dragToReorder")}
          >
            <GripVertical class="w-4 h-4" />
          </div>
        )}
        <button
          type="button"
          class="flex-1 flex items-center gap-2 text-left group"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          <span class="text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] transition-colors">
            {isExpanded ? <ChevronDown class="w-4 h-4" /> : <ChevronRight class="w-4 h-4" />}
          </span>
          {emoji && <span>{emoji}</span>}
          <span class="text-sm font-medium">{String(displayName)}</span>
        </button>
        <IconButton
          icon={<Trash2 class="w-4 h-4" />}
          label={t("config.field.removeItem")}
          onClick={onRemove}
          size="sm"
          variant="ghost"
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

// ============================================
// Draggable Array Item (for primitive arrays)
// ============================================

function DraggableArrayItem({
  index,
  path,
  onReorder,
  children,
}: {
  index: number;
  path: (string | number)[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  children: preact.ComponentChildren;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragStart = (e: DragEvent) => {
    setIsDragging(true);
    e.dataTransfer!.effectAllowed = "move";
    e.dataTransfer!.setData("text/plain", JSON.stringify({ path: path.join("."), index }));
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
      if (data.path === path.join(".") && data.index !== index) {
        onReorder(data.index, index);
      }
    } catch {
      // Invalid drop data
    }
  };

  return (
    <div
      class={`flex items-center gap-1 rounded-md transition-colors ${
        isDragging ? "opacity-50" : ""
      } ${isDragOver ? "bg-[var(--color-accent)]/10 ring-1 ring-[var(--color-accent)]" : ""}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        class="p-1 cursor-grab text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] active:cursor-grabbing"
        title={t("config.field.dragToReorder")}
      >
        <GripVertical class="w-4 h-4" />
      </div>
      {children}
    </div>
  );
}
