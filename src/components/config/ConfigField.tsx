/**
 * ConfigField
 *
 * Routes to the appropriate field component based on type.
 */

import { t } from "@/lib/i18n";
import { Input } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { Dropdown } from "@/components/ui/Dropdown";
import { Textarea } from "@/components/ui/Textarea";
import { Eye, EyeOff } from "lucide-preact";
import { useState } from "preact/hooks";
import type { ConfigFieldInfo } from "@/types/config";
import { updateField, setValidationError, validationErrors } from "@/signals/config";
import { validateValue, humanize } from "@/lib/config/schema-utils";

interface ConfigFieldProps {
  field: ConfigFieldInfo;
}

export function ConfigField({ field }: ConfigFieldProps) {
  const { path, key, schema, hint, fieldType, value, required } = field;
  const label = hint.label ?? schema.title ?? humanize(path[path.length - 1]);
  const help = hint.help ?? schema.description;
  const placeholder = hint.placeholder ?? "";
  const errorMsg = validationErrors.value[key];

  const handleChange = (newValue: unknown) => {
    updateField(path, newValue);

    // Validate
    const error = validateValue(newValue, schema);
    setValidationError(key, error);
  };

  return (
    <div class="space-y-1">
      {/* Label */}
      <label class="block text-sm font-medium">
        {label}
        {required && <span class="text-[var(--color-error)] ml-1">*</span>}
      </label>

      {/* Help text */}
      {help && <p class="text-xs text-[var(--color-text-muted)]">{help}</p>}

      {/* Field */}
      <div class="mt-1">
        {fieldType === "toggle" && (
          <Toggle checked={Boolean(value)} onChange={(checked) => handleChange(checked)} />
        )}

        {fieldType === "string" && (
          <Input
            type="text"
            value={String(value ?? "")}
            placeholder={placeholder}
            onInput={(e) => handleChange((e.target as HTMLInputElement).value)}
          />
        )}

        {fieldType === "password" && (
          <PasswordField
            value={String(value ?? "")}
            placeholder={placeholder}
            onChange={handleChange}
          />
        )}

        {fieldType === "url" && (
          <Input
            type="url"
            value={String(value ?? "")}
            placeholder={placeholder}
            onInput={(e) => handleChange((e.target as HTMLInputElement).value)}
          />
        )}

        {fieldType === "number" && (
          <Input
            type="number"
            value={value === undefined || value === null ? "" : String(value)}
            placeholder={placeholder}
            onInput={(e) => {
              const val = (e.target as HTMLInputElement).value;
              handleChange(val === "" ? undefined : Number(val));
            }}
            min={schema.minimum}
            max={schema.maximum}
          />
        )}

        {fieldType === "textarea" && (
          <Textarea
            value={String(value ?? "")}
            placeholder={placeholder}
            onInput={(e) => handleChange((e.target as HTMLTextAreaElement).value)}
            rows={4}
          />
        )}

        {fieldType === "dropdown" && (
          <Dropdown
            value={String(value ?? "")}
            options={getEnumOptions(schema)}
            onChange={(v) => handleChange(v)}
            placeholder={placeholder || "Select..."}
          />
        )}

        {fieldType === "segmented" && (
          <SegmentedControl
            value={value}
            options={getEnumOptions(schema)}
            onChange={handleChange}
          />
        )}

        {(fieldType === "array" || fieldType === "object" || fieldType === "json") && (
          <JsonEditor value={value} onChange={handleChange} />
        )}
      </div>

      {/* Error */}
      {errorMsg && <p class="text-xs text-[var(--color-error)]">{errorMsg}</p>}
    </div>
  );
}

// ============================================
// Sub-Components
// ============================================

function PasswordField({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
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
            // Try to preserve original type
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

// ============================================
// Helpers
// ============================================

function getEnumOptions(schema: ConfigFieldInfo["schema"]): { value: string; label: string }[] {
  // Direct enum
  if (schema.enum) {
    return schema.enum.map((v) => ({
      value: String(v),
      label: humanize(String(v)),
    }));
  }

  // anyOf/oneOf with const values
  const variants = schema.anyOf ?? schema.oneOf ?? [];
  const options: { value: string; label: string }[] = [];

  for (const variant of variants) {
    if (variant.type === "null") continue;
    const val = variant.const ?? (variant.enum?.length === 1 ? variant.enum[0] : undefined);
    if (val !== undefined) {
      options.push({
        value: String(val),
        label: variant.title ?? humanize(String(val)),
      });
    }
  }

  return options;
}
