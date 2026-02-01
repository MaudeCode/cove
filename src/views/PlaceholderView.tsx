/**
 * PlaceholderView
 *
 * Generic placeholder for views not yet implemented.
 */

import { t } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import type { RouteProps } from "@/types/routes";

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

// Note: RouteProps accepted but unused - required by preact-router

export function ChannelsView(_props: RouteProps) {
  return <PlaceholderView titleKey="nav.channels" icon="🔗" />;
}

export function InstancesView(_props: RouteProps) {
  return <PlaceholderView titleKey="nav.instances" icon="📡" />;
}

export function SkillsView(_props: RouteProps) {
  return <PlaceholderView titleKey="nav.skills" icon="⚡" />;
}

export function NodesView(_props: RouteProps) {
  return <PlaceholderView titleKey="nav.nodes" icon="📱" />;
}

export function DebugView(_props: RouteProps) {
  return <PlaceholderView titleKey="nav.debug" icon="🔧" />;
}

export function LogsView(_props: RouteProps) {
  return <PlaceholderView titleKey="nav.logs" icon="📋" />;
}

export function StatsView(_props: RouteProps) {
  return <PlaceholderView titleKey="nav.stats" icon="📊" />;
}
