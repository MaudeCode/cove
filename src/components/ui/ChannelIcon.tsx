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
  siSlack,
  siGooglechat,
  siMatrix,
  siMastodon,
  siNostr,
} from "simple-icons";
import { Globe } from "lucide-preact";

// Apple doesn't allow their logo in simple-icons, so we use a custom path
// This is the Apple Messages bubble icon (simplified)
const appleMessagesPath =
  "M12 2C6.477 2 2 5.813 2 10.5c0 2.34 1.06 4.463 2.777 6.003L3.5 21l5.025-2.512c1.078.327 2.24.512 3.475.512 5.523 0 10-3.813 10-8.5S17.523 2 12 2z";

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
  slack: { path: siSlack.path, hex: siSlack.hex, title: siSlack.title },
  googlechat: { path: siGooglechat.path, hex: siGooglechat.hex, title: siGooglechat.title },
  matrix: { path: siMatrix.path, hex: siMatrix.hex, title: siMatrix.title },
  mastodon: { path: siMastodon.path, hex: siMastodon.hex, title: siMastodon.title },
  nostr: { path: siNostr.path, hex: siNostr.hex, title: "Nostr" },
  imessage: { path: appleMessagesPath, hex: "34C759", title: "iMessage" },
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
