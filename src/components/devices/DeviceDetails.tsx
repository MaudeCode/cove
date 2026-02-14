/**
 * DeviceDetails
 *
 * Expanded detail panel for a device.
 */

import type { ComponentChildren } from "preact";
import { t, formatTimestamp } from "@/lib/i18n";
import { IconButton } from "@/components/ui/IconButton";
import { Shield, RotateCcw } from "lucide-preact";
import type { PairedDevice, DeviceTokenSummary } from "@/types/devices";

interface DeviceDetailsProps {
  device: PairedDevice;
  /** When true, removes container styling (for use in modals) */
  bare?: boolean;
  /** Callback to open token management modal */
  onOpenTokenModal?: (device: PairedDevice) => void;
}

/** Simple label: value row */
function DetailRow({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div>
      <span class="text-[var(--color-text-muted)]">{label}:</span> {children}
    </div>
  );
}

/** Compact token display with rotate button */
function TokenCardCompact({
  token,
  onRotate,
}: {
  token: DeviceTokenSummary;
  onRotate: () => void;
}) {
  return (
    <div class="flex items-center justify-between rounded-lg p-2 bg-[var(--color-bg-primary)]">
      <div>
        <div class="font-medium text-sm">{token.role}</div>
        <div class="text-xs text-[var(--color-text-muted)]">
          {token.revokedAtMs ? t("devices.tokenRevoked") : t("devices.tokenActive")}
        </div>
      </div>
      <div class="flex gap-1">
        <IconButton
          icon={<RotateCcw class="w-4 h-4" />}
          label={t("devices.rotateToken")}
          onClick={onRotate}
          size="sm"
        />
      </div>
    </div>
  );
}

export function DeviceDetails({ device, bare = false, onOpenTokenModal }: DeviceDetailsProps) {
  const tokens = device.tokens ?? [];

  const containerClass = bare
    ? ""
    : "px-4 py-3 bg-[var(--color-bg-tertiary)] border-t border-[var(--color-border)]";

  return (
    <div class={containerClass}>
      <div class="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
        {/* Left column: Metadata */}
        <div class="space-y-2 text-sm min-w-0">
          <DetailRow label={t("devices.deviceId")}>
            <code class="text-xs bg-[var(--color-bg-primary)] px-1 py-0.5 rounded break-all">
              {device.deviceId}
            </code>
          </DetailRow>
          {device.clientId && (
            <DetailRow label={t("devices.clientId")}>{device.clientId}</DetailRow>
          )}
          {device.scopes && device.scopes.length > 0 && (
            <DetailRow label={t("devices.scopes")}>
              <span class="text-xs">{device.scopes.join(", ")}</span>
            </DetailRow>
          )}
          <DetailRow label={t("common.approved")}>{formatTimestamp(device.approvedAtMs)}</DetailRow>
        </div>

        {/* Right column: Tokens */}
        <div class="space-y-2 w-full md:w-48 shrink-0">
          <h4 class="text-sm font-medium flex items-center gap-2">
            <Shield class="w-4 h-4" />
            {t("devices.tokens")}
          </h4>
          {tokens.length === 0 ? (
            <p class="text-sm text-[var(--color-text-muted)]">{t("devices.noTokens")}</p>
          ) : (
            <div class="space-y-2">
              {tokens.map((token) => (
                <TokenCardCompact
                  key={token.role}
                  token={token}
                  onRotate={() => onOpenTokenModal?.(device)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
