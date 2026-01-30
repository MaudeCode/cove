/**
 * Views
 *
 * Page-level components for different sections.
 */

// Core views
export { ChatView } from "./ChatView";
export { LoginView } from "./LoginView";

// Control views
export { StatusView as OverviewView } from "./StatusView"; // Reuse Status as Overview for now
export { CronView } from "./CronView";
export { ConfigView } from "./ConfigView";

// Placeholder views (to be implemented)
export {
  ChannelsView,
  InstancesView,
  SessionsView,
  SkillsView,
  NodesView,
  DebugView,
  LogsView,
} from "./PlaceholderView";

// Legacy export (StatusView is now OverviewView)
export { StatusView } from "./StatusView";
