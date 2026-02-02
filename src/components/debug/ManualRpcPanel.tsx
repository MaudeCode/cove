/**
 * ManualRpcPanel
 *
 * Send raw gateway method calls with custom JSON params.
 * Supports both form builder and raw JSON modes.
 */

import { signal, computed } from "@preact/signals";
import { t } from "@/lib/i18n";
import { formatJson } from "@/lib/utils";
import { isConnected, send } from "@/lib/gateway";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { IconButton } from "@/components/ui/IconButton";
import { Send, Play, Plus, Trash2, Code, FormInput } from "lucide-preact";
import { JsonBlock } from "./JsonBlock";

// ============================================
// Types
// ============================================

interface ParamField {
  id: string;
  key: string;
  value: string;
}

// ============================================
// State
// ============================================

const rpcMethod = signal("system-presence");
const rpcParams = signal("{}");
const rpcResult = signal<{ ok: boolean; data: unknown } | null>(null);
const rpcLoading = signal(false);
const rpcError = signal<string | null>(null);

/** Form vs JSON mode */
const isFormMode = signal(true);

/** Form fields for form mode */
const formFields = signal<ParamField[]>([]);

/** Counter for unique field IDs */
let fieldCounter = 0;

// ============================================
// Helpers
// ============================================

/** Build params object from form fields */
const formParams = computed(() => {
  const params: Record<string, string> = {};
  for (const field of formFields.value) {
    if (field.key.trim()) {
      params[field.key.trim()] = field.value;
    }
  }
  return params;
});

/** Get the effective params (from form or JSON depending on mode) */
function getEffectiveParams(): unknown {
  if (isFormMode.value) {
    const params = formParams.value;
    return Object.keys(params).length > 0 ? params : undefined;
  }
  const paramsStr = rpcParams.value.trim();
  if (!paramsStr || paramsStr === "{}") return undefined;
  return JSON.parse(paramsStr);
}

function addField() {
  formFields.value = [...formFields.value, { id: `field_${++fieldCounter}`, key: "", value: "" }];
}

function removeField(id: string) {
  formFields.value = formFields.value.filter((f) => f.id !== id);
}

function updateField(id: string, updates: Partial<ParamField>) {
  formFields.value = formFields.value.map((f) => (f.id === id ? { ...f, ...updates } : f));
}

/** Sync form fields to JSON when switching modes */
function syncFormToJson() {
  const params = formParams.value;
  rpcParams.value = Object.keys(params).length > 0 ? JSON.stringify(params, null, 2) : "{}";
}

/** Sync JSON to form fields when switching modes */
function syncJsonToForm() {
  try {
    const parsed = JSON.parse(rpcParams.value || "{}");
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      formFields.value = Object.entries(parsed).map(([key, value]) => ({
        id: `field_${++fieldCounter}`,
        key,
        value: typeof value === "string" ? value : JSON.stringify(value),
      }));
    }
  } catch {
    // Invalid JSON, keep existing fields
  }
}

function toggleMode() {
  if (isFormMode.value) {
    // Switching to JSON mode - sync form to JSON
    syncFormToJson();
  } else {
    // Switching to Form mode - sync JSON to form
    syncJsonToForm();
  }
  isFormMode.value = !isFormMode.value;
}

async function callRpc() {
  if (!isConnected.value) return;

  rpcLoading.value = true;
  rpcError.value = null;
  rpcResult.value = null;

  try {
    const params = getEffectiveParams();
    const result = await send<unknown>(rpcMethod.value, params);
    rpcResult.value = { ok: true, data: result };
  } catch (err) {
    rpcError.value = err instanceof Error ? err.message : "RPC call failed";
    rpcResult.value = { ok: false, data: null };
  } finally {
    rpcLoading.value = false;
  }
}

// ============================================
// Component
// ============================================

export function ManualRpcPanel() {
  const connected = isConnected.value;

  return (
    <Card>
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <Send size={18} class="text-[var(--color-warning)]" />
          <h2 class="font-medium">{t("debug.manualRpc")}</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleMode}
          icon={isFormMode.value ? <Code size={14} /> : <FormInput size={14} />}
        >
          {isFormMode.value ? t("debug.jsonMode") : t("debug.formMode")}
        </Button>
      </div>

      <p class="text-sm text-[var(--color-text-muted)] mb-4">{t("debug.manualRpcDesc")}</p>

      <div class="space-y-4">
        {/* Method */}
        <div>
          <label htmlFor="rpc-method" class="block text-sm font-medium mb-1">
            {t("debug.method")}
          </label>
          <Input
            id="rpc-method"
            value={rpcMethod.value}
            onInput={(e) => {
              rpcMethod.value = (e.target as HTMLInputElement).value;
            }}
            placeholder="e.g., system-presence, status, health"
            class="font-mono"
            fullWidth
          />
        </div>

        {/* Params - Form Mode */}
        {isFormMode.value ? (
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium">{t("debug.params")}</span>
              <Button variant="ghost" size="sm" onClick={addField} icon={<Plus size={14} />}>
                {t("debug.addParam")}
              </Button>
            </div>
            {formFields.value.length === 0 ? (
              <p class="text-sm text-[var(--color-text-muted)] py-3 text-center">
                {t("debug.noParams")}
              </p>
            ) : (
              <div class="space-y-2">
                {formFields.value.map((field) => (
                  <div key={field.id} class="flex items-center gap-2">
                    <Input
                      value={field.key}
                      onInput={(e) =>
                        updateField(field.id, { key: (e.target as HTMLInputElement).value })
                      }
                      placeholder="key"
                      class="font-mono flex-1"
                    />
                    <Input
                      value={field.value}
                      onInput={(e) =>
                        updateField(field.id, { value: (e.target as HTMLInputElement).value })
                      }
                      placeholder="value"
                      class="font-mono flex-1"
                    />
                    <IconButton
                      icon={<Trash2 size={14} />}
                      size="sm"
                      variant="ghost"
                      label={t("actions.delete")}
                      onClick={() => removeField(field.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Params - JSON Mode */
          <div>
            <label htmlFor="rpc-params" class="block text-sm font-medium mb-1">
              {t("debug.paramsJson")}
            </label>
            <Textarea
              id="rpc-params"
              value={rpcParams.value}
              onInput={(e) => {
                rpcParams.value = (e.target as HTMLTextAreaElement).value;
              }}
              placeholder="{}"
              rows={4}
              class="font-mono text-sm"
              fullWidth
            />
          </div>
        )}

        {/* Call button */}
        <Button
          variant="secondary"
          onClick={callRpc}
          disabled={!connected || !rpcMethod.value.trim()}
          loading={rpcLoading.value}
          icon={<Play size={14} />}
        >
          {t("debug.call")}
        </Button>

        {/* Error */}
        {rpcError.value && (
          <div class="text-sm text-[var(--color-error)] bg-[var(--color-error)]/10 p-3 rounded-lg">
            {rpcError.value}
          </div>
        )}

        {/* Result */}
        {rpcResult.value && (
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium">{t("debug.result")}</span>
              <Badge variant={rpcResult.value.ok ? "success" : "error"}>
                {rpcResult.value.ok ? t("debug.ok") : t("debug.error")}
              </Badge>
            </div>
            <JsonBlock
              value={formatJson(rpcResult.value.data)}
              maxHeight="max-h-64"
              id="rpc-result"
            />
          </div>
        )}
      </div>
    </Card>
  );
}
