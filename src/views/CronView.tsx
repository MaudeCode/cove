/**
 * CronView
 *
 * Cron job management view.
 * Route: /cron
 * TODO: Phase 3.2 implementation
 */

import { PlaceholderView } from "./PlaceholderView";
import type { RouteProps } from "@/types/routes";

export function CronView(_props: RouteProps) {
  return <PlaceholderView titleKey="cron.title" icon="⏰" descriptionKey="cron.comingSoon" />;
}
