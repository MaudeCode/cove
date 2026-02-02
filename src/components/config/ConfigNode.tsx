/**
 * ConfigNode
 *
 * Recursively renders config nodes based on their schema type.
 * Follows Cove's SettingsView patterns: horizontal rows, clean cards.
 */

import { useState } from "preact/hooks";
import { t } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { Dropdown } from "@/components/ui/Dropdown";
import { Textarea } from "@/components/ui/Textarea";
import { ChevronDown, ChevronRight, Plus, Trash2, Eye, EyeOff, GripVertical } from "lucide-preact";
import type { JsonSchema, ConfigUiHints } from "@/types/config";
import { updateField, validationErrors, setValidationError } from "@/signals/config";
import {
  schemaType,
  schemaDefault,
  hintForPath,
  humanize,
  validateValue,
  pathToKey,
} from "@/lib/config/schema-utils";

interface ConfigNodeProps {
  schema: JsonSchema;
  value: unknown;
  path: (string | number)[];
  hints: ConfigUiHints;
  level?: number;
  showLabel?: boolean;
  /** When true, renders for the detail panel (no outer card wrapper) */
  isDetailView?: boolean;
}

export function ConfigNode({
  schema,
  value,
  path,
  hints,
  level = 0,
  showLabel = true,
  isDetailView = false,
}: ConfigNodeProps) {
  const type = schemaType(schema);
  const hint = hintForPath(path, hints) ?? {};
  const key = pathToKey(path);
  const label = hint.label ?? schema.title ?? humanize(path[path.length - 1] ?? "");
  const help = hint.help ?? schema.description;
  const errorMsg = validationErrors.value[key];

  // Handle unions (anyOf/oneOf)
  if (schema.anyOf || schema.oneOf) {
    return (
      <UnionNode
        schema={schema}
        value={value}
        path={path}
        hints={hints}
        level={level}
        label={label}
        help={help}
        showLabel={showLabel}
      />
    );
  }

  // Route based on type
  switch (type) {
    case "object":
      return (
        <ObjectNode
          schema={schema}
          value={value as Record<string, unknown> | null}
          path={path}
          hints={hints}
          level={level}
          label={label}
          help={help}
          isDetailView={isDetailView}
        />
      );

    case "array":
      return (
        <ArrayNode
          schema={schema}
          value={value as unknown[] | null}
          path={path}
          hints={hints}
          level={level}
          label={label}
          help={help}
        />
      );

    case "boolean":
      // Toggle uses horizontal layout with label/description built-in
      return (
        <SettingRow error={errorMsg}>
          <Toggle
            checked={Boolean(value ?? schema.default)}
            onChange={(checked) => {
              updateField(path, checked);
            }}
            label={showLabel ? label : undefined}
            description={help}
          />
        </SettingRow>
      );

    case "number":
    case "integer":
      return (
        <SettingRow
          label={showLabel ? label : undefined}
          description={help}
          error={errorMsg}
          inline
        >
          <Input
            type="number"
            value={value === undefined || value === null ? "" : String(value)}
            placeholder={hint.placeholder}
            onInput={(e) => {
              const val = (e.target as HTMLInputElement).value;
              const num = val === "" ? undefined : Number(val);
              updateField(path, num);
              setValidationError(key, validateValue(num, schema));
            }}
            min={schema.minimum}
            max={schema.maximum}
            class="w-24 text-right"
          />
        </SettingRow>
      );

    case "string":
      // Check for enum
      if (schema.enum) {
        return (
          <SettingRow
            label={showLabel ? label : undefined}
            description={help}
            error={errorMsg}
            inline
          >
            <Dropdown
              value={String(value ?? "")}
              options={schema.enum.map((v) => ({
                value: String(v),
                label: humanize(String(v)),
              }))}
              onChange={(v) => updateField(path, v)}
              size="sm"
              width="160px"
            />
          </SettingRow>
        );
      }

      // Sensitive field (tokens, passwords, secrets)
      if (hint.sensitive) {
        return (
          <SettingRow
            label={showLabel ? label : undefined}
            description={help}
            error={errorMsg}
            inline
          >
            <PasswordInput
              value={String(value ?? "")}
              placeholder={hint.placeholder}
              onChange={(v) => {
                updateField(path, v);
                setValidationError(key, validateValue(v, schema));
              }}
              wide
            />
          </SettingRow>
        );
      }

      // Long text - full width below label
      if ((schema.maxLength ?? 0) > 200) {
        return (
          <SettingRow label={showLabel ? label : undefined} description={help} error={errorMsg}>
            <Textarea
              value={String(value ?? "")}
              placeholder={hint.placeholder}
              onInput={(e) => {
                const v = (e.target as HTMLTextAreaElement).value;
                updateField(path, v);
                setValidationError(key, validateValue(v, schema));
              }}
              rows={4}
              class="w-full"
            />
          </SettingRow>
        );
      }

      // Determine input width based on format/content type
      const isUrl = schema.format === "uri" || schema.format === "url";
      const isPath =
        key.toLowerCase().includes("path") ||
        key.toLowerCase().includes("dir") ||
        key.toLowerCase().includes("file");
      const inputWidth = isUrl || isPath ? "w-72" : "w-48";

      // Regular string
      return (
        <SettingRow
          label={showLabel ? label : undefined}
          description={help}
          error={errorMsg}
          inline
        >
          <Input
            type={isUrl ? "url" : "text"}
            value={String(value ?? "")}
            placeholder={hint.placeholder}
            onInput={(e) => {
              const v = (e.target as HTMLInputElement).value;
              updateField(path, v);
              setValidationError(key, validateValue(v, schema));
            }}
            class={inputWidth}
          />
        </SettingRow>
      );

    default:
      // Fallback to JSON editor
      return (
        <SettingRow label={showLabel ? label : undefined} description={help} error={errorMsg}>
          <JsonEditor value={value} onChange={(v) => updateField(path, v)} />
        </SettingRow>
      );
  }
}

