/**
 * ChannelIcon
 *
 * Renders brand icons for messaging channels using simple-icons.
 */

import {
  siTelegram,
  siDiscord,
  siSignal,
  siWhatsapp,
  siGooglechat,
  siMatrix,
  siMastodon,
} from "simple-icons";
import { Globe } from "lucide-preact";

// Custom SVG paths for icons not in simple-icons

// Apple Messages bubble (Apple logo not allowed in simple-icons)
const appleMessagesPath =
  "M12 2C6.477 2 2 5.813 2 10.5c0 2.34 1.06 4.463 2.777 6.003L3.5 21l5.025-2.512c1.078.327 2.24.512 3.475.512 5.523 0 10-3.813 10-8.5S17.523 2 12 2z";

// Slack logo (from Bootstrap Icons, scaled to 24x24 viewBox)
const slackPath =
  "M5.042 15.165c0 1.389-1.134 2.521-2.521 2.521S0 16.554 0 15.165c0-1.388 1.134-2.522 2.521-2.522h2.521v2.522zm1.27 0c0-1.388 1.134-2.521 2.521-2.521s2.521 1.133 2.521 2.521v6.315c0 1.388-1.134 2.52-2.521 2.52a2.527 2.527 0 0 1-2.521-2.52v-6.315zM8.833 5.042c-1.389 0-2.521-1.134-2.521-2.521S7.444 0 8.833 0s2.521 1.134 2.521 2.521v2.521H8.833zm0 1.271c1.388 0 2.521 1.134 2.521 2.521s-1.133 2.521-2.521 2.521H2.521A2.527 2.527 0 0 1 0 8.834c0-1.388 1.134-2.521 2.521-2.521h6.312zm10.125 2.521c0-1.389 1.133-2.521 2.521-2.521S24 7.445 24 8.834s-1.134 2.521-2.521 2.521h-2.521V8.834zm-1.27 0c0 1.388-1.133 2.521-2.521 2.521a2.527 2.527 0 0 1-2.521-2.521V2.521C12.646 1.134 13.78 0 15.167 0c1.389 0 2.521 1.134 2.521 2.521v6.313zm-2.521 10.124c1.389 0 2.521 1.134 2.521 2.521S16.556 24 15.167 24s-2.521-1.134-2.521-2.521v-2.521h2.521zm0-1.27c-1.388 0-2.521-1.133-2.521-2.521 0-1.388 1.133-2.521 2.521-2.521h6.313C22.866 12.646 24 13.78 24 15.167c0 1.389-1.134 2.521-2.521 2.521h-6.313z";

// Nostr logo (simplified relay/broadcast symbol)
const nostrPath =
  "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z";

interface ChannelIconData {
  path: string;
  hex: string;
  title: string;
}

const channelIcons: Record<string, ChannelIconData> = {
  telegram: { path: siTelegram.path, hex: siTelegram.hex, title: siTelegram.title },
  discord: { path: siDiscord.path, hex: siDiscord.hex, title: siDiscord.title },
  signal: { path: siSignal.path, hex: siSignal.hex, title: siSignal.title },
  whatsapp: { path: siWhatsapp.path, hex: siWhatsapp.hex, title: siWhatsapp.title },
  slack: { path: slackPath, hex: "4A154B", title: "Slack" },
  googlechat: { path: siGooglechat.path, hex: siGooglechat.hex, title: siGooglechat.title },
  matrix: { path: siMatrix.path, hex: siMatrix.hex, title: siMatrix.title },
  mastodon: { path: siMastodon.path, hex: siMastodon.hex, title: siMastodon.title },
  imessage: { path: appleMessagesPath, hex: "34C759", title: "iMessage" },
  nostr: { path: nostrPath, hex: "8B5CF6", title: "Nostr" },
  // Webchat uses a generic globe icon (handled separately)
};

interface ChannelIconProps {
  channelId: string;
  size?: number;
  class?: string;
  colored?: boolean;
}

export function ChannelIcon({
  channelId,
  size = 20,
  class: className,
  colored = true,
}: ChannelIconProps) {
  const id = channelId.toLowerCase();
  const icon = channelIcons[id];

  // Fallback to globe icon for unknown channels
  if (!icon) {
    if (id === "webchat") {
      return (
        <Globe
          class={className}
          style={{ width: size, height: size, color: colored ? "#6366f1" : "currentColor" }}
        />
      );
    }
    return <Globe class={className} style={{ width: size, height: size }} />;
  }

  const color = colored ? `#${icon.hex}` : "currentColor";

  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      class={className}
      aria-label={icon.title}
    >
      <title>{icon.title}</title>
      <path fill={color} d={icon.path} />
    </svg>
  );
}
