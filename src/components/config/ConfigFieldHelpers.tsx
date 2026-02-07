/**
 * ConfigFieldHelpers
 *
 * Shared helper components for config field rendering.
 */

import { useState } from "preact/hooks";
import { t } from "@/lib/i18n";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Eye, EyeOff } from "lucide-preact";

// ============================================
// Setting Row
// ============================================

export interface SettingRowProps {
  label?: string;
  description?: string;
  error?: string;
  /** If true, render label left and control right inline */
  inline?: boolean;
  children: preact.ComponentChildren;
}

export function SettingRow({ label, description, error, inline, children }: SettingRowProps) {
  // For inline layout: stacks on mobile, side-by-side on desktop
  if (inline && label) {
    return (
      <div class="py-3">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <div class="min-w-0 sm:max-w-sm">
            <label class="text-sm font-medium text-[var(--color-text-primary)]">{label}</label>
            {description && (
              <p class="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
          <div class="w-full sm:w-auto sm:flex-shrink-0">{children}</div>
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
// Password Input
// ============================================

export function PasswordInput({
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
        class={`pr-10 w-full ${wide ? "sm:w-72" : "sm:w-48"}`}
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

// ============================================
// JSON Editor
// ============================================

export function JsonEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
}) {
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