// ============================================
// Setting Row (matches SettingsView pattern)
// ============================================

interface SettingRowProps {
  label?: string;
  description?: string;
  error?: string;
  /** If true, render label left and control right inline */
  inline?: boolean;
  children: preact.ComponentChildren;
}

function SettingRow({ label, description, error, inline, children }: SettingRowProps) {
  // For inline layout: label+description left, control right
  if (inline && label) {
    return (
      <div class="py-3">
        <div class="flex items-start justify-between gap-8">
          <div class="min-w-0 max-w-sm">
            <label class="text-sm font-medium text-[var(--color-text-primary)]">{label}</label>
            {description && (
              <p class="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
          <div class="flex-shrink-0">{children}</div>
        </div>
        {error && <p class="text-xs text-[var(--color-error)] mt-1">{error}</p>}
      </div>
    );
  }

  // For block layout (textareas, JSON editors, or label-less)
  return (
    <div class="py-3">
      {label && (
        <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
          {label}
        </label>
      )}
      {description && (
        <p class="text-xs text-[var(--color-text-muted)] mb-2 leading-relaxed max-w-lg">
          {description}
        </p>
      )}
      {children}
      {error && <p class="text-xs text-[var(--color-error)] mt-1">{error}</p>}
    </div>
  );
}

// ============================================
// Object Node
// ============================================

function ObjectNode({
  schema,
  value,
  path,
  hints,
  level,
  label,
  help,
  isDetailView = false,
}: {
  schema: JsonSchema;
  value: Record<string, unknown> | null;
  path: (string | number)[];
  hints: ConfigUiHints;
  level: number;
  label: string;
  help?: string;
  isDetailView?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(level < 2 || isDetailView);
  const properties = schema.properties ?? {};
  const propertyKeys = Object.keys(properties);
  const actualValue = value ?? {};

  // In detail view at level 0, render fields directly (no wrapper)
  if (isDetailView && level === 0) {
    return (
      <div class="space-y-2">
        {help && <p class="text-sm text-[var(--color-text-muted)] mb-4">{help}</p>}
        {propertyKeys.map((key) => (
          <ConfigNode
            key={key}
            schema={properties[key]}
            value={actualValue[key]}
            path={[...path, key]}
            hints={hints}
            level={level + 1}
          />
        ))}
      </div>
    );
  }

  // Nested object: collapsible section with subtle styling
  return (
    <div class="mt-6 first:mt-3">
      <button
        type="button"
        class="flex items-center gap-2 py-2 text-left group"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span class="text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] transition-colors">
          {isExpanded ? <ChevronDown class="w-4 h-4" /> : <ChevronRight class="w-4 h-4" />}
        </span>
        <span class="text-sm font-semibold text-[var(--color-text-primary)]">{label}</span>
        <span class="text-xs text-[var(--color-text-muted)]">({propertyKeys.length})</span>
      </button>

      {isExpanded && (
        <div class="ml-6 pl-4 border-l border-[var(--color-border)] mt-1">
          {help && (
            <p class="text-xs text-[var(--color-text-muted)] pb-2 leading-relaxed">{help}</p>
          )}
          {propertyKeys.map((key) => (
            <ConfigNode
              key={key}
              schema={properties[key]}
              value={actualValue[key]}
              path={[...path, key]}
              hints={hints}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// Array Node
// ============================================

function ArrayNode({
  schema,
  value,
  path,
  hints,
  level,
  label,
  help,
}: {
  schema: JsonSchema;
  value: unknown[] | null;
  path: (string | number)[];
  hints: ConfigUiHints;
  level: number;
  label: string;
  help?: string;
}) {
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
            <DraggableArrayItem
              key={index}
              index={index}
              path={path}
              onReorder={(from, to) => {
                const next = [...items];
                const [moved] = next.splice(from, 1);
                next.splice(to, 0, moved);
                updateField(path, next);
              }}
            >
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
                onReorder={(from, to) => {
                  const next = [...items];
                  const [moved] = next.splice(from, 1);
                  next.splice(to, 0, moved);
                  updateField(path, next);
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

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
// Union Node (anyOf/oneOf)
// ============================================

function UnionNode({
  schema,
  value,
  path,
  hints,
  level,
  label,
  help,
  showLabel,
}: {
  schema: JsonSchema;
  value: unknown;
  path: (string | number)[];
  hints: ConfigUiHints;
  level: number;
  label: string;
  help?: string;
  showLabel?: boolean;
}) {
  const variants = schema.anyOf ?? schema.oneOf ?? [];
  const nonNull = variants.filter(
    (v) => v.type !== "null" && !(Array.isArray(v.type) && v.type.includes("null")),
  );

  // Single non-null variant - just render it
  if (nonNull.length === 1) {
    return (
      <ConfigNode
        schema={nonNull[0]}
        value={value}
        path={path}
        hints={hints}
        level={level}
        showLabel={showLabel}
      />
    );
  }

  // Check if it's enum-like (all const values)
  const literals = nonNull
    .map((v) => v.const ?? (v.enum?.length === 1 ? v.enum[0] : undefined))
    .filter((v) => v !== undefined);

  if (literals.length === nonNull.length && literals.length > 0) {
    const options = nonNull.map((v, i) => ({
      value: String(literals[i]),
      label: v.title ?? humanize(String(literals[i])),
    }));

    return (
      <SettingRow
        label={showLabel !== false ? label : undefined}
        description={help}
        inline={showLabel !== false}
      >
        <Dropdown
          value={String(value ?? "")}
          options={options}
          onChange={(v) => updateField(path, v)}
          size="sm"
          width="160px"
        />
      </SettingRow>
    );
  }

  // Complex union - fall back to JSON
  return (
    <SettingRow label={showLabel !== false ? label : undefined} description={help}>
      <JsonEditor value={value} onChange={(v) => updateField(path, v)} />
    </SettingRow>
  );
}

// ============================================
// Helper Components
// ============================================

function PasswordInput({
  value,
  placeholder,
  onChange,
  wide,
}: {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  wide?: boolean;
}) {
  const [show, setShow] = useState(false);

  return (
    <div class="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        placeholder={placeholder}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        class={`pr-10 ${wide ? "w-72" : "w-48"}`}
      />
      <button
        type="button"
        class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
        onClick={() => setShow(!show)}
        aria-label={show ? t("config.field.hidePassword") : t("config.field.showPassword")}
      >
        {show ? <EyeOff class="w-4 h-4" /> : <Eye class="w-4 h-4" />}
      </button>
    </div>
  );
}

function JsonEditor({ value, onChange }: { value: unknown; onChange: (value: unknown) => void }) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2) ?? "");
  const [parseError, setParseError] = useState<string | null>(null);

  const handleBlur = () => {
    try {
      const parsed = JSON.parse(text);
      onChange(parsed);
      setParseError(null);
    } catch {
      setParseError(t("config.field.invalidJson"));
    }
  };

  return (
    <div class="space-y-1">
      <Textarea
        value={text}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        onBlur={handleBlur}
        rows={6}
        class="font-mono text-sm w-full"
      />
      {parseError && <p class="text-xs text-[var(--color-error)]">{parseError}</p>}
    </div>
  );
}

/** Draggable array item wrapper with grip handle */
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
      // Only allow reorder within the same array
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
