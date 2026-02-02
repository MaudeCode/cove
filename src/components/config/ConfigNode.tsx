/**
 * ConfigNode
 *
 * Recursively renders config nodes based on their schema type.
 * This is the core rendering engine for the config editor.
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
import { Badge } from "@/components/ui/Badge";
import { ChevronDown, ChevronRight, Plus, Trash2, Eye, EyeOff } from "lucide-preact";
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
      return (
        <FieldWrapper label={showLabel ? label : undefined} help={help} error={errorMsg}>
          <Toggle
            checked={Boolean(value ?? schema.default)}
            onChange={(checked) => {
              updateField(path, checked);
            }}
          />
        </FieldWrapper>
      );

    case "number":
    case "integer":
      return (
        <FieldWrapper label={showLabel ? label : undefined} help={help} error={errorMsg}>
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
          />
        </FieldWrapper>
      );

    case "string":
      // Check for enum
      if (schema.enum) {
        return (
          <FieldWrapper label={showLabel ? label : undefined} help={help} error={errorMsg}>
            {schema.enum.length <= 5 ? (
              <SegmentedControl
                value={value}
                options={schema.enum.map((v) => ({
                  value: String(v),
                  label: humanize(String(v)),
                }))}
                onChange={(v) => updateField(path, v)}
              />
            ) : (
              <Dropdown
                value={String(value ?? "")}
                options={schema.enum.map((v) => ({
                  value: String(v),
                  label: humanize(String(v)),
                }))}
                onChange={(v) => updateField(path, v)}
              />
            )}
          </FieldWrapper>
        );
      }

      // Sensitive field
      if (hint.sensitive) {
        return (
          <FieldWrapper label={showLabel ? label : undefined} help={help} error={errorMsg}>
            <PasswordInput
              value={String(value ?? "")}
              placeholder={hint.placeholder}
              onChange={(v) => {
                updateField(path, v);
                setValidationError(key, validateValue(v, schema));
              }}
            />
          </FieldWrapper>
        );
      }

      // Long text
      if ((schema.maxLength ?? 0) > 200) {
        return (
          <FieldWrapper label={showLabel ? label : undefined} help={help} error={errorMsg}>
            <Textarea
              value={String(value ?? "")}
              placeholder={hint.placeholder}
              onInput={(e) => {
                const v = (e.target as HTMLTextAreaElement).value;
                updateField(path, v);
                setValidationError(key, validateValue(v, schema));
              }}
              rows={4}
            />
          </FieldWrapper>
        );
      }

      // Regular string
      return (
        <FieldWrapper label={showLabel ? label : undefined} help={help} error={errorMsg}>
          <Input
            type={schema.format === "uri" ? "url" : "text"}
            value={String(value ?? "")}
            placeholder={hint.placeholder}
            onInput={(e) => {
              const v = (e.target as HTMLInputElement).value;
              updateField(path, v);
              setValidationError(key, validateValue(v, schema));
            }}
          />
        </FieldWrapper>
      );

    default:
      // Fallback to JSON editor
      return (
        <FieldWrapper label={showLabel ? label : undefined} help={help} error={errorMsg}>
          <JsonEditor value={value} onChange={(v) => updateField(path, v)} />
        </FieldWrapper>
      );
  }
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

  // In detail view, render fields directly (no card wrapper)
  if (isDetailView && level === 0) {
    return (
      <div class="space-y-6">
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

  // For top-level (level 0), render as a card
  if (level === 0) {
    return (
      <Card padding="none" class="overflow-hidden">
        <button
          type="button"
          class="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-bg-tertiary)] text-left font-medium"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          <span class="text-[var(--color-text-muted)]">
            {isExpanded ? <ChevronDown class="w-5 h-5" /> : <ChevronRight class="w-5 h-5" />}
          </span>
          <span>{label}</span>
          <Badge variant="default" class="ml-auto">
            {propertyKeys.length}
          </Badge>
        </button>

        {isExpanded && (
          <div class="border-t border-[var(--color-border)] px-4 py-4 space-y-4">
            {help && <p class="text-sm text-[var(--color-text-muted)]">{help}</p>}
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
      </Card>
    );
  }

  // For nested objects, render as collapsible section
  return (
    <div class="border border-[var(--color-border)] rounded-lg overflow-hidden">
      <button
        type="button"
        class="w-full flex items-center gap-2 px-3 py-2 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] text-left text-sm font-medium"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span class="text-[var(--color-text-muted)]">
          {isExpanded ? <ChevronDown class="w-4 h-4" /> : <ChevronRight class="w-4 h-4" />}
        </span>
        <span>{label}</span>
      </button>

      {isExpanded && (
        <div class="px-3 py-3 space-y-3 bg-[var(--color-bg-primary)]">
          {help && <p class="text-xs text-[var(--color-text-muted)]">{help}</p>}
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
      <FieldWrapper label={label} help={help}>
        <div class="space-y-2">
          {items.map((item, index) => (
            <div key={index} class="flex items-center gap-2">
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
            </div>
          ))}
          <Button variant="secondary" size="sm" icon={Plus} onClick={addItem}>
            {t("config.field.addItem")}
          </Button>
        </div>
      </FieldWrapper>
    );
  }

  // Array of objects
  return (
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <button
          type="button"
          class="flex items-center gap-2 text-sm font-medium"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span class="text-[var(--color-text-muted)]">
            {isExpanded ? <ChevronDown class="w-4 h-4" /> : <ChevronRight class="w-4 h-4" />}
          </span>
          {label}
          <Badge variant="default">{items.length}</Badge>
        </button>
        <Button variant="secondary" size="sm" icon={Plus} onClick={addItem}>
          {t("config.field.addItem")}
        </Button>
      </div>

      {help && <p class="text-xs text-[var(--color-text-muted)]">{help}</p>}

      {isExpanded && (
        <div class="space-y-2 pl-4 border-l-2 border-[var(--color-border)]">
          {items.length === 0 ? (
            <p class="text-sm text-[var(--color-text-muted)] py-2">{t("config.field.noItems")}</p>
          ) : (
            items.map((item, index) => (
              <ArrayItemCard
                key={index}
                schema={itemSchema}
                value={item}
                path={[...path, index]}
                hints={hints}
                level={level + 1}
                index={index}
                onRemove={() => removeItem(index)}
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
  hints,
  level,
  index,
  onRemove,
}: {
  schema: JsonSchema;
  value: unknown;
  path: (string | number)[];
  hints: ConfigUiHints;
  level: number;
  index: number;
  onRemove: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const objValue = (value ?? {}) as Record<string, unknown>;

  // Try to get a display name from the item
  const displayName =
    objValue.id ?? objValue.name ?? objValue.label ?? objValue.displayName ?? `#${index + 1}`;
  const identity = objValue.identity as Record<string, unknown> | undefined;
  const emoji = identity?.emoji ?? "";

  return (
    <Card padding="none" class="overflow-hidden">
      <div class="flex items-center gap-2 px-3 py-2 bg-[var(--color-bg-secondary)]">
        <button
          type="button"
          class="flex-1 flex items-center gap-2 text-left text-sm font-medium"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span class="text-[var(--color-text-muted)]">
            {isExpanded ? <ChevronDown class="w-4 h-4" /> : <ChevronRight class="w-4 h-4" />}
          </span>
          {emoji && <span>{emoji}</span>}
          <span>{String(displayName)}</span>
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
        <div class="px-3 py-3 space-y-3">
          <ConfigNode
            schema={schema}
            value={value}
            path={path}
            hints={hints}
            level={level}
            showLabel={false}
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
}: {
  schema: JsonSchema;
  value: unknown;
  path: (string | number)[];
  hints: ConfigUiHints;
  level: number;
  label: string;
  help?: string;
}) {
  const variants = schema.anyOf ?? schema.oneOf ?? [];
  const nonNull = variants.filter(
    (v) => v.type !== "null" && !(Array.isArray(v.type) && v.type.includes("null")),
  );

  // Single non-null variant - just render it
  if (nonNull.length === 1) {
    return <ConfigNode schema={nonNull[0]} value={value} path={path} hints={hints} level={level} />;
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
      <FieldWrapper label={label} help={help}>
        {options.length <= 5 ? (
          <SegmentedControl
            value={value}
            options={options}
            onChange={(v) => updateField(path, v)}
          />
        ) : (
          <Dropdown
            value={String(value ?? "")}
            options={options}
            onChange={(v) => updateField(path, v)}
          />
        )}
      </FieldWrapper>
    );
  }

  // Complex union - fall back to JSON
  return (
    <FieldWrapper label={label} help={help}>
      <JsonEditor value={value} onChange={(v) => updateField(path, v)} />
    </FieldWrapper>
  );
}

// ============================================
// Helper Components
// ============================================

function FieldWrapper({
  label,
  help,
  error,
  children,
}: {
  label?: string;
  help?: string;
  error?: string;
  children: preact.ComponentChildren;
}) {
  return (
    <div class="space-y-1">
      {label && <label class="block text-sm font-medium">{label}</label>}
      {help && <p class="text-xs text-[var(--color-text-muted)]">{help}</p>}
      <div class="mt-1">{children}</div>
      {error && <p class="text-xs text-[var(--color-error)]">{error}</p>}
    </div>
  );
}

function PasswordInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const [show, setShow] = useState(false);

  return (
    <div class="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        placeholder={placeholder}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        class="pr-10"
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

function SegmentedControl({
  value,
  options,
  onChange,
}: {
  value: unknown;
  options: { value: string; label: string }[];
  onChange: (value: unknown) => void;
}) {
  return (
    <div class="inline-flex rounded-lg border border-[var(--color-border)] overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          class={`px-3 py-1.5 text-sm font-medium transition-colors ${
            String(value) === opt.value
              ? "bg-[var(--color-accent)] text-white"
              : "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
          }`}
          onClick={() => {
            if (typeof value === "boolean") {
              onChange(opt.value === "true");
            } else if (typeof value === "number") {
              onChange(Number(opt.value));
            } else {
              onChange(opt.value);
            }
          }}
        >
          {opt.label}
        </button>
      ))}
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
      setParseError("Invalid JSON");
    }
  };

  return (
    <div class="space-y-1">
      <Textarea
        value={text}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        onBlur={handleBlur}
        rows={6}
        class="font-mono text-sm"
      />
      {parseError && <p class="text-xs text-[var(--color-error)]">{parseError}</p>}
    </div>
  );
}
