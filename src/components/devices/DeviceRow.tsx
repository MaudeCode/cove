/**
 * DeviceRow
 *
 * Desktop expandable row for a device.
 */

import { t, formatTimestamp } from "@/lib/i18n";
import { Badge } from "@/components/ui/Badge";
import { ChevronDown, ChevronRight, Key, Clock } from "lucide-preact";
import type { PairedDevice } from "@/types/devices";
import {
  getDeviceRole,
  getRoleBadgeVariant,
  getPlatformIcon,
  formatDeviceId,
} from "@/types/devices";
import { DeviceDetails } from "./DeviceDetails";

interface DeviceRowProps {
  device: PairedDevice;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenTokenModal: (device: PairedDevice) => void;
  onRemoveDevice: (device: PairedDevice) => void;
}

export function DeviceRow({
  device,
  isExpanded,
  onToggleExpand,
  onOpenTokenModal,
  onRemoveDevice,
}: DeviceRowProps) {
  const role = getDeviceRole(device);
  const tokenCount = device.tokens?.length ?? 0;

  return (
    <div class="border-b border-[var(--color-border)] last:border-b-0">
      {/* Row header */}
      <button
        type="button"
        class="w-full flex items-center gap-4 px-4 py-3 hover:bg-[var(--color-bg-tertiary)] text-left"
        onClick={onToggleExpand}
        aria-expanded={isExpanded}
        aria-label={t("devices.toggleDetails", {
          name: device.displayName || formatDeviceId(device.deviceId),
        })}
      >
        {/* Expand chevron */}
        <span class="text-[var(--color-text-muted)]">
          {isExpanded ? <ChevronDown class="w-4 h-4" /> : <ChevronRight class="w-4 h-4" />}
        </span>

        {/* Platform icon */}
        <span class="text-xl w-8 text-center flex-shrink-0">
          {getPlatformIcon(device.platform)}
        </span>

        {/* Name & info */}
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-medium truncate">
              {device.displayName || formatDeviceId(device.deviceId)}
            </span>
          </div>
          <div class="text-sm text-[var(--color-text-muted)] truncate">
            {device.platform}
            {device.remoteIp && ` • ${device.remoteIp}`}
            {device.clientMode && ` • ${device.clientMode}`}
          </div>
        </div>

        {/* Role badge */}
        <Badge variant={getRoleBadgeVariant(role)}>{role}</Badge>

        {/* Token count */}
        {tokenCount > 0 && (
          <div class="flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
            <Key class="w-4 h-4" />
            <span>{tokenCount}</span>
          </div>
        )}

        {/* Approved date */}
        <div class="hidden md:flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
          <Clock class="w-4 h-4" />
          <span>{formatTimestamp(device.approvedAtMs)}</span>
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <DeviceDetails
          device={device}
          onOpenTokenModal={onOpenTokenModal}
          onRemoveDevice={onRemoveDevice}
        />
      )}
    </div>
  );
}
