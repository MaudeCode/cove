/**
 * PlaceholderView
 *
 * Generic placeholder for views not yet implemented.
 */

import { t } from "@/lib/i18n";
import { Card } from "@/components/ui";

interface PlaceholderViewProps {
  titleKey: string;
  icon: string;
  descriptionKey?: string;
}

export function PlaceholderView({ titleKey, icon, descriptionKey }: PlaceholderViewProps) {
  return (
    <div class="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div class="p-6 border-b border-[var(--color-border)]">
        <h1 class="text-xl font-semibold">{t(titleKey)}</h1>
      </div>

      {/* Content */}
      <div class="flex-1 flex items-center justify-center p-8">
        <Card padding="lg" class="text-center max-w-sm">
          <div class="text-5xl mb-4">{icon}</div>
          <h2 class="text-lg font-medium mb-2">{t(titleKey)}</h2>
          <p class="text-[var(--color-text-muted)]">
            {descriptionKey ? t(descriptionKey) : "Coming soon..."}
          </p>
        </Card>
      </div>
    </div>
  );
}

// ============================================
// Pre-configured placeholder views
// ============================================

export function OverviewView() {
  return <PlaceholderView titleKey="nav.overview" icon="📊" />;
}

export function ChannelsView() {
  return <PlaceholderView titleKey="nav.channels" icon="🔗" />;
}

export function InstancesView() {
  return <PlaceholderView titleKey="nav.instances" icon="📡" />;
}

export function SessionsView() {
  return <PlaceholderView titleKey="nav.sessions" icon="💬" />;
}

export function SkillsView() {
  return <PlaceholderView titleKey="nav.skills" icon="⚡" />;
}

export function NodesView() {
  return <PlaceholderView titleKey="nav.nodes" icon="📱" />;
}

export function DebugView() {
  return <PlaceholderView titleKey="nav.debug" icon="🔧" />;
}

export function LogsView() {
  return <PlaceholderView titleKey="nav.logs" icon="📋" />;
}
