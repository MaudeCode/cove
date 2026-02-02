/**
 * PlaceholderView
 *
 * Generic placeholder for views not yet implemented.
 */

import { t } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import type { RouteProps } from "@/types/routes";

interface PlaceholderViewProps {
  titleKey: string;
  icon: string;
  descriptionKey?: string;
}

export function PlaceholderView({ titleKey, icon, descriptionKey }: PlaceholderViewProps) {
  return (
    <div class="flex-1 flex flex-col overflow-hidden">
      <PageHeader title={t(titleKey)} />

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

export function LogsView(_props: RouteProps) {
  return <PlaceholderView titleKey="nav.logs" icon="📋" />;
}
