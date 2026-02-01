/**
 * Tour Steps Configuration
 *
 * Defines the spotlight tour steps and their targets.
 * Different steps for single-chat vs multi-chat modes.
 */

import type { TourStep } from "@/components/tour/SpotlightTour";

/** Steps that only apply in multi-chat mode */
const MULTI_CHAT_STEPS: TourStep[] = [
  {
    target: "[data-tour='sessions']",
    title: "Your Conversations",
    content:
      "All your chat sessions live here. Create new ones, rename them, or filter by type. Each session maintains its own context.",
    placement: "right",
  },
];

/** Steps shared between both modes */
const COMMON_STEPS: TourStep[] = [
  {
    target: "[data-tour='chat-input']",
    title: "Chat Input",
    content:
      "Type your message here. Press Enter to send, Shift+Enter for a new line. You can also drag & drop files or paste images.",
    placement: "top",
  },
  {
    target: "[data-tour='model-picker']",
    title: "Model Selection",
    content:
      "Switch between different AI models per session. Each model has different capabilities and response styles.",
    placement: "top",
  },
  {
    target: "[data-tour='settings']",
    title: "Settings",
    content:
      "Customize your experience with 12+ themes, font sizes, time formats, and more. Preferences are saved automatically.",
    placement: "bottom",
  },
];

/** Full tour for multi-chat mode (includes session management) */
const MULTI_CHAT_TOUR_STEPS: TourStep[] = [...MULTI_CHAT_STEPS, ...COMMON_STEPS];

/** Simplified tour for single-chat mode (no session sidebar) */
const SINGLE_CHAT_TOUR_STEPS: TourStep[] = [...COMMON_STEPS];

/**
 * Get the appropriate tour steps based on app mode
 */
export function getTourSteps(mode: "single" | "multi"): TourStep[] {
  return mode === "multi" ? MULTI_CHAT_TOUR_STEPS : SINGLE_CHAT_TOUR_STEPS;
}
