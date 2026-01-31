/**
 * ConfigView
 *
 * Configuration editor view.
 * Route: /config
 * TODO: Phase 3.3 implementation
 */

import { PlaceholderView } from "./PlaceholderView";
import type { RouteProps } from "@/types/routes";

export function ConfigView(_props: RouteProps) {
  return <PlaceholderView titleKey="config.title" icon="⚙️" descriptionKey="config.comingSoon" />;
}
