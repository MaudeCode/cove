/**
 * ConfigNode
 *
 * Recursively renders config nodes based on their schema type.
 * Routes to specialized components for object, array, and union types.
 */

import { useEffect, useState } from "preact/hooks";
import { useSignalEffect } from "@preact/signals";
import { Input } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { Dropdown } from "@/components/ui/Dropdown";
import { Textarea } from "@/components/ui/Textarea";
import type { JsonSchema, ConfigUiHints } from "@/types/config";
import { draftRevision, updateField, validationErrors, setValidationError } from "@/signals/config";
import {
  schemaType,
  hintForPath,
  humanize,
  validateValue,
  pathToKey,
} from "@/lib/config/schema-utils";
import { SettingRow, PasswordInput, JsonEditor } from "./ConfigFieldHelpers";
import { ObjectNode } from "./ConfigObjectNode";
import { ArrayNode } from "./ConfigArrayNode";
import { UnionNode } from "./ConfigUnionNode";

export interface ConfigNodeProps {
  schema: JsonSchema;
  value: unknown;
  path: (string | number)[];
  hints: ConfigUiHints;
  level?: number;
  showLabel?: boolean;
  /** When true, renders for the detail panel (no outer card wrapper) */
  isDetailView?: boolean;
  /** When true, skip rendering nav-worthy children (for mobile "General" view) */
  skipNavWorthy?: boolean;
}

export function ConfigNode({
  schema,
  value,
  path,
  hints,
  level = 0,
  showLabel = true,
  isDetailView = false,
  skipNavWorthy = false,
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
          skipNavWorthy={skipNavWorthy}
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
          <NumericInput
            schema={schema}
            value={value}
            path={path}
            fieldKey={key}
            placeholder={hint.placeholder}
          />
        </SettingRow>
      );

    case "string":
      return renderStringField({
        schema,
        value,
        path,
        hint,
        key,
        label,
        help,
        errorMsg,
        showLabel,
      });

    default:
      return (
        <SettingRow label={showLabel ? label : undefined} description={help} error={errorMsg}>
          <JsonEditor value={value} onChange={(v) => updateField(path, v)} />
        </SettingRow>
      );
  }
}

function NumericInput({
  schema,
  value,
  path,
  fieldKey,
  placeholder,
}: {
  schema: JsonSchema;
  value: unknown;
  path: (string | number)[];
  fieldKey: string;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState(() =>
    value === undefined || value === null ? "" : String(value),
  );

  useEffect(() => {
    setInputValue(value === undefined || value === null ? "" : String(value));
  }, [value]);

  useSignalEffect(() => {
    void draftRevision.value;
    setInputValue(value === undefined || value === null ? "" : String(value));
  });

  return (
    <Input
      type="number"
      value={inputValue}
      placeholder={placeholder}
      onInput={(e) => {
        const val = (e.target as HTMLInputElement).value;
        setInputValue(val);
        const num = val === "" ? undefined : Number(val);
        const validationError = validateValue(num, schema);
        if (typeof num === "number" && !Number.isFinite(num)) {
          setValidationError(fieldKey, validationError);
          return;
        }

        updateField(path, num);
        setValidationError(fieldKey, validationError);
      }}
      min={schema.minimum}
      max={schema.maximum}
      class="w-full sm:w-24 text-right"
    />
  );
}

// ============================================
// String Field Rendering
// ============================================

function renderStringField({
  schema,
  value,
  path,
  hint,
  key,
  label,
  help,
  errorMsg,
  showLabel,
}: {
  schema: JsonSchema;
  value: unknown;
  path: (string | number)[];
  hint: { placeholder?: string; sensitive?: boolean };
  key: string;
  label: string;
  help?: string;
  errorMsg?: string;
  showLabel: boolean;
}) {
  // Enum → Dropdown
  if (schema.enum) {
    return (
      <SettingRow label={showLabel ? label : undefined} description={help} error={errorMsg} inline>
        <Dropdown
          value={String(value ?? "")}
          options={schema.enum.map((v) => ({
            value: String(v),
            label: humanize(String(v)),
          }))}
          onChange={(v) => updateField(path, v)}
          size="sm"
          class="w-full sm:w-auto sm:inline-block"
        />
      </SettingRow>
    );
  }

  // Sensitive → Password input
  if (hint.sensitive) {
    return (
      <SettingRow label={showLabel ? label : undefined} description={help} error={errorMsg} inline>
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

  // Long text → Textarea
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
  const inputWidth = isUrl || isPath ? "w-full sm:w-72" : "w-full sm:w-48";

  // Regular string input
  return (
    <SettingRow label={showLabel ? label : undefined} description={help} error={errorMsg} inline>
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
}
