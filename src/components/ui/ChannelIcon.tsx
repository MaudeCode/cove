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

// Slack multicolor logo (official brand colors)
// Each color has 2 shapes: outer pill + connector
const slackPaths = [
  // Blue (#36C5F0) - top-left area
  {
    path: "M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z",
    color: "#E01E5A",
  },
  // Green (#2EB67D) - top-right area
  {
    path: "M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z",
    color: "#36C5F0",
  },
  // Yellow (#ECB22E) - bottom-right area
  {
    path: "M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.522 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.164 0a2.528 2.528 0 0 1 2.522 2.522v6.312z",
    color: "#2EB67D",
  },
  // Red (#E01E5A) - bottom-left area
  {
    path: "M15.164 18.956a2.528 2.528 0 0 1 2.522 2.522A2.528 2.528 0 0 1 15.164 24a2.528 2.528 0 0 1-2.521-2.522v-2.522h2.521zm0-1.27a2.528 2.528 0 0 1-2.521-2.522 2.528 2.528 0 0 1 2.521-2.521h6.314A2.528 2.528 0 0 1 24 15.164a2.528 2.528 0 0 1-2.522 2.522h-6.314z",
    color: "#ECB22E",
  },
];

// Nostr logo (simplified relay/broadcast symbol)
const nostrPath =
  "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z";

// BlueBubbles logo (chat bubble with three dots)
// Simplified from official logo: speech bubble outline + 3 dots
const blueBubblesOutline =
  "M12 2C6.48 2 2 6.48 2 12c0 2.08.64 4.01 1.73 5.6L2 22l4.4-1.73C8 21.36 9.92 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z";
const blueBubblesDots = [
  { cx: 7.5, cy: 12, r: 1.5 },
  { cx: 12, cy: 12, r: 1.5 },
  { cx: 16.5, cy: 12, r: 1.5 },
];

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
  googlechat: { path: siGooglechat.path, hex: siGooglechat.hex, title: siGooglechat.title },
  matrix: { path: siMatrix.path, hex: siMatrix.hex, title: siMatrix.title },
  mastodon: { path: siMastodon.path, hex: siMastodon.hex, title: siMastodon.title },
  imessage: { path: appleMessagesPath, hex: "34C759", title: "iMessage" },
  nostr: { path: nostrPath, hex: "8B5CF6", title: "Nostr" },
  // Slack, BlueBubbles, and Webchat handled separately
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

  // Slack: multicolor logo
  if (id === "slack") {
    return (
      <svg
        role="img"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        class={className}
        aria-label="Slack"
      >
        <title>Slack</title>
        {slackPaths.map((p, i) => (
          <path key={i} fill={colored ? p.color : "currentColor"} d={p.path} />
        ))}
      </svg>
    );
  }

  // BlueBubbles: chat bubble with three dots
  if (id === "bluebubbles") {
    const color = colored ? "#2196F3" : "currentColor";
    return (
      <svg
        role="img"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        class={className}
        aria-label="BlueBubbles"
      >
        <title>BlueBubbles</title>
        <path fill="none" stroke={color} stroke-width="2" d={blueBubblesOutline} />
        {blueBubblesDots.map((dot, i) => (
          <circle key={i} cx={dot.cx} cy={dot.cy} r={dot.r} fill={color} />
        ))}
      </svg>
    );
  }

  // Webchat: globe icon
  if (id === "webchat") {
    return (
      <Globe
        class={className}
        style={{ width: size, height: size, color: colored ? "#6366f1" : "currentColor" }}
      />
    );
  }

  const icon = channelIcons[id];

  // Fallback to globe icon for unknown channels
  if (!icon) {
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
