/**
 * DeviceCard
 *
 * Mobile card view for a device (tap to view details).
 */

import { formatTimestamp } from "@/lib/i18n";
import { Badge } from "@/components/ui/Badge";
import { ListCard } from "@/components/ui/ListCard";
import { Smartphone, Monitor, Key, Clock } from "lucide-preact";
import type { PairedDevice } from "@/types/devices";
import { getDeviceRole, getRoleBadgeVariant, formatDeviceId } from "@/types/devices";

interface DeviceCardProps {
  device: PairedDevice;
  onSelect: (device: PairedDevice) => void;
}

export function DeviceCard({ device, onSelect }: DeviceCardProps) {
  const role = getDeviceRole(device);
  const tokenCount = device.tokens?.length ?? 0;
  const PlatformIcon = device.platform?.includes("ios")
    ? Smartphone
    : device.platform?.includes("android")
      ? Smartphone
      : Monitor;

  return (
    <ListCard
      icon={PlatformIcon}
      iconVariant={role === "operator" ? "info" : "success"}
      title={device.displayName || formatDeviceId(device.deviceId)}
      subtitle={device.platform || undefined}
      badges={<Badge variant={getRoleBadgeVariant(role)}>{role}</Badge>}
      meta={[
        ...(tokenCount > 0 ? [{ icon: Key, value: `${tokenCount}` }] : []),
        { icon: Clock, value: formatTimestamp(device.approvedAtMs, { relative: true }) },
      ]}
      onClick={() => onSelect(device)}
    />
  );
}
