/**
 * ConfigArrayNode
 *
 * Renders array schema nodes with drag-and-drop reordering.
 */

import { useEffect, useRef, useState } from "preact/hooks";
import { useSignalEffect } from "@preact/signals";
import { t } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { ChevronDown, ChevronRight, ChevronUp, Plus, Trash2, GripVertical } from "lucide-preact";
import type { JsonSchema, ConfigUiHints } from "@/types/config";
import { draftRevision, updateField, setValidationError, validationErrors } from "@/signals/config";
import { schemaType, schemaDefault, pathToKey, validateValue } from "@/lib/config/schema-utils";
import { ConfigNode } from "./ConfigNode";

let nextArrayItemId = 0;

function createArrayItemKey(): string {
  nextArrayItemId += 1;
  return `array-item-${nextArrayItemId}`;
}

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
  const arrayKey = pathToKey(path);
  const instanceId = useRef(createArrayItemKey()).current;
  const [itemKeys, setItemKeys] = useState(() => items.map(createArrayItemKey));
  const keyRevision = useRef(draftRevision.value);

  useEffect(() => {
    setItemKeys((current) => {
      if (current.length === items.length) return current;
      if (current.length > items.length) return current.slice(0, items.length);

      return [
        ...current,
        ...Array.from({ length: items.length - current.length }, createArrayItemKey),
      ];
    });
  }, [items.length]);

  useSignalEffect(() => {
    if (keyRevision.current === draftRevision.value) return;
    keyRevision.current = draftRevision.value;
    setItemKeys(items.map(createArrayItemKey));
  });

  const remapArrayValidationErrors = (mapIndex: (index: number) => number | null) => {
    const prefix = `${arrayKey}.`;
    const remapped: [string, string][] = [];

    for (const [key, message] of Object.entries(validationErrors.value)) {
      if (key === arrayKey) {
        setValidationError(key, null);
        continue;
      }
      if (!key.startsWith(prefix)) continue;

      setValidationError(key, null);
      const rest = key.slice(prefix.length);
      const [indexPart, ...segments] = rest.split(".");
      const index = Number(indexPart);
      if (!Number.isInteger(index) || index < 0) continue;

      const nextIndex = mapIndex(index);
      if (nextIndex === null) continue;

      remapped.push([pathToKey([...path, nextIndex, ...segments]), message]);
    }

    for (const [key, message] of remapped) {
      setValidationError(key, message);
    }
  };

  const clearArrayRootValidationError = () => {
    setValidationError(arrayKey, null);
  };

  const addItem = () => {
    const newItem = schemaDefault(itemSchema);
    clearArrayRootValidationError();
    setItemKeys((current) => [...current, createArrayItemKey()]);
    updateField(path, [...items, newItem]);
  };

  const removeItem = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    setItemKeys((current) => current.filter((_, i) => i !== index));
    remapArrayValidationErrors((currentIndex) => {
      if (currentIndex === index) return null;
      return currentIndex > index ? currentIndex - 1 : currentIndex;
    });
    updateField(path, next);
  };

  const reorderItems = (from: number, to: number) => {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItemKeys((current) => {
      const nextKeys = [...current];
      const [movedKey] = nextKeys.splice(from, 1);
      nextKeys.splice(to, 0, movedKey);
      return nextKeys;
    });
    remapArrayValidationErrors((currentIndex) => {
      if (currentIndex === from) return to;
      if (from < to && currentIndex > from && currentIndex <= to) return currentIndex - 1;
      if (from > to && currentIndex >= to && currentIndex < from) return currentIndex + 1;
      return currentIndex;
    });
    updateField(path, next);
  };

  // Simple array of primitives
  if (itemType === "string" || itemType === "number" || itemType === "integer") {
    const isNumericItem = itemType === "number" || itemType === "integer";

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
            <PrimitiveArrayItem
              key={itemKeys[index] ?? index}
              index={index}
              inputId={`config-array-${instanceId}-${itemKeys[index] ?? index}`}
              item={item}
              itemSchema={itemSchema}
              isNumericItem={isNumericItem}
              items={items}
              path={path}
              removeItem={removeItem}
              reorderItems={reorderItems}
            />
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
                key={itemKeys[index] ?? index}
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

function PrimitiveArrayItem({
  index,
  inputId,
  item,
  itemSchema,
  isNumericItem,
  items,
  path,
  removeItem,
  reorderItems,
}: {
  index: number;
  inputId: string;
  item: unknown;
  itemSchema: JsonSchema;
  isNumericItem: boolean;
  items: unknown[];
  path: (string | number)[];
  removeItem: (index: number) => void;
  reorderItems: (from: number, to: number) => void;
}) {
  const itemPath = [...path, index];
  const itemKey = pathToKey(itemPath);
  const errorMsg = validationErrors.value[itemKey];
  const [inputValue, setInputValue] = useState(() => String(item ?? ""));

  useEffect(() => {
    setInputValue(String(item ?? ""));
  }, [item]);

  useSignalEffect(() => {
    void draftRevision.value;
    setInputValue(String(item ?? ""));
  });

  return (
    <div>
      <div class="flex items-center gap-1 p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)]">
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
          id={inputId}
          type={isNumericItem ? "number" : "text"}
          value={inputValue}
          error={errorMsg}
          onInput={(e) => {
            const val = (e.target as HTMLInputElement).value;
            setInputValue(val);
            if (isNumericItem && val === "") {
              setValidationError(itemKey, t("config.validation.mustBeNumber"));
              return;
            }

            const next = [...items];
            const nextValue = isNumericItem ? Number(val) : val;
            if (isNumericItem && !Number.isFinite(nextValue)) {
              setValidationError(itemKey, t("config.validation.mustBeNumber"));
              return;
            }

            const validationError = validateValue(nextValue, itemSchema);
            setValidationError(itemKey, validationError);
            if (validationError) return;

            next[index] = nextValue;
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
