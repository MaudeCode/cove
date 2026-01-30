/**
 * Route Types
 *
 * Props passed by preact-router to routed components.
 */

/**
 * Base props for all routed views
 */
export interface RouteProps {
  /** Route path pattern (from preact-router) */
  path?: string;

  /** Whether this is the default route (from preact-router) */
  default?: boolean;
}
