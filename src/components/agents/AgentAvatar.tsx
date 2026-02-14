/**
 * AgentAvatar
 *
 * Displays an agent's avatar image with emoji fallback.
 * Handles loading states and error fallbacks gracefully.
 */

import { signal } from "@preact/signals";
import { gatewayUrl } from "@/lib/gateway";

// Track which avatars have loaded successfully (keyed by agentId)
export const avatarLoadedState = signal<Record<string, boolean>>({});

interface AgentAvatarProps {
  /** Agent ID (used for avatar URL) */
  agentId: string;
  /** Fallback emoji if no avatar */
  emoji?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional class names */
  class?: string;
}

const sizeClasses = {
  sm: "w-7 h-7 text-base",
  md: "w-8 h-8 text-lg",
  lg: "w-16 h-16 text-3xl",
};

const sizeClassesImg = {
  sm: "w-7 h-7",
  md: "w-8 h-8",
  lg: "w-16 h-16",
};

/**
 * Get the avatar URL for an agent.
 * Uses the gateway's /avatar/{agentId} endpoint.
 */
export function getAvatarUrl(agentId: string): string | null {
  const wsUrl = gatewayUrl.value;
  if (!wsUrl) return null;

  // Convert ws:// to http://, wss:// to https://
  const httpUrl = wsUrl.replace(/^ws/, "http");
  return `${httpUrl}/avatar/${encodeURIComponent(agentId)}`;
}

export function AgentAvatar({
  agentId,
  emoji = "🤖",
  size = "md",
  class: className = "",
}: AgentAvatarProps) {
  const avatarUrl = getAvatarUrl(agentId);
  const isLoaded = avatarLoadedState.value[agentId];
  const sizeClass = sizeClasses[size];
  const imgSizeClass = sizeClassesImg[size];

  const handleLoad = () => {
    avatarLoadedState.value = { ...avatarLoadedState.value, [agentId]: true };
  };

  const handleError = () => {
    avatarLoadedState.value = { ...avatarLoadedState.value, [agentId]: false };
  };

  return (
    <div class={`flex-shrink-0 relative ${className}`}>
      {avatarUrl && (
        <img
          src={avatarUrl}
          alt=""
          class={`${imgSizeClass} rounded-xl object-cover border border-[var(--color-border)] ${
            isLoaded ? "" : "hidden"
          }`}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
      {!isLoaded && (
        <div
          class={`${sizeClass} rounded-xl bg-[var(--color-bg-tertiary)] flex items-center justify-center border border-[var(--color-border)]`}
        >
          {emoji}
        </div>
      )}
    </div>
  );
}
