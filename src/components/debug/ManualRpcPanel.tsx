/**
 * ManualRpcPanel
 *
 * Send raw gateway method calls with custom JSON params.
 */

import { signal } from "@preact/signals";
import { t } from "@/lib/i18n";
import { isConnected, send } from "@/lib/gateway";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Spinner } from "@/components/ui/Spinner";
import { Send, Play } from "lucide-preact";

// ============================================
// State
// ============================================

const rpcMethod = signal("system-presence");
const rpcParams = signal("{}");
const rpcResult = signal<{ ok: boolean; data: unknown } | null>(null);
const rpcLoading = signal(false);
const rpcError = signal<string | null>(null);

// ============================================
// Helpers
// ============================================

function formatPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

async function callRpc() {
  if (!isConnected.value) return;

  rpcLoading.value = true;
  rpcError.value = null;
  rpcResult.value = null;

  try {
    let params: unknown = undefined;
    const paramsStr = rpcParams.value.trim();
    if (paramsStr && paramsStr !== "{}") {
      params = JSON.parse(paramsStr);
    }

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
      <div class="flex items-center gap-2 mb-4">
        <Send size={18} class="text-[var(--color-warning)]" />
        <h2 class="font-medium">{t("debug.manualRpc")}</h2>
      </div>

      <p class="text-sm text-[var(--color-text-muted)] mb-4">{t("debug.manualRpcDesc")}</p>

      <div class="space-y-4">
        {/* Method */}
        <div>
          <label class="block text-sm font-medium mb-1">{t("debug.method")}</label>
          <Input
            value={rpcMethod.value}
            onInput={(e) => {
              rpcMethod.value = (e.target as HTMLInputElement).value;
            }}
            placeholder="e.g., system-presence, status, health.check"
            class="font-mono"
          />
        </div>

        {/* Params */}
        <div>
          <label class="block text-sm font-medium mb-1">{t("debug.paramsJson")}</label>
          <Textarea
            value={rpcParams.value}
            onInput={(e) => {
              rpcParams.value = (e.target as HTMLTextAreaElement).value;
            }}
            placeholder="{}"
            rows={3}
            class="font-mono text-sm"
          />
        </div>

        {/* Call button */}
        <Button
          onClick={callRpc}
          disabled={!connected || rpcLoading.value || !rpcMethod.value.trim()}
          class="w-full"
        >
          {rpcLoading.value ? <Spinner size="sm" class="mr-2" /> : <Play size={14} class="mr-2" />}
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
                {rpcResult.value.ok ? "OK" : "Error"}
              </Badge>
            </div>
            <pre class="text-xs font-mono bg-[var(--color-bg-tertiary)] p-3 rounded-lg overflow-x-auto max-h-64">
              {formatPayload(rpcResult.value.data)}
            </pre>
          </div>
        )}
      </div>
    </Card>
  );
}
