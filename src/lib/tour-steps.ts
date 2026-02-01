/**
 * Tour Steps Configuration
 *
 * Defines the spotlight tour steps and their targets.
 */

import type { TourStep } from "@/components/tour";

export const ONBOARDING_TOUR_STEPS: TourStep[] = [
  {
    target: "[data-tour='sessions']",
    title: "Your Conversations",
    content:
      "All your chat sessions live here. Create new ones, rename them, or filter by type. Each session maintains its own context.",
    placement: "right",
  },
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
    target: "[data-tour='theme-picker']",
    title: "Themes",
    content:
      "Customize your experience with 12+ themes. Supports automatic switching based on your system's light/dark mode.",
    placement: "bottom",
  },
  {
    target: "[data-tour='settings']",
    title: "Settings",
    content:
      "Configure font size, time display format, keyboard shortcuts, and more. Your preferences are saved automatically.",
    placement: "bottom",
  },
];
